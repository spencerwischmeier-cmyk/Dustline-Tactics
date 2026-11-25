/* Dustline Tactics - multiplayer server.
   Serves the game's files and relays live messages between players' devices. The host's device still runs the battle;
   this server only passes messages along inside a "room" (everyone in the same room can see each other's open matches).
   Run: npm install && npm start   (PORT defaults to 10000; Render sets it for you) */
const http=require('http'),fs=require('fs'),path=require('path'),zlib=require('zlib');
const {WebSocketServer}=require('ws');
const PORT=+process.env.PORT||10000,ROOT=path.join(__dirname,'public');
const LIM={msgBytes:16384,perSec:60,roomSize:64,rooms:500,presBytes:1024};
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.mp3':'audio/mpeg','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.txt':'text/plain'};
/* ---- files ---- */
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://x');let p=decodeURIComponent(u.pathname);
  if(p==='/health'){res.writeHead(200,{'content-type':'text/plain'});return res.end('ok rooms='+rooms.size+' players='+wss.clients.size);}
  if(p.endsWith('/'))p+='index.html';
  const f=path.normalize(path.join(ROOT,p));if(!f.startsWith(ROOT)){res.writeHead(403);return res.end();}
  fs.stat(f,(e,st)=>{if(e||!st.isFile()){res.writeHead(404,{'content-type':'text/plain'});return res.end('not found');}
    const ext=path.extname(f).toLowerCase(),type=TYPES[ext]||'application/octet-stream',big=ext==='.mp3';
    const fresh=ext==='.html'||ext==='.webmanifest'||p==='/sw.js';const h={'content-type':type,'cache-control':fresh?'no-cache':'public, max-age=86400'};if(p==='/sw.js')h['service-worker-allowed']='/';
    const gz=!big&&/\bgzip\b/.test(req.headers['accept-encoding']||'');
    if(gz){h['content-encoding']='gzip';res.writeHead(200,h);fs.createReadStream(f).pipe(zlib.createGzip()).pipe(res);}
    else{h['content-length']=st.size;res.writeHead(200,h);if(req.method==='HEAD')return res.end();fs.createReadStream(f).pipe(res);}});});
/* ---- rooms ---- */
const rooms=new Map();let nextId=1;
const wss=new WebSocketServer({server,path:'/ws',maxPayload:LIM.msgBytes});
const send=(ws,o)=>{if(ws.readyState===1)ws.send(typeof o==='string'?o:JSON.stringify(o));};
const others=(ws,o)=>{const s=JSON.stringify(o);for(const c of ws.room.members)if(c!==ws)send(c,s);};
wss.on('connection',(ws,req)=>{
  const u=new URL(req.url,'http://x');const name=(u.searchParams.get('room')||'main').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,24)||'main';
  let room=rooms.get(name);if(!room){if(rooms.size>=LIM.rooms){ws.close(1013,'server full');return;}room={name,members:new Set()};rooms.set(name,room);}
  if(room.members.size>=LIM.roomSize){ws.close(1013,'room full');return;}
  /* a device keeps its id when it reconnects, so a match carries on as if nothing happened */
  const want=(u.searchParams.get('id')||'').toLowerCase(),okId=/^[a-z0-9]{6,20}$/.test(want);
  if(okId)for(const c of room.members)if(c.id===want){c.stale=true;room.members.delete(c);try{c.terminate();}catch(e){}}   // its old line, not yet noticed as dropped
  ws.id=okId?want:'p'+(nextId++).toString(36)+Math.random().toString(36).slice(2,6);ws.room=room;ws.pres={};ws.alive=true;ws.tok=LIM.perSec;ws.tt=Date.now();
  room.members.add(ws);
  send(ws,{t:'hello',id:ws.id,peers:[...room.members].filter(c=>c!==ws).map(c=>({peer:c.id,p:c.pres}))});
  others(ws,{t:'pres',from:ws.id,p:ws.pres,join:1});
  ws.on('pong',()=>{ws.alive=true;});
  ws.on('message',buf=>{
    const now=Date.now();ws.tok=Math.min(LIM.perSec,ws.tok+(now-ws.tt)*LIM.perSec/1000);ws.tt=now;if(ws.tok<1)return;ws.tok--;   // over the rate: dropped, like the Claude room
    let m;try{m=JSON.parse(buf);}catch(e){return;}if(!m||typeof m!=='object')return;
    if(m.t==='emit'&&typeof m.topic==='string'&&m.topic.length<=16)others(ws,{t:'emit',topic:m.topic,data:m.data,from:ws.id});
    else if(m.t==='pres'&&m.p&&typeof m.p==='object'){const np=Object.assign({},ws.pres);for(const k in m.p){if(m.p[k]===null)delete np[k];else np[k]=m.p[k];}
      if(JSON.stringify(np).length<=LIM.presBytes){ws.pres=np;others(ws,{t:'pres',from:ws.id,p:np});}}
    else if(m.t==='ping')send(ws,{t:'pong'});});
  ws.on('close',()=>{room.members.delete(ws);if(!ws.stale)others(ws,{t:'bye',from:ws.id});if(!room.members.size)rooms.delete(room.name);});
  ws.on('error',()=>{});});
setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;try{ws.ping();}catch(e){}}},25000);
server.listen(PORT,()=>console.log('Dustline server on port '+PORT));
