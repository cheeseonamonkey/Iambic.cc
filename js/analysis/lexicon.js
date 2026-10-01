"use strict";

const IambicLexicon=(()=>{
  const decoder=new TextDecoder("utf-8");
  const cache=new Map();
  let bytes=null,tokens=[],offsets=null,recordsStart=0,count=0;

  function normalize(word){return String(word??"").replace(/[’]/g,"'").replace(/^'+/,"").toUpperCase()}

  function parse(buffer){
    const next=new Uint8Array(buffer),view=new DataView(buffer);
    const magic=[73,65,77,66,76,88,49,0];
    if(next.length<13||magic.some((b,i)=>next[i]!==b))throw new Error("Invalid Iambic lexicon");
    let p=8;
    count=view.getUint32(p,true);p+=4;
    const tokenCount=next[p++];
    tokens=[];
    for(let i=0;i<tokenCount;i++){
      const len=next[p++];
      tokens.push(decoder.decode(next.subarray(p,p+len)));
      p+=len;
    }
    offsets=new Uint32Array(count+1);
    for(let i=0;i<=count;i++){offsets[i]=view.getUint32(p,true);p+=4}
    recordsStart=p;
    if(recordsStart+offsets[count]>next.length)throw new Error("Truncated Iambic lexicon");
    bytes=next;
    cache.clear();
  }

  function record(i){
    const p=recordsStart+offsets[i],wordLength=bytes[p],phoneCount=bytes[p+1],wordStart=p+2,phoneStart=wordStart+wordLength;
    return {
      word:decoder.decode(bytes.subarray(wordStart,phoneStart)),
      phones:Array.from(bytes.subarray(phoneStart,phoneStart+phoneCount),id=>tokens[id])
    };
  }

  function lookup(word){
    if(!bytes)return null;
    const key=normalize(word);
    if(!key)return null;
    if(cache.has(key))return cache.get(key);
    let lo=0,hi=count-1;
    while(lo<=hi){
      const mid=(lo+hi)>>1,r=record(mid),cmp=r.word.localeCompare(key,"en");
      if(cmp===0){
        if(cache.size>512)cache.delete(cache.keys().next().value);
        cache.set(key,r.phones);
        return r.phones;
      }
      if(cmp<0)lo=mid+1;else hi=mid-1;
    }
    cache.set(key,null);
    return null;
  }

  async function load(url="./assets/pronunciations.bin"){
    const response=await fetch(url,{cache:"default"});
    if(!response.ok)throw new Error(`Lexicon HTTP ${response.status}`);
    parse(await response.arrayBuffer());
    return true;
  }

  return {load,lookup,get ready(){return !!bytes}};
})();
