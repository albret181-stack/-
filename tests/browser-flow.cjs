// Synthetic UI integration: real video decoding and Stockfish, scripted recognition.
// No user recordings, frames or games are used or uploaded.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const {Chess}=await import('../dist/chess.js');
 const b=new Chess(), key=()=>b.board().flat().map(p=>p?(p.color==='w'?p.type.toUpperCase():p.type):'.').join('');
 const keys=[key()];b.move('e4');b.move('e5');keys.push(key());b.move('Nf3');keys.push(key());
 const browser=await chromium.launch({headless:true});
 try{
 const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:390,height:844}});
 const page=await context.newPage();page.setDefaultTimeout(30000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Only the image classifier is replaced: sequence recovery and UI use production code.
 await context.route('**/recognizer.js',route=>route.fulfill({contentType:'application/javascript',body:`let n=0;const keys=${JSON.stringify(keys)};onmessage=e=>{if(e.data.init){postMessage({ready:true});return}postMessage({key:keys[Math.min(2,Math.floor(n++/5))],errorScore:0})}` }));
 await page.goto('http://127.0.0.1:8765');
 await page.getByText('Начните с вашей партии',{exact:true}).waitFor();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1')||'[]'));
 const startVideo=async()=>{
  if(!await page.locator('#import-dialog').evaluate(e=>e.open))await page.locator('.upload-trigger').click();
  await page.locator('#file-input').setInputFiles('/tmp/chess-synthetic.mp4');
  await page.locator('#import-start').click();
  await page.waitForFunction(()=>document.querySelector('#recognition-continue')||document.querySelector('#import-error').textContent);
  assert.equal(await page.locator('#import-error').innerText(),'','video import error');
  await page.locator('#recognition-continue').waitFor();
  assert.equal(await page.locator('#recognition-review .tag').count(),3);
  assert.match(await page.locator('#recognition-review').innerText(),/Восстановлено 2/);
 };
 await startVideo();
 assert.equal((await saved()).length,0,'preview must not save');
 const downloading=page.waitForEvent('download');await page.locator('#recognized-pgn').click();
 const downloaded=await downloading;const pgn=await fs.readFile(await downloaded.path(),'utf8');
 const exported=new Chess();exported.loadPgn(pgn);assert.deepEqual(exported.history(),['e4','e5','Nf3']);
 await page.locator('#cancel').click();
 await page.waitForFunction(()=>!document.querySelector('#import-start').disabled);
 assert.equal((await saved()).length,0,'cancel must not save');
 assert.equal(await page.locator('#recognition-review').isVisible(),false);
 await startVideo();await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#import-start').disabled);
 assert.equal((await saved()).length,0,'Escape must not save');
 await startVideo();await page.locator('#recognition-continue').click();
 await page.waitForFunction(()=>!document.querySelector('#import-dialog').open,{},{timeout:60000});
 if(await page.locator('#info-dialog').evaluate(e=>e.open))await page.locator('#info-dialog .close').click();
 const games=await saved();assert.equal(games.length,1);assert.equal(games[0].evals.length,4);
 assert.ok(games[0].evals.every(rows=>rows[0]?.depth>0),'real Stockfish must evaluate every position');
 assert.equal(games[0].recoveredCount,2);
 assert.match(await page.locator('#fragment').innerText(),/восстановлено 2/);
 assert.doesNotMatch(await page.locator('#fragment').innerText(),/Возможен пропуск/);
 await page.locator('#return-game').click();
 await page.locator('[data-move="2"]').click();
 assert.match(await page.locator('#position-label').innerText(),/Nf3/);
 await page.locator('#compare-move').click();await page.locator('#return-game').click();
 assert.match(await page.locator('#position-label').innerText(),/Nf3/);
 await page.reload();await page.locator('.game-card').waitFor();
 assert.equal((await saved()).length,1);assert.equal(await page.locator('.game-card').count(),1);
 console.log('PASS: video decode, review, PGN export, cancel, Escape, retry, Stockfish, return to game, persistence (390px viewport)');
 assert.deepEqual(errors,[]);
 await context.close();
 // Deterministic regression: cancel while the final engine position is still running.
 const c2=await browser.newContext({serviceWorkers:'block'});const p2=await c2.newPage();
 await c2.route('**/stockfish-19-lite-single.js',route=>route.fulfill({contentType:'application/javascript',body:`onmessage=e=>{if(e.data==='uci')postMessage('uciok');if(String(e.data).startsWith('go '))setTimeout(()=>{postMessage('info depth 1 score cp 0 pv g1f3');postMessage('bestmove g1f3')},700)}` }));
 await p2.goto('http://127.0.0.1:8765');await p2.getByText('Начните с вашей партии',{exact:true}).waitFor();
 await p2.locator('.upload-trigger').click();
 await p2.locator('#file-input').setInputFiles({name:'synthetic.pgn',mimeType:'application/x-chess-pgn',buffer:Buffer.from('1. e4 e5 *')});
 await p2.locator('#import-start').click();
 await p2.waitForFunction(()=>document.querySelector('#progress-text').textContent.includes('позиция 3 из 3'));
 await p2.locator('#cancel').click();await p2.waitForFunction(()=>!document.querySelector('#import-start').disabled);
 assert.equal(await p2.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1')||'[]').length),0);
 assert.match(await p2.locator('#import-error').innerText(),/остановлена/);
 console.log('PASS: cancel on final engine position prevents saving');
 await c2.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
