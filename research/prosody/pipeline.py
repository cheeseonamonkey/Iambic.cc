"""CPU-only, resumable Reddit/X/Bluesky prosody study; Python 3.10+.
Run from the notebook. Engagement is NOT click-through rate or causal uplift.
"""
import hashlib, io, json, math, re, zipfile
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
import cmudict, duckdb, numpy as np, pandas as pd, pyarrow as pa, pyarrow.parquet as pq, requests
import statsmodels.api as sm
from datasets import load_dataset
from huggingface_hub import HfApi
from statsmodels.stats.multitest import multipletests

ROOT=Path("prosody_results")
MODE="pilot"    # full: 3M Reddit, 3M X, 3M Bluesky
APPROVED={"reddit":False,"x":False,"bluesky":False}  # explicit rights attestation
SEED=1729
BATCH=5000
COLS="iamb trochee alternation alliteration assonance consonance rhyme syllables_per_word lexical_diversity".split()
CONTROLS="log_words sentiment question exclamation coverage truncated".split()
FEATS=[x for x in COLS if x!="trochee"]+CONTROLS
LEX=cmudict.dict()
WORD=re.compile(r"[A-Za-z]+(?:'[A-Za-z]+)?")
URL=re.compile(r"https?://\S+|www\.\S+")
WEAK=set("a an the and or but of to in on at for from by with into as if when while is are was were be been being am do does did will would shall should could can may might i you he she they it we me him her them us my your our their its".split())
POS=set("good great best love happy hope glad thanks thank kind helpful wonderful nice appreciate support proud success relief easy amazing better".split())
NEG=set("bad worse worst sad sorry loss lost hurt upset angry disappointed fear afraid terrible hard difficult rejected rejection failed fail sick death died".split())

def digest(x): return hashlib.blake2b(str(x).encode("utf8","replace"),digest_size=12).hexdigest()
def num(x):
    try:
        z=float(x)
        return z if math.isfinite(z) else None
    except (ValueError,TypeError,OverflowError): return None
def month(x):
    s=str(x or "")
    if re.fullmatch(r"\d{10}(?:\.\d+)?",s):
        try: return datetime.fromtimestamp(float(s),timezone.utc).strftime("%Y-%m")
        except (OSError,ValueError,OverflowError): pass
    return s[:7] if re.match(r"^\d{4}-\d{2}",s) else "unknown"
@lru_cache(maxsize=150000)
def phonemes(word):
    found=LEX.get(word)
    return found[0] if found else None

def features(text):
    text=URL.sub(" ",str(text or "").replace("\x00"," "))
    sample=text[:1600]
    words=WORD.findall(sample.lower())
    if len(words)<4: return None
    letters=[c for c in sample if c.isalpha()]
    if len(letters)<8 or sum(c.isascii() for c in letters)/len(letters)<.8: return None
    stress=[]; lex=[]; known=0; nsyll=0
    for word in words:
        p=phonemes(word)
        if not p: continue
        s=[int(z[-1])>0 for z in p if z[-1:] in ("0","1","2")]
        if not s: continue
        known+=1; nsyll+=len(s)
        stress.extend([False]*len(s) if word in WEAK else s)
        if word not in WEAK:
            vowel=next((z[:-1] for z in p if z[-1:] in ("1","2")), "")
            if not vowel: vowel=next((z[:-1] for z in p if z[-1:]=="0"), "")
            pos=next((j for j in range(len(p)-1,-1,-1) if p[j][-1:] in ("1","2")),len(p)-1)
            lex.append((word,p[0],vowel,p[-1],tuple(re.sub(r"[012]$","",z) for z in p[pos:])))
    n=len(stress)
    def adjacent(k):
        return sum(lex[j][k]==lex[j-1][k] for j in range(1,len(lex)))/max(1,len(lex)-1)
    return dict(
        iamb=sum(bool(s)==(i%2==1) for i,s in enumerate(stress))/n if n>=4 else None,
        trochee=sum(bool(s)==(i%2==0) for i,s in enumerate(stress))/n if n>=4 else None,
        alternation=sum(stress[i]!=stress[i-1] for i in range(1,n))/max(1,n-1) if n>=4 else None,
        alliteration=adjacent(1),assonance=adjacent(2),consonance=adjacent(3),
        rhyme=sum(lex[j][4]==lex[j-1][4] and lex[j][0]!=lex[j-1][0] for j in range(1,len(lex)))/max(1,len(lex)-1),
        syllables_per_word=nsyll/max(1,known),lexical_diversity=len(set(words))/len(words),
        log_words=math.log1p(len(words)),
        sentiment=(sum(w in POS for w in words)-sum(w in NEG for w in words))/math.sqrt(len(words)),
        question=float("?" in sample),exclamation=float("!" in sample),
        coverage=known/len(words),truncated=float(len(text)>1600),n_words=len(words))

def source_specs():
    full=MODE=="full"
    r=500000 if full else 150
    reddit=["programming","explainlikeimfive","changemyview","tifu","LifeProTips","science"]
    return ([{"id":"reddit_"+x.lower(),"platform":"reddit","repo":"HuggingFaceGECLM/REDDIT_comments",
              "split":x,"quota":r} for x in reddit]+
            [{"id":"x_blockmesh","platform":"x","repo":"blockmesh/tweets","split":"train",
              "quota":3000000 if full else 300},
             {"id":"bluesky_five_million","platform":"bluesky",
              "repo":"Roronotalt/bluesky-five-million","split":"train",
              "quota":1500000 if full else 150},
             {"id":"bluesky_two_million","platform":"bluesky",
              "repo":"alpindale/two-million-bluesky-posts","split":"train",
              "quota":1500000 if full else 150}])

def normalized(raw,sp):
    p=sp["platform"]
    if p=="reddit":
        txt,id_,parent=raw.get("body"),raw.get("id"),raw.get("parent_id")
        author,date,score=raw.get("author"),raw.get("created_utc"),num(raw.get("score"))
    elif p=="x":
        txt,id_,parent=raw.get("tweet",raw.get("text")),raw.get("id"),raw.get("in_reply_to_status_id")
        author,date,score=raw.get("user"),raw.get("date"),num(raw.get("like"))
    else:
        txt,id_,parent=raw.get("text"),raw.get("uri"),raw.get("reply_to")
        author,date,score=raw.get("author_did",raw.get("author")),raw.get("created_at"),num(raw.get("like_count"))
    if not txt or str(txt).strip().lower() in ("[deleted]","[removed]"): return None
    ft=features(txt)
    if ft is None: return None
    return dict(platform=p,source=sp["id"],post_id=p+":"+str(id_ or digest((txt,date,author))),
                parent_id=p+":"+str(parent or ""),author_hash=digest(author),month=month(date),
                engagement=score,
                reposts=num(raw.get("retweet")) if p=="x" else None,
                replies=num(raw.get("reply")) if p=="x" else None,**ft)

def chunk(directory,batch,ix):
    directory.mkdir(parents=True,exist_ok=True)
    tmp=directory/("part-%05d.tmp.parquet"%ix)
    pq.write_table(pa.Table.from_pylist(batch),tmp,compression="zstd")
    tmp.replace(directory/("part-%05d.parquet"%ix))
def checkpoint(path,state):
    tmp=path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state,indent=2))
    tmp.replace(path)

def ingest(sp):
    d=ROOT/"features"/sp["id"]
    d.mkdir(parents=True,exist_ok=True)
    cp=d/"checkpoint.json"
    state=json.loads(cp.read_text()) if cp.exists() else {}
    accepted=int(state.get("accepted",0))
    if not APPROVED[sp["platform"]]: return {"source":sp["id"],"status":"blocked: permission not confirmed"}
    signature=digest(({k:v for k,v in sp.items() if k!="quota"},SEED))
    if state and state.get("signature")!=signature: raise RuntimeError("Config changed; use a fresh output directory")
    if accepted>=sp["quota"]: return {"source":sp["id"],"status":"complete","n":accepted}
    info=HfApi().dataset_info(sp["repo"])
    if state and info.sha!=state.get("revision"): raise RuntimeError("Upstream dataset changed; refusing inconsistent resume")
    state.update(signature=signature,revision=info.sha,license_tags=[x for x in (info.tags or []) if x.startswith("license:")])
    ds=load_dataset(sp["repo"],split=sp["split"],revision=info.sha,streaming=True)
    # Bounded-buffer shuffle mixes shards; not a globally uniform sample.
    ds=ds.shuffle(seed=SEED,buffer_size=10000)
    seen=int(state.get("seen",0))
    if seen: ds=ds.skip(seen)
    part=int(state.get("part",0)); batch=[]
    for raw in ds:
        seen+=1
        row=normalized(raw,sp)
        if row:
            batch.append(row); accepted+=1
        if len(batch)>=BATCH or accepted>=sp["quota"]:
            if batch:
                chunk(d,batch,part); part+=1; batch.clear()
            state.update(seen=seen,accepted=accepted,part=part);checkpoint(cp,state)
            print(sp["id"],accepted,"/",sp["quota"],flush=True)
        if accepted>=sp["quota"]: break
    if batch:
        chunk(d,batch,part);part+=1
    state.update(seen=seen,accepted=accepted,part=part);checkpoint(cp,state)
    return {"source":sp["id"],"status":"complete" if accepted>=sp["quota"] else "exhausted","n":accepted}

def platforms():
    ROOT.mkdir(parents=True,exist_ok=True)
    results=[]
    with ThreadPoolExecutor(max_workers=3) as pool:
        pending={pool.submit(ingest,sp):sp for sp in source_specs()}
        for future in as_completed(pending):
            sp=pending[future]
            try: item=future.result()
            except Exception as e: item={"source":sp["id"],"status":"error","detail":str(e)}
            results.append(item);print(item,flush=True)
    (ROOT/"sources.json").write_text(json.dumps(results,indent=2))
    return results

def supplements():
    if not APPROVED["reddit"]:
        print("SHP-2, EPITOME, CMV blocked pending Reddit rights review")
        return
    # Stanford matched replies: includes 8 independently sampled topical domains.
    for domain in ("askculinary","explainlikeimfive","changemyview","linuxquestions",
                   "writing","askdocs","askhr","smallbusiness"):
        d=ROOT/"paired"/domain
        if list(d.glob("*.parquet")): continue
        rows=[]
        try:
            ds=load_dataset("stanfordnlp/SHP-2",data_dir="reddit/"+domain,
                            split="train",streaming=True)
            for raw in ds:
                a,b=features(raw.get("human_ref_A")),features(raw.get("human_ref_B"))
                label=num(raw.get("labels"))
                if a and b and label in (0.,1.):
                    rows.append(dict(group_id=digest((domain,raw.get("post_id"))),domain=domain,
                                     label=int(label),
                                     time_gap=math.log1p(abs(num(raw.get("seconds_difference")) or 0)),
                                     **{"d_"+k:(a[k]-b[k] if a[k] is not None and b[k] is not None else None)
                                        for k in FEATS}))
                if len(rows)>=(12000 if MODE=="full" else 70): break
            if rows: chunk(d,rows,0)
            print("SHP-2",domain,len(rows))
        except Exception as ex: print("SHP-2 failed",domain,str(ex))
    # EPITOME: three distinct annotated empathy mechanisms, never conflate with engagement.
    for key in ("emotional-reactions","interpretations","explorations"):
        d=ROOT/"labeled"/"empathy"/key
        if list(d.glob("*.parquet")): continue
        try:
            url="https://raw.githubusercontent.com/behavioral-data/Empathy-Mental-Health/master/dataset/"+key+"-reddit.csv"
            r=requests.get(url,timeout=120);r.raise_for_status()
            import csv
            rows=[]
            for raw in csv.DictReader(io.StringIO(r.content.decode("utf8-sig"))):
                f=features(raw.get("response_post"));label=num(raw.get("level"))
                if f and label is not None:
                    rows.append(dict(group_id=digest(raw.get("sp_id")),domain=key,label=label,**f))
            if rows: chunk(d,rows,0)
            print("EPITOME",key,len(rows))
        except Exception as ex: print("EPITOME failed",key,str(ex))
    # Cornell ChangeMyView: direct ZIP (not a scraping process).
    d=ROOT/"labeled"/"cmv"
    if list(d.glob("*.parquet")): return
    try:
        d.mkdir(parents=True,exist_ok=True)
        archive=d/"winning-args-corpus.zip"
        if not archive.exists():
            url="https://zissou.infosci.cornell.edu/convokit/datasets/winning-args-corpus/winning-args-corpus.zip"
            with requests.get(url,stream=True,timeout=180) as r:
                r.raise_for_status()
                with archive.open("wb") as out:
                    for part in r.iter_content(1<<20): out.write(part)
        rows=[]
        with zipfile.ZipFile(archive) as z:
            fname=next((name for name in z.namelist() if name.endswith("utterances.jsonl")),None)
            if fname is None: raise RuntimeError("ConvoKit utterances.jsonl missing")
            with z.open(fname) as f:
                for line in f:
                    raw=json.loads(line);meta=raw.get("meta") or {};y=num(meta.get("success"))
                    ft=features(raw.get("text"))
                    if ft and y in (0.,1.):
                        rows.append(dict(group_id=digest(raw.get("conversation_id")),domain="cmv",
                                         label=int(y),**ft))
        if rows: chunk(d,rows,0)
        print("CMV",len(rows))
    except Exception as ex: print("CMV failed",str(ex))

def fit(df,ycol,xcols,cluster,binary=False):
    df=df.dropna(subset=[ycol]+xcols).copy()
    if len(df)<80 or df[ycol].nunique()<2: return pd.DataFrame(),{"n":len(df),"error":"insufficient rows"}
    X=df[xcols].astype(float).copy()
    if not binary:
        df["_response"]=np.arcsinh(df[ycol].astype(float).clip(-1e7,1e7))
        df["_response"]-=df.groupby("stratum")["_response"].transform("mean")
        for c in xcols: X[c]-=df.groupby("stratum")[c].transform("mean")
        y=df["_response"]
    else: y=df[ycol].astype(int)
    for c in xcols:
        sd=float(X[c].std())
        if sd>1e-9:X[c]/=sd
    X=sm.add_constant(X,has_constant="add")
    group=pd.factorize(df[cluster].astype(str))[0]
    if binary:
        model=sm.GLM(y,X,family=sm.families.Binomial()).fit(
            cov_type="cluster",cov_kwds={"groups":group},maxiter=100)
    else:
        model=sm.OLS(y,X).fit(cov_type="cluster",cov_kwds={"groups":group})
    bounds=model.conf_int()
    result=pd.DataFrame({"feature":xcols,"effect_sd":[model.params[c] for c in xcols],
                         "lower":[bounds.loc[c,0] for c in xcols],
                         "upper":[bounds.loc[c,1] for c in xcols],
                         "p":[model.pvalues[c] for c in xcols]})
    result["q_bh"]=multipletests(result.p.fillna(1),method="fdr_bh")[1]
    return result.sort_values("p"),{"n":len(df),"clusters":len(set(group))}

def analyze():
    report=ROOT/"reports";report.mkdir(parents=True,exist_ok=True)
    summary={}
    files=[str(p) for p in (ROOT/"features").glob("*/*.parquet")]
    con=duckdb.connect()
    con.execute("SET memory_limit='2GB'")
    if files:
        descriptive=con.execute("""
          SELECT platform,source,count(*) AS n,
                 avg(iamb) AS iamb_mean,avg(trochee) AS trochee_mean,
                 avg(alliteration) AS alliteration_mean,avg(rhyme) AS rhyme_mean,
                 avg(coverage) AS pronunciation_coverage
          FROM read_parquet(?,union_by_name=true)
          GROUP BY platform,source ORDER BY platform,source
        """,[files]).df()
        descriptive.to_csv(report/"phonetic_distribution.csv",index=False)
        summary["distribution_sources"]=len(descriptive)
    for plat in ("reddit","x","bluesky"):
        if not files:
            summary[plat]={"error":"No platform features"};continue
        df=con.execute("""
        SELECT * EXCLUDE (rn) FROM (
          SELECT *,row_number() OVER (PARTITION BY post_id ORDER BY source) AS rn
          FROM read_parquet(?,union_by_name=true)
          WHERE platform=? AND engagement IS NOT NULL AND coverage>=.65
        ) WHERE rn=1 ORDER BY hash(post_id) LIMIT ?
        """,[files,plat,120000 if MODE=="full" else 1000]).df()
        if len(df)<80:
            summary[plat]={"n":len(df),"error":"insufficient engagement data"};continue
        df["stratum"]=df["source"]+":"+df["month"]
        for metric in (("engagement","reposts","replies") if plat=="x" else ("engagement",)):
            if metric not in df.columns or df[metric].notna().sum()<80:
                continue
            t,meta=fit(df,metric,FEATS,"author_hash")
            key=plat+("_"+metric if metric!="engagement" else "")
            if len(t): t.to_csv(report/("engagement_"+key+".csv"),index=False)
            summary[key]=meta
    for name,pattern,binary in (("preference","paired/*/*.parquet",True),
                                ("empathy","labeled/empathy/*/*.parquet",False),
                                ("persuasion","labeled/cmv/*.parquet",True)):
        paths=[str(p) for p in ROOT.glob(pattern)]
        if not paths:
            summary[name]={"error":"No available labeled data"};continue
        df=con.execute("SELECT * FROM read_parquet(?,union_by_name=true)",[paths]).df()
        if name=="preference":
            xcols=["d_"+k for k in FEATS]+["time_gap"]
            train=df[df.group_id.map(lambda v:int(str(v)[:6],16)%5!=0)].copy()
            test=df[df.group_id.map(lambda v:int(str(v)[:6],16)%5==0)].copy()
            for split,data in (("train",train),("holdout",test)):
                data["stratum"]=data["domain"]
                t,meta=fit(data,"label",xcols,"group_id",binary=True)
                if len(t):t.to_csv(report/(name+"_"+split+".csv"),index=False)
                summary[name+"_"+split]=meta
        else:
            df["stratum"]=df["domain"]
            if name=="empathy":
                # Ordinal empathy levels approximated as continuous, exploratory.
                df["engagement"]=df["label"]
                t,meta=fit(df,"engagement",FEATS,"group_id")
            else:t,meta=fit(df,"label",FEATS,"group_id",binary=True)
            if len(t):t.to_csv(report/(name+".csv"),index=False)
            summary[name]=meta
    (report/"summary.json").write_text(json.dumps(summary,indent=2))
    lines=["# Prosody observational study","",
           "Not CTR: Reddit net scores and X like/repost/reply counts are engagement outcomes; Bluesky corpora lack comparable engagement fields.",
           "Lexical stress is estimated from CMUdict; no actual vocal prosody was measured.",
           "Streaming samples are approximate, not population-random. All associations are noncausal.",
           "Regression: feature-SD effects, cluster-robust 95% intervals and Benjamini-Hochberg q-values.",
           "Semantic content, impressions and posting exposure are incompletely controlled.","",
           "## Run diagnostics","",json.dumps(summary,indent=2),""]
    for f in sorted(report.glob("*.csv")):
        t=pd.read_csv(f)
        lines.extend(["## "+f.stem,"",t.round(5).to_string(index=False),""])
    (report/"report.md").write_text("\n".join(lines),encoding="utf8")
    return summary

def self_test():
    assert features("We have the meats.") is not None
    assert features(" ") is None
    p=source_specs()[0]
    assert normalized({"body":"I think this can be improved.","score":"-2","id":"z"},p)["engagement"]==-2.
    print("Basic feature tests passed.")

def run():
    self_test()
    status=platforms()
    supplements()
    summary=analyze()
    print("Reports:",ROOT/"reports")
    return status,summary
