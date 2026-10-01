import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("static entrypoint references files that exist",()=>{const html=fs.readFileSync("index.html","utf8");for(const file of ["style.css","app-1.js","app-2.js","app-3.js"]){assert.ok(html.includes(file),"index.html should reference "+file);assert.ok(fs.existsSync(file),file+" should exist")}});
test("simplified annotation UI has no direct syllable editing controls",()=>{const html=fs.readFileSync("index.html","utf8");for(const obsolete of ["contextBar","wordDialog","syllablesBtn","downloadJsonBtn","newPoemBtn","demoDialog"])assert.equal(html.includes(obsolete),false,"obsolete UI should be gone: "+obsolete);assert.ok(html.includes('data-toggle="structure"'));assert.ok(html.includes("downloadPngBtn"));assert.ok(html.includes("printPdfBtn"))});
test("help documents source-only manual bracket syntax",()=>{const html=fs.readFileSync("index.html","utf8");assert.ok(html.includes("[STRONG]"));assert.ok(html.includes("[VE][ry]"));assert.ok(html.includes("\\["))});
test("poem library has valid required fields and unique title/author pairs",()=>{const poems=JSON.parse(fs.readFileSync("poems.json","utf8"));assert.ok(Array.isArray(poems)&&poems.length>0);const seen=new Set();for(const [i,p] of poems.entries()){for(const key of ["title","author","text","license"])assert.equal(typeof p[key]==="string"&&p[key].trim().length>0,true,`poem ${i}: ${key}`);const id=p.author.trim()+"\\0"+p.title.trim();assert.equal(seen.has(id),false,"duplicate poem: "+p.author+" / "+p.title);seen.add(id)}});
test("custom-domain deployment files agree",()=>{assert.equal(fs.readFileSync("CNAME","utf8").trim(),"iambic.cc");assert.ok(fs.existsSync(".nojekyll"))});
