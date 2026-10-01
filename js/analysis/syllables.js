"use strict";

const IambicSyllables=(()=>{
  const vowels="aeiouy";
  const isVowel=ch=>vowels.includes((ch||"").toLowerCase());

  function bestCut(part){
    if(part.length<2)return null;
    let best=null;
    for(let i=1;i<part.length;i++){
      const a=part[i-1],b=part[i];
      if(/['’-]/.test(a)||/['’-]/.test(b))continue;
      const av=isVowel(a),bv=isVowel(b);
      let score=(av!==bv?4:0)+(av&&bv?3:0)-Math.abs(i-part.length/2)*.15;
      if(!av&&bv)score+=2;
      if(!best||score>best.score)best={index:i,score};
    }
    return best;
  }

  function toCount(word,pieces,target){
    if(!Number.isInteger(target)||target<1||target>word.length)return pieces;
    let out=[...pieces];
    while(out.length<target){
      let pick=null;
      for(let i=0;i<out.length;i++){
        const cut=bestCut(out[i]);
        if(cut&&(!pick||cut.score>pick.score))pick={part:i,...cut};
      }
      if(!pick)break;
      const part=out[pick.part];
      out.splice(pick.part,1,part.slice(0,pick.index),part.slice(pick.index));
    }
    while(out.length>target){
      let pick=0,best=Infinity;
      for(let i=0;i<out.length-1;i++){
        const size=out[i].length+out[i+1].length;
        if(size<best){best=size;pick=i}
      }
      out.splice(pick,2,out[pick]+out[pick+1]);
    }
    return out.length===target&&out.join("")===word?out:pieces;
  }

  return {toCount};
})();
