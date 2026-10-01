"use strict";

const IambicStress=(()=>{
  const stressName={0:"weak",1:"strong",2:"medium"};
  function fromPhones(phones){
    if(!phones)return null;
    const out=[];
    for(const phone of phones){
      const m=String(phone).match(/([012])$/);
      if(m)out.push(stressName[m[1]]);
    }
    return out.length?out:null;
  }
  function forWord(word){return typeof IambicLexicon!=="undefined"?fromPhones(IambicLexicon.lookup(word)):null}
  return {forWord,fromPhones};
})();
