import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function context(){
  const noop=()=>{};
  const node=()=>({classList:{add:noop,remove:noop,toggle:noop},addEventListener:noop,querySelectorAll:()=>[],setAttribute:noop,append:noop,appendChild:noop,style:{setProperty:noop}});
  const c=vm.createContext({console,setTimeout,clearTimeout,Uint16Array,document:{querySelector:node,querySelectorAll:()=>[],createElement:node}});
  for(const f of ["js/prosody.js","js/notation.js"])vm.runInContext(fs.readFileSync(f,"utf8"),c,{filename:f});
  return c;
}
const run=(c,s)=>vm.runInContext(s,c);

test("partial notation keeps whole-word syllabification",()=>{
  const c=context();
  const got=run(c,`(()=>{const p=parseText("Getting").stanzas[0].lines[0].segments[0],a=parseText("Gett<ing>").stanzas[0].lines[0].segments[0],b=parseText("[Gett]ing").stanzas[0].lines[0].segments[0];return [p.syllables.map(x=>x.text).join("|"),a.syllables.map(x=>x.text).join("|"),a.syllables.map(x=>x.stress).join("|"),b.syllables.map(x=>x.text).join("|"),b.syllables.map(x=>x.stress).join("|")]})()`);
  assert.deepEqual([...got],["Get|ting","Get|ting","|weak","Get|ting","strong|"]);
});

test("punctuation-only runs are not syllables",()=>{
  const c=context();
  const got=run(c,`(()=>{const punct=parseText("wait - what -- ' okay [--]").stanzas[0].lines[0],plain=parseText("wait what okay").stanzas[0].lines[0];return [lineStats(punct).syllables,lineStats(plain).syllables,punct.raw]})()`);
  assert.equal(got[0],got[1]);
  assert.equal(got[2],"wait - what -- ' okay [--]");
});
