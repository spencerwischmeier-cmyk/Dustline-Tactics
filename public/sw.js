/* Dustline Tactics service worker: makes the game installable, starts it fast and lets single player run offline.
   The page is fetched fresh whenever there is a connection (so updates arrive at once) and kept for offline use.
   Sounds, voices, music and icons are kept after their first use. Multiplayer (the /ws socket) is never touched. */
const CORE='dl-core-9c8c8bce9a',MEDIA='dl-media-1aeafc467e';
const PRE=['/','/manifest.webmanifest','/icons/icon-192.png','/icons/icon-512.png','/icons/maskable-512.png','/icons/apple-180.png','/icons/fav-64.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CORE).then(c=>c.addAll(PRE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CORE&&k!==MEDIA).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
const isPage=(req,u)=>req.mode==='navigate'||u.pathname==='/'||u.pathname==='/index.html';
/* answer a Range request (the music player asks for parts of a file) from a whole file in the cache */
async function ranged(req,res){const r=req.headers.get('range');if(!r)return res;const m=/bytes=(\d*)-(\d*)/.exec(r);if(!m)return res;const buf=await res.arrayBuffer(),n=buf.byteLength;
 let a=m[1]===''?Math.max(0,n-(+m[2])):+m[1],b=m[1]!==''&&m[2]!==''?Math.min(+m[2],n-1):n-1;if(a>=n||a>b)return new Response(null,{status:416,headers:{'content-range':'bytes */'+n}});
 return new Response(buf.slice(a,b+1),{status:206,headers:{'content-type':res.headers.get('content-type')||'audio/mpeg','content-range':'bytes '+a+'-'+b+'/'+n,'content-length':''+(b-a+1),'accept-ranges':'bytes'}});}
self.addEventListener('fetch',e=>{const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);if(u.origin!==location.origin||u.pathname==='/ws'||u.pathname==='/health'||u.pathname==='/sw.js')return;
 if(isPage(req,u)){e.respondWith((async()=>{try{const net=await fetch(req,{cache:'no-cache'});if(net.ok){const c=await caches.open(CORE);c.put('/',net.clone());}return net;}
   catch(err){const hit=await caches.match('/',{cacheName:CORE});if(hit)return hit;throw err;}})());return;}
 if(/\.(mp3|png|webmanifest)$/.test(u.pathname)){const key=u.origin+u.pathname,media=u.pathname.endsWith('.mp3');
  e.respondWith((async()=>{const c=await caches.open(media?MEDIA:CORE);const hit=await c.match(key);if(hit)return ranged(req,hit);
   if(req.headers.get('range')){/* play from the network now and keep the whole file for next time */e.waitUntil(fetch(key).then(r=>r.ok&&r.status===200?c.put(key,r):0).catch(()=>{}));return fetch(req);}
   const net=await fetch(key);if(net.ok&&net.status===200)e.waitUntil(c.put(key,net.clone()));return net;})());}});
