"use strict";
const notationLetter=ch=>!!ch&&/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(ch);
const notationWordChar=ch=>notationLetter(ch)||!!ch&&/[’'-]/.test(ch);
function readDelimited(source,start){const open=source[start],close=open==="["?"]":open==="<"?">":null;if(!close)return null;let text="";for(let i=start+1;i<source.length;i++){const ch=source[i];if(ch==="\\"&&i+1<source.length&&"[]<>\\".includes(source[i+1])){text+=source[++i];continue}if(ch===close)return{text,end:i+1,stress:open==="["?"strong":"weak"};text+=ch}return null}
function readNotationWord(source,start){let i=start,raw="",manual=[],plain=false;while(i<source.length){if(notationWordChar(source[i])){raw+=source[i++];plain=true;continue}if(source[i]!=="["&&source[i]!=="<")break;const part=readDelimited(source,i);if(!part||!part.text||![...part.text].some(notationLetter)||![...part.text].every(notationWordChar))break;const from=raw.length;raw+=part.text;manual.push({from,to:raw.length,text:part.text,stress:part.stress});i=part.end}return raw&&manual.length?{raw,end:i,manual,plain}:null}
function analyzedNotationWord(run){const base=automaticSyllables(run.raw);if(!run.plain&&run.manual.map(x=>x.text).join("")===run.raw)return run.manual.map(x=>({text:x.text,stress:x.stress,boundary:null,manual:true}));let pos=0;return base.map(sy=>{const from=pos,to=pos+sy.text.length,center=(from+to)/2;pos=to;const override=run.manual.find(x=>center>=x.from&&center<x.to);return{...sy,stress:override?.stress??sy.stress,manual:!!override}})}
decodeEscapes=function(s){return s.replace(/\\([\[\]<>\\])/g,"$1")};
parseLine=function(source){const segments=[];let gap="",i=0;const flush=()=>{if(gap){segments.push({kind:"gap",text:decodeEscapes(gap)});gap=""}};while(i<source.length){if(source[i]==="\\"&&i+1<source.length&&"[]<>\\".includes(source[i+1])){gap+=source.slice(i,i+2);i+=2;continue}if(notationLetter(source[i])||source[i]==="["||source[i]==="<"){const run=readNotationWord(source,i);if(run){flush();segments.push({kind:"word",raw:run.raw,manual:true,syllables:analyzedNotationWord(run)});i=run.end;continue}if(notationLetter(source[i])){let j=i+1;while(j<source.length&&notationWordChar(source[j]))j++;flush();const raw=source.slice(i,j);segments.push({kind:"word",raw,manual:false,syllables:automaticSyllables(raw)});i=j;continue}}gap+=source[i++]}flush();return{raw:segments.map(seg=>seg.kind==="gap"?seg.text:seg.raw).join(""),source,segments}};
unicodeAnnotatedLine=function(line){return line.segments.map(seg=>{if(seg.kind==="gap")return seg.text;return seg.syllables.map(s=>(s.stress==="strong"?"[":s.stress==="weak"?"<":"")+s.text+(s.stress==="strong"?"]":s.stress==="weak"?">":"")+(s.boundary==="foot"?"│":s.boundary==="caesura"?"‖":"")).join("")}).join("")};

const metricalWeakWords=new Set("a an and as at but by for from he her him his i if in into it its me my nor of on or our she so than that their them then there these they this those through to up us was we were what when where which while who whom whose with you your".split(" "));
const metricalStickyWeak=new Set("a an and but for in into my of on our the their them to us was were with your".split(" "));
function metricalWordKey(raw){return String(raw??"").toLowerCase().replace(/[’']/g,"'").replace(/^[^a-z]+|[^a-z]+$/g,"")}
function contextualizeLineStress(line){
  const entries=[];
  line.segments.forEach(seg=>{
    if(seg.kind!=="word")return;
    const word=metricalWordKey(seg.raw),wordSyllables=seg.syllables.length;
    seg.syllables.forEach(sy=>entries.push({sy,word,wordSyllables,lexical:sy.stress,weakPrior:!sy.manual&&wordSyllables===1&&metricalWeakWords.has(word)}));
  });
  for(const e of entries)if(e.weakPrior)e.sy.stress="weak";
  let iambicScore=0,anchorWeight=0;
  entries.forEach((e,i)=>{
    if(e.sy.manual||e.weakPrior||!e.lexical)return;
    const lexical=e.lexical==="medium"?"strong":e.lexical;
    if(lexical!=="strong"&&lexical!=="weak")return;
    const weight=e.wordSyllables>1?2:1,expected=i%2?"strong":"weak";
    iambicScore+=lexical===expected?weight:-weight;
    anchorWeight+=weight;
  });
  if(anchorWeight>=4&&Math.abs(iambicScore)>=4){
    const iambic=iambicScore>0;
    entries.forEach((e,i)=>{
      if(!e.weakPrior||e.sy.manual||metricalStickyWeak.has(e.word))return;
      const expected=(i%2===1)===iambic?"strong":"weak";
      if(expected==="strong")e.sy.stress="strong";
    });
  }
  return line;
}
const parseTextWithoutMeterContext=parseText;
parseText=function(text){
  const parsed=parseTextWithoutMeterContext(text);
  parsed.stanzas.forEach(st=>st.lines.forEach(contextualizeLineStress));
  return parsed;
};
