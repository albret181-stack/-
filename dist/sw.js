const CACHE='atelier-v0.3.4';
const ASSETS=['./','./index.html','./style.css','./app.js?v=0.3.4','./chess.js','./recognizer.js','./video-sequence.js','./recognition-edit.js','./templates-browser.json','./samples.json','./openings.json','./stockfish-19-lite-single.js','./stockfish-19-lite-single.wasm','./icon.svg','./icon-192.png','./manifest.webmanifest',...['w','b'].flatMap(c=>['p','n','b','r','q','k'].map(p=>'./pieces/'+c+p+'.svg'))];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||e.request.method!=='GET'||u.pathname.endsWith('version.json'))return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)))});
