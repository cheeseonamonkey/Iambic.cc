"use strict";

const CACHE="iambic-runtime-v5",STAMP="./__iambic_cache_last_used__",TTL=7*24*60*60*1000;
const CORE=["./","./index.html","./css/app.css","./js/analysis/lexicon.js","./js/analysis/stress.js","./js/analysis/syllables.js","./js/prosody.js","./js/notation.js","./js/render.js","./js/ui.js","./data/poems.json"];
const HEAVY=/\.(?:wasm|onnx|bin|data|db|sqlite)$/i;
async function touch(c){await c.put(STAMP,new Response(String(Date.now())))}
async function fresh(c){const r=await c.match(STAMP);return!!r&&Date.now()-Number(await r.text())<TTL}
async function ready(){let c=await caches.open(CACHE);if(!await fresh(c)){await caches.delete(CACHE);c=await caches.open(CACHE)}await touch(c);return c}

self.addEventListener("install",e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(CORE);await touch(c);self.skipWaiting()})()));
self.addEventListener("activate",e=>e.waitUntil((async()=>{
  for(const k of await caches.keys())if(k.startsWith("iambic-")&&k!==CACHE)await caches.delete(k);
  await ready();await self.clients.claim()
})()));
self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
  e.respondWith((async()=>{
    const c=await ready(),url=new URL(e.request.url);
    if(HEAVY.test(url.pathname)){
      const hit=await c.match(e.request);if(hit)return hit;
      const r=await fetch(e.request);if(r.ok)await c.put(e.request,r.clone());return r
    }
    try{const r=await fetch(e.request);if(r.ok)await c.put(e.request,r.clone());return r}
    catch(err){const hit=await c.match(e.request);if(hit)return hit;throw err}
  })())
});
