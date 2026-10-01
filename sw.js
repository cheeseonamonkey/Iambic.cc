"use strict";
const CACHE="iambic-runtime-v1",STAMP="./__iambic_cache_last_used__",TTL=7*24*60*60*1000;
const CORE=["./","./index.html","./style.css","./app-1.js","./app-2.js","./app-3.js","./poems.json"];
async function touch(cache){await cache.put(STAMP,new Response(String(Date.now()),{headers:{"content-type":"text/plain"}}))}
async function fresh(cache){const r=await cache.match(STAMP);if(!r)return false;return Date.now()-Number(await r.text())<TTL}
self.addEventListener("install",e=>e.waitUntil((async()=>{const c=await caches.open(CACHE);await c.addAll(CORE);await touch(c);self.skipWaiting()})()));
self.addEventListener("activate",e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith("iambic-")&&k!==CACHE)await caches.delete(k);const c=await caches.open(CACHE);if(!await fresh(c)){await caches.delete(CACHE);await caches.open(CACHE)}await touch(await caches.open(CACHE));await self.clients.claim()})()));
self.addEventListener("fetch",e=>{if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;e.respondWith((async()=>{let c=await caches.open(CACHE);if(!await fresh(c)){await caches.delete(CACHE);c=await caches.open(CACHE)}await touch(c);const hit=await c.match(e.request);if(hit)return hit;try{const r=await fetch(e.request);if(r.ok)await c.put(e.request,r.clone());return r}catch(err){if(hit)return hit;throw err}})())});
