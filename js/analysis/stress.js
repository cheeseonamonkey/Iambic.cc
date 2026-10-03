"use strict";

const IambicStress=(()=>{
  const stressName={0:"weak",1:"strong",2:"medium"};
  const curated={
    brillig:["strong","weak"],slithy:["strong","weak"],toves:["strong"],gyre:["strong"],gimble:["strong","weak"],wabe:["strong"],
    mimsy:["strong","weak"],borogoves:["strong","weak","weak"],mome:["strong"],raths:["strong"],outgrabe:["weak","strong"],
    frumious:["strong","weak","weak"],bandersnatch:["strong","weak"],vorpal:["strong","weak"],manxome:["strong","weak"],
    uffish:["strong","weak"],tulgey:["strong","weak"],frabjous:["strong","weak"],callooh:["weak","strong"],callay:["weak","strong"],
    chortled:["strong","weak"],galumphing:["weak","strong","weak"]
  };
  function fromPhones(phones){
    if(!phones)return null;
    const out=[];
    for(const phone of phones){
      const m=String(phone).match(/([012])$/);
      if(m)out.push(stressName[m[1]]);
    }
    return out.length?out:null;
  }
  function lexical(word){return typeof IambicLexicon!=="undefined"?fromPhones(IambicLexicon.lookup(word)):null}
  function forWord(word){
    const raw=String(word??""),direct=lexical(raw);
    if(direct)return direct;
    const key=raw.toLowerCase().replace(/[’']/g,"'");
    if(curated[key])return [...curated[key]];
    if(key.includes("-")){
      const parts=key.split("-").filter(Boolean),out=[];
      if(parts.length>1){
        for(const part of parts){const stress=lexical(part)||curated[part];if(!stress)return null;out.push(...stress)}
        return out.length?out:null;
      }
    }
    return null;
  }
  return {forWord,fromPhones};
})();
