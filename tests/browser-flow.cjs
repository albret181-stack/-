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
 let classifierMode="normal";
 const rb=new Chess();rb.move("e4");rb.move("e5");const resumeKeys=[boardKeyLocal(rb)];rb.move("Nc3");resumeKeys.push(boardKeyLocal(rb));rb.move("Nc6");resumeKeys.push(boardKeyLocal(rb));
 function boardKeyLocal(b){return b.board().flat().map(p=>p?(p.color==='w'?p.type.toUpperCase():p.type):'.').join('')}
 // Only the image classifier is replaced: sequence recovery and UI use production code.
 await context.route('**/recognizer.js',route=>{
  const mode=classifierMode,scriptKeys=mode==='normal'?keys:mode==='mismatch'?[keys[0]]:resumeKeys;
  return route.fulfill({contentType:'application/javascript',body:`let n=0;const keys=${JSON.stringify(scriptKeys)};onmessage=e=>{if(e.data.init){postMessage({ready:true});return}const key=keys[Math.min(keys.length-1,Math.floor(n++/${mode==='normal'?5:3}))];setTimeout(()=>postMessage({key,errorScore:0}),${mode==='slow'?200:0})}`});
 });
 await page.goto('http://127.0.0.1:8765');
 await page.getByText('Начните с вашей партии',{exact:true}).waitFor();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1')||'[]'));
 const startVideo=async()=>{
  if(!await page.locator('#import-dialog').evaluate(e=>e.open))await page.locator('.upload-trigger').click();
  await page.locator('#file-input').setInputFiles('/tmp/chess-synthetic.webm');
  assert.equal(await page.locator('#color').count(),0);
  await page.locator('#import-start').click();
  await page.waitForFunction(()=>document.querySelector('#recognition-continue')||document.querySelector('#import-error').textContent);
  assert.equal(await page.locator('#import-error').innerText(),'','video import error');
  await page.locator('#recognition-continue').waitFor();
  assert.equal(await page.locator('#recognition-review .tag').count(),3);
  assert.match(await page.locator('#recognition-review').innerText(),/Восстановлено 2/);
 };
 await startVideo();
 await page.locator('[data-recognition-move="2"]').click();
 await page.locator('#recognition-resume-panel summary').click();
 classifierMode='resume';await page.locator('#recognition-resume').click();
 await page.locator('#resume-apply').waitFor();
 assert.equal(await page.locator('#recognition-review .tag').count(),3,'proposal must preserve old tail until applied');
 await page.locator('#resume-apply').click();
 assert.equal(await page.locator('#recognition-review .tag').count(),4);
 assert.match(await page.locator('[data-recognition-move="3"]').innerText(),/Nc3/);
 await page.locator('#recognition-editor summary').click();await page.locator('#recognition-reset').click();
 assert.equal(await page.locator('#recognition-review .tag').count(),3);
 await page.locator('[data-recognition-move="2"]').click();await page.locator('#recognition-resume-panel summary').click();
 classifierMode='mismatch';await page.locator('#recognition-resume').click();await page.waitForFunction(()=>document.querySelector('#resume-status').textContent.includes('Кадр не совпал'));
 assert.equal(await page.locator('#recognition-review .tag').count(),3);
 classifierMode='slow';await page.locator('#recognition-resume').click();await page.locator('#resume-stop').click();await page.waitForFunction(()=>!document.querySelector('#recognition-resume').disabled);
 assert.equal(await page.locator('#recognition-review .tag').count(),3);assert.equal((await saved()).length,0);
 await page.locator('#recognition-resume').click();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#import-start').disabled);
 assert.equal(await page.locator('#recognition-review').isVisible(),false);assert.equal((await saved()).length,0);classifierMode='normal';await startVideo();

 await page.locator('[data-recognition-move="3"]').click();
 await page.locator('#recognition-board-edit').click();
 assert.equal(await page.locator('#recognition-continue').isDisabled(),true);
 await page.locator('#recognition-board [data-square="b1"]').click();
 await page.locator('#recognition-board [data-square="c3"]').click();
 assert.match(await page.locator('#board-edit-status').innerText(),/Nc3/);
 await page.locator('#board-edit-cancel').click();
 assert.equal(await page.locator('#recognition-board [data-square="f3"]').getAttribute('aria-label'),'f3 wn');
 await page.locator('[data-recognition-move="1"]').click();
 await page.locator('#recognition-board-edit').click();
 await page.locator('#recognition-board [data-square="g1"]').click();
 await page.locator('#recognition-board [data-square="f3"]').click();
 assert.match(await page.locator('#board-edit-apply').innerText(),/убрать 1/);
 assert.equal(await page.locator('#recognition-review .tag').count(),3,'proposal must not change game before confirmation');
 await page.locator('#board-edit-apply').click();
 assert.equal(await page.locator('#recognition-review .tag').count(),2);
 await page.locator('#recognition-editor summary').click();
 await page.locator('#recognition-reset').click();
 await page.locator('#recognition-editor summary').click();
 await page.locator('#recognition-pgn').fill('1. e4 e5 2. Qh9');
 assert.equal(await page.locator('#recognition-continue').isDisabled(),true);
 await page.locator('#recognition-apply').click();
 assert.match(await page.locator('#recognition-edit-error').innerText(),/Не удалось/);
 assert.equal(await page.locator('#recognition-review .tag').count(),3);
 await page.locator('#recognition-pgn').fill('1. d4 d5 2. Nc3 *');
 await page.locator('#recognition-apply').click();
 await page.locator('[data-recognition-move="3"]').click();
 assert.match(await page.locator('#recognition-position').innerText(),/время неизвестно/);
 assert.equal(await page.locator('#recognition-board [data-square="c3"]').getAttribute('aria-label'),'c3 wn');
 await page.locator('#recognition-editor summary').click();
 await page.locator('#recognition-reset').click();
 assert.match(await page.locator('[data-recognition-move="3"]').innerText(),/Nf3/);
 await page.waitForFunction(()=>document.querySelector('#recognition-video').readyState>=1);
 await page.locator('[data-recognition-move="3"]').click();
 assert.equal(await page.locator('#recognition-board [data-square="f3"]').getAttribute('aria-label'),'f3 wn');
 assert.equal(await page.locator('#recognition-next').isDisabled(),true);
 assert.ok(await page.locator('#recognition-video').evaluate(v=>v.currentTime>1));
 await page.locator('#recognition-prev').click();
 assert.match(await page.locator('#recognition-position').innerText(),/восстановлен/);
 await page.locator('#recognition-start').click();
 assert.equal(await page.locator('#recognition-board [data-square="g1"]').getAttribute('aria-label'),'g1 wn');
 assert.equal(await page.locator('#recognition-prev').isDisabled(),true);
 assert.equal((await saved()).length,0,'preview must not save');
 const downloading=page.waitForEvent('download');await page.locator('#recognized-pgn').click();
 const downloaded=await downloading;const pgn=await fs.readFile(await downloaded.path(),'utf8');
 const exported=new Chess();exported.loadPgn(pgn);assert.deepEqual(exported.history(),['e4','e5','Nf3']);
 await page.locator('#cancel').click();
 await page.waitForFunction(()=>!document.querySelector('#import-start').disabled);
 assert.equal((await saved()).length,0,'cancel must not save');
 assert.equal(await page.locator('#recognition-review').isVisible(),false);
 await startVideo();assert.match(await page.locator('#recognition-review').innerText(),/белые снизу/);assert.equal(await page.locator('#recognition-board .square').first().getAttribute('data-square'),'a8');
 await page.locator('[data-recognition-move="1"]').click();await page.locator('#recognition-board-edit').click();
 await page.locator('#recognition-board [data-square="e2"]').click();await page.locator('#recognition-board [data-square="e5"]').click();assert.equal(await page.locator('#board-edit-apply').isDisabled(),true);
 await page.locator('#recognition-board [data-square="e2"]').click();await page.locator('#recognition-board [data-square="e3"]').click();await page.locator('#board-edit-apply').click();
 assert.match(await page.locator('[data-recognition-move="1"]').innerText(),/e3/);
 await page.keyboard.press('Escape');
 await page.waitForFunction(()=>!document.querySelector('#import-start').disabled);
 assert.equal((await saved()).length,0,'Escape must not save');
 await startVideo();
 await page.locator('#recognition-editor summary').click();
 await page.locator('#recognition-pgn').fill('1. e4 e5 2. Nc3 *');
 await page.locator('#recognition-apply').click();
 const editedDownload=page.waitForEvent('download');await page.locator('#recognized-pgn').click();
 const editedPgn=new Chess();editedPgn.loadPgn(await fs.readFile(await (await editedDownload).path(),'utf8'));
 assert.deepEqual(editedPgn.history(),['e4','e5','Nc3']);
 await page.locator('#recognition-continue').click();
 await page.waitForFunction(()=>!document.querySelector('#import-dialog').open,{},{timeout:60000});
 if(await page.locator('#info-dialog').evaluate(e=>e.open))await page.locator('#info-dialog .close').click();
 const games=await saved();assert.equal(games.length,1);assert.equal(games[0].evals.length,4);
 assert.ok(games[0].evals.every(rows=>rows[0]?.depth>0),'real Stockfish must evaluate every position');
 assert.equal(games[0].recoveredCount,2);
 assert.equal(games[0].color,'white');assert.ok(games[0].evals.every(rows=>rows.length===1&&rows[0].line.length<=1),'only one suggested move is stored per position');
 assert.match(await page.locator('#fragment').textContent(),/исправлен вручную/);assert.equal(games[0].manuallyEdited,true);assert.equal(games[0].moves[2].uci,'b1c3');
 assert.doesNotMatch(await page.locator('#fragment').textContent(),/Возможен пропуск/);
 assert.equal(await page.locator('#deeper').count(),0);assert.equal(await page.locator('#line-moves').count(),0);assert.equal(await page.locator('#play').count(),0);assert.equal(await page.locator('#flip').count(),0);
 assert.equal(await page.locator('#all-moves').evaluate(e=>e.open),false);assert.equal(await page.locator('#my-errors').evaluate(e=>e.open),false);assert.equal(await page.locator('.intro,.intro-knight,.tabs').count(),0);
 await page.locator('#first').click();assert.match(await page.locator('#move-detail').innerText(),/Начальная позиция/);assert.equal(await page.locator('#prev').isDisabled(),true);
 await page.locator('#next').click();assert.match(await page.locator('#move-detail').innerText(),/Вы сыграли e4/);
 const scrollBefore=await page.evaluate(()=>scrollY);await page.locator('#next').click();assert.match(await page.locator('#move-detail').innerText(),/Ход соперника: e5/);assert.equal(await page.evaluate(()=>scrollY),scrollBefore);
 await page.locator('#next').click();assert.equal(await page.locator('#all-moves').evaluate(e=>e.open),false);assert.equal(await page.locator('#my-errors').evaluate(e=>e.open),false);assert.equal(await page.locator('#next').isDisabled(),true);
 await page.locator('#all-moves summary').click();await page.locator('[data-move="2"]').click();
 assert.match(await page.locator('#position-label').innerText(),/Nc3/);
 assert.match(await page.locator('#move-detail').innerText(),/Вы сыграли Nc3/);
 assert.match(await page.locator('#bottom-player').innerText(),/Белые · вы/);
 await page.reload();await page.locator('#game-library summary').click();await page.locator('.game-card').waitFor();
 assert.equal((await saved()).length,1);assert.equal(await page.locator('.game-card').count(),1);
 console.log('PASS: video decode, review, PGN export, cancel, Escape, retry, Stockfish, actual moves, persistence (390px viewport)');
 assert.deepEqual(errors,[]);
 await context.close();
 const blackContext=await browser.newContext({serviceWorkers:'block'}),blackPage=await blackContext.newPage();
 const blackKeys=keys.map(key=>[...key].reverse().join(''));
 await blackContext.route('**/recognizer.js',route=>route.fulfill({contentType:'application/javascript',body:`let n=0;const keys=${JSON.stringify(blackKeys)};onmessage=e=>{if(e.data.init){postMessage({ready:true});return}postMessage({key:keys[Math.min(2,Math.floor(n++/5))],errorScore:0})}` }));
 await blackPage.goto('http://127.0.0.1:8765');await blackPage.getByText('Начните с вашей партии',{exact:true}).waitFor();await blackPage.locator('.upload-trigger').click();await blackPage.locator('#file-input').setInputFiles('/tmp/chess-synthetic.webm');await blackPage.locator('#import-start').click();await blackPage.locator('#recognition-continue').waitFor();
 assert.match(await blackPage.locator('#recognition-review').innerText(),/чёрные снизу/);await blackPage.locator('#recognition-continue').click();await blackPage.waitForFunction(()=>JSON.parse(localStorage.getItem('atelier-games-v1')||'[]').length===1);
 assert.equal(await blackPage.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1'))[0].color),'black');assert.match(await blackPage.locator('#bottom-player').innerText(),/Чёрные · вы/);if(await blackPage.locator('#info-dialog').evaluate(e=>e.open))await blackPage.locator('#info-dialog .close').click();
 await blackPage.locator('#first').click();await blackPage.locator('#next').click();assert.match(await blackPage.locator('#move-detail').innerText(),/Ход соперника/);assert.doesNotMatch(await blackPage.locator('#move-detail').innerText(),/Почему ход хуже/);
 console.log('PASS: black-bottom video chooses analysed side automatically');await blackContext.close();

 // A public synthetic game verifies the one-move explanation and board comparison.
 const eb=new Chess(),positions=[eb.fen()],moves=['f3','e5','g4','Qh4#'].map(san=>{const m=eb.move(san);positions.push(eb.fen());return {uci:m.from+m.to+(m.promotion||''),san:m.san}});
 const fixture={id:'local-one-move-test',title:'Synthetic mistake',color:'white',positions,moves,result:'0-1',evals:positions.map(()=>[{cp:0,line:[]}])};fixture.evals[2]=[{cp:-50,line:[{uci:'e2e4'}]}];fixture.evals[3]=[{cp:-100000,mate:-1,line:[{uci:'d8h4'}]}];
 const ec=await browser.newContext({serviceWorkers:'block'}),ep=await ec.newPage();await ec.addInitScript(g=>localStorage.setItem('atelier-games-v1',JSON.stringify([g])),fixture);await ep.goto('http://127.0.0.1:8765');await ep.locator('#move-detail').waitFor();assert.equal(await ep.locator('#all-moves').evaluate(e=>e.open),false);await ep.locator('#my-errors summary').click();await ep.locator('[data-error="2"]').click();
 assert.match(await ep.locator('#move-detail').innerText(),/мат одним ходом — Qh4#/);assert.match(await ep.locator('#move-detail').innerText(),/Почему этот ход сильнее/);assert.match(await ep.locator('#move-detail').innerText(),/не допускает мата в один ход/);assert.equal(await ep.locator('[data-board-view]').count(),2);
 await ep.locator('[data-board-view="better"]').click();assert.match(await ep.locator('#position-label').innerText(),/только один ход/);assert.equal(await ep.locator('#board [data-square="e4"] img').getAttribute('src'),'pieces/wp.svg');assert.equal(await ep.locator('#board [data-square="d8"] img').getAttribute('src'),'pieces/bq.svg');assert.equal(await ep.locator('#board [data-square="h4"] img').count(),0);assert.equal(await ep.locator('#board .best-to').count(),1);assert.equal(await ep.locator('#board .move-arrows').count(),1);assert.equal(await ep.locator('#move-visual-notes').isVisible(),true);assert.equal(await ep.locator('#board .best-from').count(),1);assert.match(await ep.locator('#eval-label').innerText(),/Лучший ход/);assert.match(await ep.locator('#move-detail').innerText(),/Пешка с e2 идёт на e4/);
 const note=ep.locator('[data-visual="0"]');await note.click();assert.equal(await note.getAttribute('aria-pressed'),'true');assert.equal(await ep.locator('#board .visual-selected').count(),1);assert.equal(await ep.locator('#board .concept-square').count(),2);await note.press('Enter');assert.equal(await note.getAttribute('aria-pressed'),'false');assert.equal(await ep.locator('#board').evaluate(e=>e.classList.contains('focused-visual')),false);
 await ep.locator('[data-board-view="played"]').click();assert.equal(await ep.locator('#board [data-square="g4"] img').getAttribute('src'),'pieces/wp.svg');assert.equal(await ep.locator('#board .best-to').count(),0);assert.equal(await ep.locator('#board .move-arrows').count(),0);assert.equal(await ep.locator('#move-visual-notes').isVisible(),false);assert.equal(await ep.locator('#deeper,#line-moves,[data-line],#play,#flip').count(),0);
 for(const width of [1440,1100,900]){
 await ep.setViewportSize({width,height:900});
 const layout=await ep.evaluate(()=>{const board=document.querySelector('#board-wrap').getBoundingClientRect(),detail=document.querySelector('#move-detail'),box=detail.getBoundingClientRect(),grid=document.querySelector('.review-grid').getBoundingClientRect();return {center:Math.abs((grid.left+grid.right)/2-innerWidth/2),left:board.left,right:box.right,level:Math.abs(box.top-board.top),beside:box.left>=board.right,noInnerScroll:detail.scrollHeight<=detail.clientHeight+1,noPageOverflow:document.documentElement.scrollWidth<=innerWidth};});
 assert.ok(layout.center<2);assert.ok(layout.left>=24);assert.ok(layout.right<=width-24);assert.ok(layout.level<2);assert.ok(layout.beside);assert.ok(layout.noInnerScroll);assert.ok(layout.noPageOverflow);
 }
 await ep.setViewportSize({width:320,height:667});assert.equal(await ep.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await ep.locator('#game-library summary').click();assert.equal(await ep.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await ep.keyboard.press('Escape');assert.equal(await ep.locator('#game-library').evaluate(e=>e.open),false);
 await ep.locator('[data-recheck="2"]').click();await ep.waitForFunction(()=>JSON.parse(localStorage.getItem('atelier-games-v1'))[0].comparisons?.[2],null,{timeout:60000});await ep.waitForFunction(()=>!document.querySelector('[data-recheck="2"]').disabled);assert.match(await ep.locator('#move-detail').innerText(),/Оба хода перепроверены/);assert.match(await ep.locator('#move-detail').innerText(),/Вы сыграли g4/);const paired=await ep.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1'))[0].comparisons[2]);assert.equal(paired.played.line[0].uci,'g2g4');assert.equal(paired.best.line[0].uci,'e2e4');assert.equal(paired.method,'equal-nodes-v1');
 await ep.locator('#lesson-summary > summary').click();await ep.locator('#start-training').click();assert.match(await ep.locator('#practice-card').innerText(),/Найдите более сильный ход/);assert.equal(await ep.locator('[data-board-view]').count(),0);assert.equal(await ep.locator('#board [data-practice-square="g2"] img').getAttribute('src'),'pieces/wp.svg');await ep.locator('[data-practice-square="g2"]').click();await ep.locator('[data-practice-square="g5"]').click();assert.match(await ep.locator('#practice-feedback').innerText(),/не может законно/);await ep.locator('[data-practice-square="g4"]').click();await ep.locator('#practice-retry').waitFor();assert.match(await ep.locator('#practice-feedback').innerText(),/мат в один ход/);assert.equal(await ep.locator('#board [data-practice-square="h4"] img').getAttribute('src'),'pieces/bq.svg');await ep.locator('#practice-retry').click();await ep.locator('[data-practice-square="e2"]').click();await ep.locator('[data-practice-square="e4"]').click();assert.match(await ep.locator('#practice-feedback').innerText(),/Верно/);assert.equal(await ep.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1'))[0].training[2].solved),true);await ep.locator('#exit-training').click();assert.match(await ep.locator('#move-detail').innerText(),/Вы сыграли g4/);assert.equal(await ep.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.equal(await ep.locator('header #game-title').count(),1);assert.equal(await ep.locator('main #game-title').count(),0);assert.equal(await ep.locator('#game-title').count(),1);
 console.log('PASS: paired recheck, compact header, practice legality, solution, progress and return');await ec.close();
 // Different legal answers are evaluated rather than rejected by string matching.
 const ac=await browser.newContext({serviceWorkers:'block'}),ap=await ac.newPage();await ac.addInitScript(g=>localStorage.setItem('atelier-games-v1',JSON.stringify([g])),fixture);
 await ac.route('**/stockfish-19-lite-single.js',route=>route.fulfill({contentType:'application/javascript',body:`onmessage=e=>{if(e.data==='uci')postMessage('uciok');if(String(e.data).startsWith('go ')){const move=String(e.data).split('searchmoves ')[1]?.split(' ')[0]||'e2e4';postMessage('info depth 8 score cp 0 pv '+move);postMessage('bestmove '+move)}}`}));
 await ap.goto('http://127.0.0.1:8765');await ap.locator('#lesson-summary > summary').click();await ap.locator('#start-training').click();await ap.locator('[data-practice-square="e2"]').click();await ap.locator('[data-practice-square="e3"]').click();await ap.locator('#practice-next').waitFor();assert.match(await ap.locator('#practice-feedback').innerText(),/Хорошая альтернатива/);await ap.locator('#practice-next').click();assert.match(await ap.locator('#tab-content').innerText(),/Тренировка завершена/);await ap.locator('#exit-training').click();assert.match(await ap.locator('#move-detail').innerText(),/Вы сыграли g4/);await ac.close();
 // Black orientation and pawn promotion are solved on the same accessible board.
 const bb=new Chess(),bp=[bb.fen()],bm=['e4','h6'].map(s=>{const m=bb.move(s);bp.push(bb.fen());return {uci:m.from+m.to,san:m.san}});const blackLesson={id:'local-black-lesson',title:'Synthetic black lesson',color:'black',positions:bp,moves:bm,evals:bp.map(()=>[{cp:0,line:[]}])};blackLesson.evals[1]=[{cp:-100,line:[{uci:'e7e5'}]}];blackLesson.evals[2]=[{cp:200,line:[]}];
 const pb=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1'),pf=pb.fen(),pm=pb.move('Kg1');const promotionLesson={id:'local-promotion-lesson',title:'Synthetic promotion lesson',color:'white',positions:[pf,pb.fen()],moves:[{uci:pm.from+pm.to,san:pm.san}],evals:[[{cp:500,line:[{uci:'a7a8q'}]}],[{cp:0,line:[]}]]};
 for(const [g,from,to,promotion] of [[blackLesson,'e7','e5',false],[promotionLesson,'a7','a8',true]]){const c=await browser.newContext({serviceWorkers:'block',viewport:{width:320,height:667}}),p=await c.newPage();await c.addInitScript(g=>localStorage.setItem('atelier-games-v1',JSON.stringify([g])),g);await p.goto('http://127.0.0.1:8765');await p.locator('#lesson-summary > summary').click();await p.locator('#start-training').click();await p.locator('[data-practice-square="'+from+'"]').click();await p.locator('[data-practice-square="'+to+'"]').click();if(promotion){assert.equal(await p.locator('[data-practice-promotion]').count(),4);await p.locator('[data-practice-promotion="q"]').click()}assert.match(await p.locator('#practice-feedback').innerText(),/Верно/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await c.close()}
 // A failed attempt exposes one verified opponent reply, then restores the puzzle.
 const rc=await browser.newContext({serviceWorkers:'block'}),rp=await rc.newPage();await rc.addInitScript(g=>localStorage.setItem('atelier-games-v1',JSON.stringify([g])),fixture);
 await rc.route('**/stockfish-19-lite-single.js',route=>route.fulfill({contentType:'application/javascript',body:`onmessage=e=>{if(e.data==='uci')postMessage('uciok');if(String(e.data).startsWith('go ')){const forced=String(e.data).split('searchmoves ')[1]?.split(' ')[0],move=forced||'d8h4',cp=forced==='g2g4'?-100000:forced?0:100000;postMessage('info depth 8 score cp '+cp+' pv '+move);postMessage('bestmove '+move)}}`}));
 await rp.goto('http://127.0.0.1:8765');await rp.locator('#lesson-summary > summary').click();await rp.locator('#start-training').click();await rp.locator('[data-practice-square="g2"]').click();await rp.locator('[data-practice-square="g4"]').click();await rp.locator('#practice-retry').waitFor();assert.match(await rp.locator('#practice-feedback').innerText(),/мат в один ход/);assert.equal(await rp.locator('#board [data-practice-square="h4"] img').getAttribute('src'),'pieces/bq.svg');assert.equal(await rp.locator('#board [data-arrow="threat"]').count(),1);await rp.locator('#practice-retry').click();assert.equal(await rp.locator('#board [data-practice-square="g2"] img').getAttribute('src'),'pieces/wp.svg');assert.equal(await rp.locator('#board [data-arrow]').count(),0);await rp.locator('[data-practice-square="e2"]').click();await rp.locator('[data-practice-square="e4"]').click();await rp.locator('#exit-training').click();assert.match(await rp.locator('#lesson-summary-body').innerText(),/К повторению сейчас: 0/);assert.match(await rp.locator('#start-training').innerText(),/Повторить сейчас/);const memory=await rp.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1'))[0].training[2]);assert.equal(memory.streak,1);assert.ok(memory.nextReviewAt>memory.updatedAt);await rc.close();
 // Personal training crosses game boundaries and returns to the original selected move.
 const hc=await browser.newContext({serviceWorkers:'block',viewport:{width:320,height:667}}),hp=await hc.newPage();const historyBlack={...blackLesson,training:{1:{fen:bp[1],bestUci:'e7e5',lastResult:'failed',nextReviewAt:0,updatedAt:Date.now()-1000,attempts:1,streak:0}}};await hc.addInitScript(gs=>localStorage.setItem('atelier-games-v1',JSON.stringify(gs)),[fixture,historyBlack,{...fixture,id:'local-copy-test'}]);
 await hp.goto('http://127.0.0.1:8765');await hp.locator('#my-errors summary').click();await hp.locator('[data-error="2"]').click();await hp.locator('#lesson-summary > summary').click();await hp.locator('#personal-coach > summary').click();await hp.locator('#start-personal-training').waitFor();assert.match(await hp.locator('#personal-coach-body').innerText(),/Партии с доступным разбором: 2/);assert.match(await hp.locator('#personal-coach-body').innerText(),/копии одной партии объединены: 1/);
 await hp.locator('#start-personal-training').click();assert.equal(await hp.locator('#game-title').innerText(),'Synthetic black lesson');assert.equal(await hp.locator('[data-practice-square]').first().getAttribute('data-practice-square'),'h1');await hp.locator('#exit-training').click();assert.equal(await hp.locator('#game-title').innerText(),'Synthetic mistake');assert.match(await hp.locator('#move-detail').innerText(),/Вы сыграли g4/);
 await hp.locator('#start-personal-training').click();await hp.locator('[data-practice-square="e7"]').click();await hp.locator('[data-practice-square="e5"]').click();assert.match(await hp.locator('#practice-feedback').innerText(),/Верно/);await hp.locator('#practice-next').click();assert.equal(await hp.locator('#game-title').innerText(),'Synthetic mistake');assert.equal(await hp.locator('[data-practice-square]').first().getAttribute('data-practice-square'),'a8');await hp.locator('[data-practice-square="e2"]').click();await hp.locator('[data-practice-square="e4"]').click();await hp.locator('#practice-next').click();await hp.locator('#exit-training').click();assert.match(await hp.locator('#move-detail').innerText(),/Вы сыграли g4/);assert.equal(await hp.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);const histories=await hp.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1')));assert.equal(histories[0].training[2].solved,true);assert.equal(histories[1].training[1].solved,true);assert.equal(histories[2].training,undefined);await hc.close();
 console.log('PASS: personal history, deduplication, cross-game practice, orientation, progress ownership and return');
 console.log('PASS: alternatives, promotion, repetition schedule and verified opponent reply with retry');

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
 // Pasted PGN uses the same analysis flow; invalid text stays editable.
 const pc=await browser.newContext({serviceWorkers:'block'}),pp=await pc.newPage();
 await pc.route('**/stockfish-19-lite-single.js',route=>route.fulfill({contentType:'application/javascript',body:`onmessage=e=>{if(e.data==='uci')postMessage('uciok');if(String(e.data).startsWith('go ')){postMessage('info depth 1 score cp 0 pv g1f3');postMessage('bestmove g1f3')}}`}));
 await pp.goto('http://127.0.0.1:8765');await pp.locator('.upload-trigger').click();await pp.locator('#mode-text').click();
 assert.equal(await pp.locator('#import-start').isDisabled(),true);
 await pp.locator('#pgn-text').fill('1. e4 e5 2. Nope');await pp.locator('#import-start').click();await pp.waitForFunction(()=>document.querySelector('#import-error').textContent.includes('PGN'));
 assert.equal(await pp.locator('#pgn-text').inputValue(),'1. e4 e5 2. Nope');assert.equal(await pp.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1')||'[]').length),0);
 await pp.locator('#pgn-text').fill('[White "Synthetic White"]\n[Black "Synthetic Black"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1');await pp.locator('#pgn-side').selectOption('black');await pp.locator('#import-start').click();await pp.waitForFunction(()=>JSON.parse(localStorage.getItem('atelier-games-v1')||'[]').length===1);
 const pasted=await pp.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1'))[0]);assert.equal(pasted.moves.length,4);assert.equal(pasted.color,'black');assert.equal(pasted.title,'Synthetic White — Synthetic Black');assert.equal(pasted.result,'0-1');assert.equal(pasted.positions.length,5);
 { await pp.locator('#game-library').evaluate(e=>e.open=true);
 const beforeBackup=await pp.evaluate(()=>localStorage.getItem('atelier-games-v1'));
 const backupEvent=pp.waitForEvent('download');await pp.locator('#backup-export').click();const backupDownload=await backupEvent;
 const exported=JSON.parse(await fs.readFile(await backupDownload.path(),'utf8'));
 assert.equal(exported.format,'chess-atelier-learning');assert.equal(exported.version,1);assert.deepEqual(exported.games,JSON.parse(beforeBackup));
 assert.equal(await pp.evaluate(()=>localStorage.getItem('atelier-games-v1')),beforeBackup);
 console.log('PASS: full learning backup downloads without altering stored games'); }
 console.log('PASS: pasted PGN validation, metadata, black-side analysis and persistence');await pc.close();
 // Production module worker: an empty board is not a playable game.
 const c3=await browser.newContext({serviceWorkers:'block'}),p3=await c3.newPage();
 await p3.goto('http://127.0.0.1:8765');await p3.getByText('Начните с вашей партии',{exact:true}).waitFor();
 await p3.locator('.upload-trigger').click();await p3.locator('#file-input').setInputFiles('/tmp/chess-synthetic.webm');await p3.locator('#import-start').click();
 await p3.waitForFunction(()=>document.querySelector('#import-error').textContent);
 assert.match(await p3.locator('#import-error').innerText(),/Доска найдена, но фигуры/);
 assert.equal(await p3.evaluate(()=>JSON.parse(localStorage.getItem('atelier-games-v1')||'[]').length),0);
 console.log('PASS: production image worker rejects empty checkerboard without saving');await c3.close();

 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
