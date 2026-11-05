import {Chess} from './chess.js';
import {reviewMove} from './move-review.js';
import {editRecognition,replaceRecognizedMove} from './recognition-edit.js';
import {OrientedSequence} from './oriented-sequence.js';
import {RecognitionResume} from './recognition-resume.js';
import {detectBoard} from './board-vision.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],VERSION='0.6.5',BUILD_ID='source';
let games=[],game,selected=0,boardView='played',baseFen='',actualIndex=0,busy=false,cancelled=false,selectedFile=null,engine=null,recognitionDecision=null,resumeCancel=null;
const moveReviews=new WeakMap();
function moveInfo(i){let cache=moveReviews.get(game);if(!cache){cache=new Map();moveReviews.set(game,cache)}if(!cache.has(i))cache.set(i,reviewMove(game,i));return cache.get(i)}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),4000)}
function info(title,html){$('#info-title').textContent=title;$('#info-body').innerHTML=html;$('#info-dialog').showModal()}
function loss(i){return moveInfo(i).loss??0}
function severity(i){return moveInfo(i).grade}
function mine(i){return i%2===(game.color==='white'?0:1)}
function errors(){return game.moves.map((m,i)=>i).filter(i=>mine(i)&&loss(i)>=60)}
function moveLabel(i){return `${Math.floor(i/2)+1}${i%2?'…':'.'} ${game.moves[i]?.san||''}`}
function persist(){try{localStorage.setItem('atelier-games-v1',JSON.stringify(games.filter(g=>!g.id.startsWith('sample-'))))}catch{toast('Недостаточно места: экспортируйте партию в PGN.')}}
function renderGames(){
 $('#count').textContent=games.length;$('#games').innerHTML=games.map((g,i)=>`<button class="game-card ${g===game?'selected':''}" data-game="${i}"><strong>${esc(g.title)}</strong><small>${g.moves.length} полуходов · ${g.color==='white'?'белые':'чёрные'} снизу</small></button>`).join('');
 $$('[data-game]').forEach(b=>b.onclick=()=>{selectGame(games[+b.dataset.game]);$('#game-library').open=false});
}
function selectGame(g){$('#all-moves').open=$('#my-errors').open=false;game=g;selected=errors()[0]??game.moves.findIndex((_,i)=>mine(i));selected=Math.max(0,selected);boardView='played';actualIndex=selected+1;renderGames();render()}
function render(){
 $('#game-title').textContent=game.title;$('#game-title').title=game.title;$('#game-label').textContent=game.id.startsWith('sample')?'ВАША ЗАПИСЬ · 3 НОЯБРЯ 2026':'ЛОКАЛЬНАЯ ПАРТИЯ';
 $('#opening').textContent=`Разбираем ${game.color==='white'?'белых':'чёрных'} · ваши фигуры снизу`;if(Number.isFinite(game.videoDuration)){const found=game.moves.length,last=timeLabel(game.lastMoveTime||0),duration=timeLabel(game.videoDuration),done=game.evals.length+'/'+game.positions.length;$('#fragment').textContent=game.manuallyEdited?`Список исправлен вручную · ${found} полуходов · сверьте полноту с видео`:game.recognitionGaps?.some(g=>g.resolvedAt===null)?`Возможен пропуск после ${timeLabel(game.lastGoodTime||0)} · найдено ${found} полуходов · первый спорный кадр ${timeLabel(game.firstGapTime||0)}.`:`Видео: распознано ${found} полуходов${game.recoveredCount?` · восстановлено ${game.recoveredCount}, проверьте`:''} · последний ход ${last} из ${duration} · Stockfish ${done} позиций`}else $('#fragment').textContent=game.result==='*'?'Фрагмент записи':game.result;
 renderCurrentMove();renderMoves();renderErrors();
 prepareBoard();renderBoard();
}

function detailCard(i){
 const r=moveInfo(i),played=game.moves[i],own=mine(i);
 if(!own)return '<article class="move-detail" id="move-detail"><h3>Ход соперника: '+esc(played.san)+'</h3><p class="move-action">'+esc(r.playedText)+'</p></article>';
 const correction=r.loss>=60&&r.best&&r.best.uci!==played.uci;
 return `<article class="insight-card" id="move-detail"><div class="insight-kicker"><span>ВАШ ХОД ${Math.floor(i/2)+1}</span><span class="classification ${r.loss>=60?'grade-bad':r.loss===null?'grade-neutral':'grade-good'}">${esc(r.grade)}</span></div><h3>Вы сыграли ${esc(played.san)}</h3><p class="move-action">${esc(r.playedText)}</p>${r.playedIdea?`<p class="move-idea">${esc(r.playedIdea)}</p>`:''}<p><b>${r.loss>=60?'Почему ход хуже':'Оценка хода'}</b><br>${esc(r.reason)}</p>${correction?`<h3 class="better-title">Лучше ${esc(r.best.san)}</h3><p class="move-action">${esc(r.bestText)}</p>${r.bestIdea?`<p class="move-idea">${esc(r.bestIdea)}</p>`:''}<p><b>Почему этот ход сильнее</b><br>${esc(r.better)}</p><div class="line-switch"><button data-board-view="played" class="${boardView==='played'?'active':''}">Мой ход ${esc(played.san)}</button><button data-board-view="better" class="${boardView==='better'?'active':''}">Лучший ход ${esc(r.best.san)}</button></div>`:''}</article>`;
}
function bindComparison(){
 $$('[data-board-view]').forEach(b=>b.onclick=()=>{boardView=b.dataset.boardView;render()});
}
function renderCurrentMove(){
 $('#tab-content').innerHTML=actualIndex?detailCard(actualIndex-1):'<article class="insight-card" id="move-detail"><h3>Начальная позиция</h3><p>Нажмите стрелку вправо, чтобы посмотреть первый ход.</p></article>';
 bindComparison();
}
function choosePosition(pos){actualIndex=Math.max(0,Math.min(game.moves.length,pos));selected=actualIndex-1;boardView='played';render()}
function renderErrors(){
 const ids=errors();$('#error-count').textContent=ids.length;
 $('#error-list').innerHTML=ids.map(i=>`<button class="error-chip ${i===selected?'active':''}" data-error="${i}">${moveLabel(i)} · ${esc(severity(i))}</button>`).join('')||'<p class="empty">Заметных ошибок не найдено.</p>';
 $$('[data-error]').forEach(b=>b.onclick=()=>choosePosition(+b.dataset.error+1));
}
function renderMoves(){
 let html='';for(let j=0;j<game.moves.length;j+=2)html+=`<div class="move-row"><span>${j/2+1}.</span>${[j,j+1].map(k=>game.moves[k]?`<button data-move="${k}" class="${mine(k)&&loss(k)>=60?'error ':''}${actualIndex===k+1?'active':''}"><span>${esc(game.moves[k].san)}</span><small class="move-grade">${mine(k)?esc(severity(k)):'Соперник'}</small></button>`:'<span></span>').join('')}</div>`;
 $('#move-list').innerHTML=html;$$('[data-move]').forEach(b=>b.onclick=()=>choosePosition(+b.dataset.move+1));
}
function prepareBoard(){
 const i=actualIndex-1,r=i>=0?moveInfo(i):null;
 baseFen=boardView==='better'&&mine(i)&&r?.loss>=60&&r.best?r.best.fen:game.positions[actualIndex]||game.positions[0];
}
function renderBoard(){
 const i=actualIndex-1,r=i>=0?moveInfo(i):null,flipped=game.color==='black',b=new Chess(baseFen),lastMove=boardView==='better'&&mine(i)&&r?.loss>=60?r.best?.uci:game.moves[i]?.uci;
 const bestShown=boardView==='better'&&mine(i)&&r?.loss>=60&&!!r.best;$('#board-wrap').classList.toggle('showing-best',bestShown);
 let html='';for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  let file=flipped?7-c:c,rank=flipped?r:7-r,sq='abcdefgh'[file]+(rank+1),p=b.get(sq);
  html+=`<div class="square ${(r+c)%2?'dark':''} ${lastMove&&(lastMove.slice(0,2)===sq||lastMove.slice(2,4)===sq)?bestShown?(lastMove.slice(2,4)===sq?'best-to':'best-from'):'highlight':''} ${bestShown&&moveInfo(i).bestThreats.some(t=>t.square===sq)?'threat-square':''}" data-square="${sq}" aria-label="${sq}${p?' '+p.color+p.type:''}">${c===0?`<span class="rank">${rank+1}</span>`:''}${r===7?`<span class="file">${'abcdefgh'[file]}</span>`:''}${p?`<img src="pieces/${p.color}${p.type}.svg" alt="" draggable="false">`:''}</div>`
 }$('#board').innerHTML=html;
 $('#top-player').textContent=flipped?'Белые':'Чёрные';$('#bottom-player').textContent=flipped?'Чёрные':'Белые';
 $('#bottom-player').textContent+=(flipped===(game.color==='black'))?' · вы':' · соперник';$('#top-player').textContent+=(flipped===(game.color==='black'))?' · соперник':' · вы';
 $('#eval-label').hidden=!bestShown;$('#eval-label').textContent=bestShown?'✓ Лучший ход':'';
 const label=i>=0?moveLabel(i):'';
 $('#position-label').textContent=boardView==='better'&&mine(i)&&r?.loss>=60&&r.best?`Лучший ход: ${r.bestText} (${r.best.san}) · только один ход`:i>=0?`Партия · после ${label}`:'Начальная позиция';
 const pos=actualIndex;
 $('#prev').disabled=$('#first').disabled=pos===0;$('#next').disabled=$('#last').disabled=pos>=game.moves.length;
}
function advance(d){choosePosition(actualIndex+d)}
document.addEventListener('click',e=>{const menu=$('#game-library');if(menu.open&&!menu.contains(e.target))menu.open=false});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#game-library').open){$('#game-library').open=false;$('#game-library summary').focus()}});
$('#prev').onclick=()=>advance(-1);$('#next').onclick=()=>advance(1);$('#first').onclick=()=>choosePosition(0);$('#last').onclick=()=>choosePosition(game.moves.length);
$$('dialog .close').forEach(b=>b.onclick=()=>{if(b.closest('dialog').id==='import-dialog'&&busy){cancelled=true;recognitionDecision?.(false);return}b.closest('dialog').close()});
$('#import-dialog').addEventListener('cancel',e=>{if(busy){e.preventDefault();cancelled=true;recognitionDecision?.(false)}});
$$('.upload-trigger').forEach(b=>b.onclick=()=>$('#import-dialog').showModal());
$('#export').onclick=()=>{const b=new Chess();game.moves.forEach(m=>b.move(m.uci));download(b.pgn(),'party.pgn','application/x-chess-pgn')};
function download(data,name,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('#about').onclick=()=>info('Разбор ошибок',`<p>Приложение разбирает ходы стороны снизу записи. Цвет и ориентация видео определяются автоматически. Для PGN выберите свою сторону при добавлении партии.</p><p>У каждой ошибки — сыгранный ход, причина ухудшения и один более сильный ход. Длинные варианты не строятся. Если конкретная причина не установлена, приложение сообщает об этом.</p><p>Видео и партии обрабатываются на устройстве. Для установки: Safari → «Поделиться» → «На экран Домой». Сохраняйте важные партии в PGN.</p>`);
$('#bell').onclick=async()=>{try{const v=await fetch('./version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()),current=v.build?v.build===BUILD_ID:v.version===VERSION,latest=`${esc(v.version||VERSION)}${v.build?' · сборка '+esc(v.build):''}`;info('Обновления',`<p>Установлена версия <b>${VERSION}</b>${BUILD_ID!=='source'?' · сборка '+esc(BUILD_ID):''}.</p><p>${current?'Это последняя версия из GitHub.':'В GitHub доступно обновление: '+latest+'.'}</p>${current?'':'<button id="update-now" class="primary">Обновить приложение</button>'}<p>Колокольчик проверяет опубликованную версию GitHub Pages. Ваши партии остаются на устройстве.</p>`);if($('#update-now'))$('#update-now').onclick=async()=>{const btn=$('#update-now');btn.disabled=true;btn.textContent='Обновляем…';try{const reg=await navigator.serviceWorker?.getRegistration();if(reg){const changed=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Обновление ещё не установлено. Проверьте интернет и повторите попытку.')),30000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve()},{once:true})});await reg.update();await changed}location.reload()}catch(e){btn.disabled=false;btn.textContent='Повторить обновление';toast(e.message||'Не удалось установить обновление. Попробуйте ещё раз.')}}}catch{info('Обновления',`<p>Версия ${VERSION}. Не удалось связаться с GitHub Pages. Проверьте интернет и попробуйте ещё раз.</p>`)}};
class Engine{
 constructor(){this.worker=new Worker('./stockfish-19-lite-single.js');this.ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Движок не загрузился. Проверьте соединение и повторите.')),30000);this.worker.onerror=()=>{clearTimeout(timeout);reject(new Error('Не удалось запустить Stockfish в этом браузере.'));if(this.reject)this.reject(new Error('Движок остановлен.'))};this.worker.onmessage=e=>{const line=String(e.data);if(line==='uciok'){clearTimeout(timeout);this.worker.postMessage('setoption name Hash value 32');resolve()}if(this.handler)this.handler(line)};this.worker.postMessage('uci')})}
 async analyze(fen,ms=700){await this.ready;return new Promise((resolve,reject)=>{const rows={},b=new Chess(fen),sign=b.turn()==='w'?1:-1;const timer=setTimeout(()=>{this.worker.postMessage('stop');reject(new Error('Расчёт занял слишком долго. Повторите.'))},ms+30000);this.reject=reject;this.handler=line=>{if(line.startsWith('info ')&&line.includes(' pv ')&&!/ (lowerbound|upperbound) /.test(line)){const cp=line.match(/score (cp|mate) (-?\d+)/),pv=line.split(' pv ')[1].trim().split(' '),depth=+(line.match(/depth (\d+)/)?.[1]||0),mp=+(line.match(/multipv (\d+)/)?.[1]||1);if(!cp)return;const bb=new Chess(fen),moves=[];for(const uci of pv.slice(0,1)){try{const m=bb.move(uci);moves.push({uci,san:m.san,fen:bb.fen()})}catch{break}}rows[mp]={cp:sign*(cp[1]==='cp'?+cp[2]:(+cp[2]>=0?100000:-100000)),mate:cp[1]==='mate'?sign*+cp[2]:null,depth,line:moves}}
 if(line.startsWith('bestmove')){clearTimeout(timer);this.handler=null;this.reject=null;let out=Object.keys(rows).sort().map(k=>rows[k]);if(!out.length){if(b.isCheckmate())out=[{cp:-sign*100000,mate:0,depth:0,line:[]}];else if(b.isGameOver())out=[{cp:0,mate:null,depth:0,line:[]}];else return reject(new Error('Движок не вернул оценку позиции.'))}resolve(out)}};this.worker.postMessage('setoption name MultiPV value 1');this.worker.postMessage('position fen '+fen);this.worker.postMessage('go movetime '+ms)})}
}
async function getEngine(){if(!engine)engine=new Engine();try{await engine.ready;return engine}catch(e){engine?.worker.terminate();engine=null;throw e}}
let importMode='file';
function updateImport(){const textMode=importMode==='text';$('#import-dialog .support-note').hidden=textMode||/\.pgn$/i.test(selectedFile?.name||'');$('#file-source').hidden=textMode;$('#text-source').hidden=!textMode;$('#pgn-side-field').hidden=!textMode&&!/\.pgn$/i.test(selectedFile?.name||'');$('#mode-file').setAttribute('aria-pressed',String(!textMode));$('#mode-text').setAttribute('aria-pressed',String(textMode));$('#import-start').disabled=busy||!(textMode?$('#pgn-text').value.trim():selectedFile);$('#import-start').textContent=textMode||/\.pgn$/i.test(selectedFile?.name||'')?'Разобрать партию':'Распознать и разобрать'}
$('#mode-file').onclick=()=>{importMode='file';$('#import-error').textContent='';updateImport()};
$('#mode-text').onclick=()=>{importMode='text';$('#import-error').textContent='';updateImport();$('#pgn-text').focus()};
$('#pgn-text').oninput=()=>{$('#import-error').textContent='';updateImport()};
$('#file-input').onchange=e=>{selectedFile=e.target.files[0]||null;$('#file-name').textContent=selectedFile?`${selectedFile.name} · ${(selectedFile.size/1048576).toFixed(1)} МБ`:'';$('#import-error').textContent='';updateImport()};
$('#cancel').onclick=()=>{if(resumeCancel){resumeCancel();return}cancelled=true;recognitionDecision?.(false);$('#progress-text').textContent='Останавливаем обработку…'};
function timeLabel(t){if(!Number.isFinite(+t))return '—';return `${Math.floor(+t/60)}:${String(Math.floor(+t%60)).padStart(2,'0')}`}
function progress(value,text){$('#progress').value=value;$('#progress-text').textContent=text}
function checkCancel(){if(cancelled)throw new Error('Обработка остановлена. Исходный файл не изменён.')}
async function seek(video,t){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(new Error('Не удалось прочитать кадр видео. Попробуйте MP4 с кодеком H.264.'))},10000);const cleanup=()=>{clearTimeout(timeout);video.removeEventListener('seeked',done)};const done=()=>{cleanup();resolve()};video.addEventListener('seeked',done);if(Math.abs(video.currentTime-t)<.001&&video.readyState>=2){cleanup();resolve()}else video.currentTime=t})}
async function recognizeVideo(file,color,options={}){
 const ensureActive=()=>{checkCancel();if(options.isStopped?.())throw new Error('Продолжение остановлено. Правки сохранены.')};
 const v=$('#import-video'),url=URL.createObjectURL(file);let worker=null;
 try{
 await new Promise((resolve,reject)=>{const tm=setTimeout(()=>reject(new Error('Не удалось открыть видео.')),20000);v.onloadeddata=()=>{clearTimeout(tm);resolve()};v.onerror=()=>{clearTimeout(tm);reject(new Error('Формат видео не поддерживается браузером.'))};v.src=url;v.load()});
 if(!Number.isFinite(v.duration)||v.duration<1)throw new Error('Не удалось определить длительность видео.');
 if(!v.videoWidth||!v.videoHeight)throw new Error('Не удалось определить размер кадра.');
 if(v.duration>1200)throw new Error('В первой версии поддерживаются записи до 20 минут.');
 worker=new Worker('./recognizer.js',{type:'module'});let readyResolve,readyReject;const ready=new Promise((a,b)=>{readyResolve=a;readyReject=b});worker.onmessage=e=>{if(e.data.ready)readyResolve();else if(e.data.error)readyReject(new Error(e.data.error))};worker.onerror=()=>readyReject(new Error('Не удалось загрузить распознавание.'));worker.postMessage({init:true});let readyTimer;try{await Promise.race([ready,new Promise((_,reject)=>{readyTimer=setTimeout(()=>reject(new Error('Распознаватель не загрузился. Повторите импорт.')),20000)})])}finally{clearTimeout(readyTimer)};
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true}),sequence=options.resume||new OrientedSequence();let totalBoard=0,pendingMismatch=0,pendingMismatchStart=0;const recognitionGaps=[];let rect=null,plausibleFrames=0;const scan=document.createElement('canvas');scan.width=Math.min(768,v.videoWidth);scan.height=Math.round(v.videoHeight*scan.width/v.videoWidth);const scanCtx=scan.getContext('2d',{willReadFrequently:true});
 const classify=data=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Распознавание кадра не ответило. Повторите импорт.')),10000);worker.onmessage=e=>{clearTimeout(timer);e.data.error?reject(new Error(e.data.error)):resolve(e.data)};worker.onerror=()=>{clearTimeout(timer);reject(new Error('Ошибка обработки кадра.'))};worker.postMessage({pixels:data.data.buffer},[data.data.buffer])});
 for(let t=options.resume?.time||0;t<v.duration-.05;t+=.2){ensureActive();await seek(v,t);if(!rect){scanCtx.drawImage(v,0,0,scan.width,scan.height);const found=detectBoard(scanCtx.getImageData(0,0,scan.width,scan.height));if(found){const scale=v.videoWidth/scan.width;rect={x:found.x*scale,y:found.y*scale,width:found.width*scale,height:found.height*scale}}else{if(Math.round(t*5)%10===0)progress(5+50*t/v.duration,`Ищем зелёную доску · ${timeLabel(t)} / ${timeLabel(v.duration)}`);continue;}}ctx.drawImage(v,rect.x,rect.y,rect.width,rect.height,0,0,256,256);const r=await classify(ctx.getImageData(0,0,256,256));
 if(r.errorScore<.025)totalBoard++;
 const observation=sequence.observe({...r,t});if(observation.status!=='uncertain')plausibleFrames++;
 if(['same','replay'].includes(observation.status))pendingMismatch=0;
 else if(['move','recovered'].includes(observation.status)){
  if(pendingMismatch>=3||observation.status==='recovered')recognitionGaps.push({after:observation.after,firstSeen:pendingMismatch?pendingMismatchStart:t,frames:pendingMismatch,resolvedAt:+t.toFixed(1),recovered:observation.status==='recovered'});
  pendingMismatch=0;
 }else if(observation.status==='unmatched'){if(!pendingMismatch)pendingMismatchStart=t;pendingMismatch++}
 if(Math.round(t*5)%10===0)progress(5+50*t/v.duration,`Распознавание ${timeLabel(t)} / ${timeLabel(v.duration)} · ${sequence.moves.length} полуходов`);
 }
 ensureActive();
 const {moves,lastTime}=sequence;
 if(pendingMismatch>=3)recognitionGaps.push({after:lastTime,firstSeen:pendingMismatchStart,frames:pendingMismatch,resolvedAt:null});
 if(!rect)throw new Error('Не удалось найти зелёную доску Chess.com в кадре. Проверьте, что доска видна целиком и не перекрыта. Другие темы пока не поддерживаются.');
 if(options.resume&&!sequence.anchored)throw new Error('Не удалось подтвердить выбранную позицию на видео.');
 if(!moves.length)throw new Error(options.resume?'Позиция подтверждена, но новых ходов не найдено. Список ходов оставлен без изменений.':plausibleFrames?'Доска найдена, но позиции не удалось связать с началом партии. Проверьте наличие первых ходов; можно загрузить PGN.':'Доска найдена, но фигуры не удалось уверенно распознать. Попробуйте исходную запись без сжатия или импорт PGN.');
 const gap=recognitionGaps.find(g=>g.resolvedAt===null)||null,recoveredCount=moves.filter(m=>m.recovered).length;
 const recognitionWarning=gap?`Не удалось связать распознанные позиции после ${timeLabel(gap.after)}; первый спорный кадр — ${timeLabel(gap.firstSeen)}. Партия может быть распознана не полностью.`:recoveredCount?`Восстановлено ${recoveredCount} полуходов по единственной легальной последовательности. Сверьте отмеченные ходы с записью.`:null;
 const result=sequence.board.isCheckmate()?(sequence.board.turn()==='w'?'0-1':'1-0'):'*';
 return {moves,orientation:sequence.orientation,boardRect:rect,duration:v.duration,result,recognitionWarning,lastTime,firstGapTime:gap?.firstSeen??null,lastGoodTime:gap?.after??lastTime,recognitionGaps,stableBoardFrames:totalBoard,recoveredCount};
 }finally{worker?.terminate();v.removeAttribute('src');v.load();URL.revokeObjectURL(url)}
}
async function reviewRecognition(data,file,color,original=structuredClone(data)){
 let restart=false,reviewClosed=false,pendingExit=false;
 const box=$('#recognition-review');box.hidden=false;
 const pgn=new Chess(),positions=[pgn.fen()];data.moves.forEach(m=>{pgn.move(m.uci);positions.push(pgn.fen())});
 box.innerHTML=`<p class="subtle">Доска найдена автоматически · ${data.orientation==='black'?'чёрные':'белые'} снизу. Разбираем ошибки этой стороны.</p>${data.resumedFrom?`<p>Продолжено после ${data.resumedFrom.index} полуходов с ${timeLabel(data.resumedFrom.time)}.</p>`:''}<h3>${data.manuallyEdited?'После исправления:':'Найдено'} ${data.moves.length} полуходов</h3><p>Видео просмотрено до ${timeLabel(data.duration)}. ${data.manuallyEdited?'Время изменённых ходов не определено.':`Последний найденный ход — ${timeLabel(data.lastTime)}.`}</p><p>${data.result==='*'?'Конец партии по правилам шахмат не подтверждён: запись может содержать только часть игры. Долгое отсутствие новых ходов само по себе не означает пропуск.':'На последней восстановленной позиции — мат.'}</p>${data.recognitionWarning?`<p role="alert">${esc(data.recognitionWarning)}</p>`:''}<p>Проверьте список перед расчётом Stockfish. Звёздочкой отмечены восстановленные полуходы; их точное время внутри пропуска неизвестно.</p><div class="recognition-compare"><div><div id="recognition-board" class="board" aria-label="Распознанная позиция"></div><p id="recognition-position" role="status"></p><button id="recognition-board-edit" class="secondary" type="button">Исправить этот ход на доске</button><div id="recognition-board-editor" hidden><p id="board-edit-status" role="status"></p><div id="board-promotion"></div><button id="board-edit-apply" class="secondary" type="button" disabled>Применить исправление</button><button id="board-edit-cancel" class="text-btn" type="button">Отменить исправление</button></div><div class="recognition-controls"><button id="recognition-start" type="button">Начало</button><button id="recognition-prev" type="button" aria-label="Предыдущий распознанный ход">←</button><button id="recognition-next" type="button" aria-label="Следующий распознанный ход">→</button></div></div><div><video id="recognition-video" controls muted playsinline preload="metadata" aria-label="Исходная запись"></video><p class="subtle">Сверьте доску с записью. Выбор хода перемещает видео к моменту распознавания. Для восстановленного хода время приблизительное.</p><details id="recognition-resume-panel"><summary>Продолжить распознавание с выбранного хода</summary><p>Выберите ход в списке. Затем найдите на видео позицию сразу после этого хода и поставьте запись на паузу. Сохранённое начало останется, новое продолжение заменит последующие ходы только после подтверждения.</p><p id="resume-position"></p><button id="recognition-resume" class="secondary" type="button" disabled>Распознать от текущего кадра</button><button id="resume-stop" class="text-btn" type="button" hidden>Остановить продолжение</button><p id="resume-status" role="status"></p><div id="resume-moves" class="line-moves" style="max-height:160px;overflow:auto"></div><button id="resume-apply" class="secondary" type="button" hidden>Применить продолжение</button><button id="resume-discard" class="text-btn" type="button" hidden>Оставить прежний список</button></details></div></div><div class="line-moves" style="max-height:220px;overflow:auto">${data.moves.map((m,i)=>`<button type="button" class="tag" data-recognition-move="${i+1}">${Math.floor(i/2)+1}${i%2?'…':'.'} ${esc(m.san)}${m.recovered?' *':''}</button>`).join(' ')}</div><details id="recognition-editor"><summary>Исправить список ходов</summary><label class="field" for="recognition-pgn">Ходы партии в шахматной записи (PGN)</label><textarea id="recognition-pgn" rows="6" spellcheck="false"></textarea><p class="subtle">Например: 1. e4 e5 2. Nf3. Исправьте ход и при необходимости последующее продолжение. Изменения применятся только после проверки.</p><p id="recognition-edit-error" role="alert"></p><button id="recognition-apply" class="secondary" type="button">Проверить и применить</button><button id="recognition-reset" class="text-btn" type="button">Вернуть исходное распознавание</button></details><button id="recognized-pgn" class="secondary" type="button">Скачать найденные ходы · PGN</button><button id="recognition-continue" class="primary" type="button">Разобрать ${data.moves.length} полуходов</button>`;

 const video=$('#recognition-video'),videoURL=URL.createObjectURL(file);let position=0,boardEditing=false,fromSquare=null,proposal=null,resumeProposal=null,resuming=false;
 const showPosition=()=>{
  const board=new Chess(boardEditing?(proposal?.replacementFen||positions[position-1]):positions[position]),move=data.moves[position-1],flip=(data.orientation||color)==='black';let html='';
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
   const square='abcdefgh'[flip?7-c:c]+(flip?r+1:8-r),piece=board.get(square),highlight=move&&(move.uci.slice(0,2)===square||move.uci.slice(2,4)===square);
   html+=`<div class="square ${(r+c)%2?'dark':''} ${highlight?'highlight':''}" data-square="${square}" aria-label="${square}${piece?' '+piece.color+piece.type:''}">${piece?`<img src="pieces/${piece.color}${piece.type}.svg" alt="" draggable="false">`:''}</div>`;
  }
  $('#recognition-board').innerHTML=html;
  $('#recognition-position').textContent=position?`${Math.floor((position-1)/2)+1}${position%2?'.':'…'} ${move.san} · ${position} из ${data.moves.length}${move.manualEdited?' · изменён вручную, время неизвестно':move.recovered?' · восстановлен, проверьте по видео':''}`:'Начальная позиция';
  $('#resume-position').textContent=position?`Сохранить первые ${position} полуходов. Заменить последующие ${data.moves.length-position}.`:'Сначала выберите ход в списке.';
  $('#recognition-resume').disabled=boardEditing||resuming||!!resumeProposal||position===0||$('#recognition-continue').disabled;
  $('#recognition-prev').disabled=$('#recognition-start').disabled=boardEditing||position===0;$('#recognition-next').disabled=boardEditing||position===data.moves.length;$('#recognition-board-edit').disabled=boardEditing||position===0||$('#recognition-continue').disabled;
  $$('[data-recognition-move]').forEach(b=>{b.disabled=boardEditing;b.setAttribute('aria-pressed',String(+b.dataset.recognitionMove===position))});
  if(boardEditing){const legal=new Chess(positions[position-1]).moves({verbose:true});$$('#recognition-board .square').forEach(cell=>{const sq=cell.dataset.square;cell.setAttribute('role','button');cell.tabIndex=0;cell.classList.toggle('edit-selected',sq===fromSquare);cell.classList.toggle('edit-target',!!fromSquare&&legal.some(m=>m.from===fromSquare&&m.to===sq));cell.onclick=()=>chooseSquare(sq);cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseSquare(sq)}}})}
  video.pause();if(video.readyState>=1&&(!move||Number.isFinite(move.time)))video.currentTime=Math.min(move?.time||0,video.duration||data.duration);
 };

 const lockEditor=locked=>{
  $('#recognition-continue').disabled=$('#recognized-pgn').disabled=locked;
  $('#recognition-pgn').disabled=$('#recognition-apply').disabled=locked;
  $('#recognition-reset').disabled=locked||!data.manuallyEdited&&!data.resumedFrom;
  $('#recognition-board-editor').hidden=!locked;
 };
 const propose=move=>{
  proposal=replaceRecognizedMove(original,data,position-1,move.from+move.to+(move.promotion||''));
  $('#board-edit-status').textContent=`Новый ход: ${move.san}. ${proposal.dropped?`Следующие ${proposal.dropped} полуходов не подходят и будут убраны. Сверьте оставшуюся партию с видео.`:'Продолжение остаётся легальным; сверьте его с записью.'}`;
  $('#board-edit-apply').textContent=proposal.dropped?`Применить и убрать ${proposal.dropped} полуходов`:'Применить исправление';
  $('#board-edit-apply').disabled=false;$('#board-promotion').innerHTML='';showPosition();
 };
 const chooseSquare=square=>{
  if(!boardEditing||proposal)return;
  const board=new Chess(positions[position-1]),legal=board.moves({verbose:true}),targets=legal.filter(m=>m.from===fromSquare&&m.to===square);
  if(targets.length>1){$('#board-edit-status').textContent='Выберите фигуру для превращения пешки.';$('#board-promotion').innerHTML=targets.map(m=>`<button type="button" data-promotion="${m.promotion}">${{q:'Ферзь',r:'Ладья',b:'Слон',n:'Конь'}[m.promotion]}</button>`).join('');$$('[data-promotion]').forEach(b=>b.onclick=()=>propose(targets.find(m=>m.promotion===b.dataset.promotion)));return}
  if(targets.length===1){propose(targets[0]);return}
  fromSquare=legal.some(m=>m.from===square)?square:null;$('#board-promotion').innerHTML='';
  $('#board-edit-status').textContent=fromSquare?'Выберите подсвеченную клетку.':'Выберите фигуру стороны, которая ходит.';showPosition();
 };
 $('#recognition-board-edit').onclick=()=>{if(!position)return;boardEditing=true;fromSquare=null;proposal=null;lockEditor(true);$('#board-edit-apply').disabled=true;$('#board-edit-status').textContent='Позиция перед выбранным ходом. Выберите фигуру, затем клетку.';showPosition()};
 $('#board-edit-cancel').onclick=()=>{boardEditing=false;fromSquare=null;proposal=null;$('#board-promotion').innerHTML='';lockEditor(false);showPosition()};
 $('#board-edit-apply').onclick=()=>{if(!proposal)return;Object.assign(data,proposal.data);data.manuallyEdited=!!proposal.data.manuallyEdited;recognitionDecision?.('edit')};
 video.onloadedmetadata=showPosition;video.src=videoURL;
 $$('[data-recognition-move]').forEach(b=>b.onclick=()=>{position=+b.dataset.recognitionMove;showPosition()});
 $('#recognition-start').onclick=()=>{position=0;showPosition()};
 $('#recognition-prev').onclick=()=>{position=Math.max(0,position-1);showPosition()};
 $('#recognition-next').onclick=()=>{position=Math.min(data.moves.length,position+1);showPosition()};showPosition();
 $('#recognition-pgn').value=pgn.pgn();$('#recognition-reset').disabled=!data.manuallyEdited&&!data.resumedFrom;
 $('#recognition-pgn').oninput=()=>{$('#recognition-resume').disabled=true;$('#recognition-board-edit').disabled=true;$('#recognition-continue').disabled=true;$('#recognized-pgn').disabled=true;$('#recognition-reset').disabled=false;$('#recognition-edit-error').textContent='Примените правки или верните исходное распознавание перед разбором.'};
 $('#recognition-apply').onclick=()=>{try{const updated=editRecognition(original,$('#recognition-pgn').value);Object.assign(data,updated);data.resumedFrom=updated.resumedFrom;data.manuallyEdited=!!updated.manuallyEdited;recognitionDecision?.('edit')}catch(e){$('#recognition-edit-error').textContent=e.message}};
 $('#recognition-reset').onclick=()=>{Object.assign(data,structuredClone(original));data.resumedFrom=original.resumedFrom;data.manuallyEdited=false;recognitionDecision?.('edit')};
 const resumeLock=locked=>{
  $$('#recognition-review button,#recognition-review textarea').forEach(b=>b.disabled=locked);
  $('#resume-stop').disabled=false;$('#resume-apply').disabled=false;$('#resume-discard').disabled=false;
  video.controls=!locked;
  if(!locked){$('#recognition-reset').disabled=!data.manuallyEdited&&!data.resumedFrom;showPosition()}
 };
 $('#recognition-resume').onclick=async()=>{
  let stopped=false;const stop=()=>{stopped=true};
  try{
   if(video.readyState<2)throw new Error('Дождитесь загрузки кадра видео.');
   video.pause();const resume=new RecognitionResume(data,position,video.currentTime);
   resuming=true;resumeLock(true);resumeCancel=stop;$('#resume-stop').hidden=false;
   $('#resume-status').textContent='Проверяем совпадение выбранной позиции с видео…';
   const tail=await recognizeVideo(file,color,{resume,isStopped:()=>stopped});
   if(reviewClosed||cancelled||stopped)return;
   resumeProposal=resume.finish(tail);
   $('#resume-status').textContent=`Найдено ${tail.moves.length} новых полуходов. Сохранится начало из ${position}; прежние ${data.moves.length-position} последующих полуходов будут заменены. Проверьте новое продолжение после применения; исходное распознавание доступно через сброс.`;
   $('#resume-moves').textContent=tail.moves.map((m,i)=>`${Math.floor((position+i)/2)+1}${(position+i)%2?'…':'.'} ${m.san}`).join(' ');
   $('#resume-apply').hidden=$('#resume-discard').hidden=false;
  }catch(e){if(!reviewClosed&&!cancelled)$('#resume-status').textContent=e.message}
  finally{
   if(resumeCancel===stop)resumeCancel=null;resuming=false;
   if(!reviewClosed){$('#resume-stop').hidden=true;resumeLock(!!resumeProposal);if(resumeProposal)video.controls=true;progress(55,'Проверьте найденные ходы.')}
   if(pendingExit)recognitionDecision?.(false);
  }
 };
 $('#resume-stop').onclick=()=>resumeCancel?.();
 $('#resume-discard').onclick=()=>{resumeProposal=null;$('#resume-apply').hidden=$('#resume-discard').hidden=true;$('#resume-status').textContent='Прежний список сохранён.';$('#resume-moves').textContent='';resumeLock(false)};
 $('#resume-apply').onclick=()=>{if(!resumeProposal)return;Object.assign(data,resumeProposal);recognitionDecision?.('edit')};
 $('#recognized-pgn').onclick=()=>download(pgn.pgn(),'recognized-party.pgn','application/x-chess-pgn');
 progress(55,'Распознавание завершено. Проверьте найденные ходы.');
 try{await new Promise((resolve,reject)=>{recognitionDecision=confirmed=>{if(!confirmed&&resuming){pendingExit=true;resumeCancel?.();return}recognitionDecision=null;restart=confirmed==='edit';confirmed?resolve():reject(new Error('Расчёт отменён. Найденные ходы не добавлены в историю; исходное видео не изменено.'))};$('#recognition-continue').onclick=()=>recognitionDecision?.(true)});checkCancel()}
 finally{reviewClosed=true;resumeCancel?.();resumeCancel=null;recognitionDecision=null;video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(videoURL);box.hidden=true;box.innerHTML=''}
 if(restart)return reviewRecognition(data,file,color,original);
}
$('#import-start').onclick=async()=>{
 if(busy||(importMode==='text'?!$('#pgn-text').value.trim():!selectedFile))return;busy=true;cancelled=false;$('#import-start').disabled=true;$('#file-input').disabled=true;$('#progress-box').hidden=false;$('#import-error').textContent='';const file=importMode==='text'?new File([$('#pgn-text').value.trim()],'Вставленная партия.pgn',{type:'application/x-chess-pgn'}):selectedFile;for(const id of ['mode-file','mode-text','pgn-text','pgn-side'])$('#'+id).disabled=true;let color='white';let wake=null;
 try{try{wake=await navigator.wakeLock?.request('screen')}catch{};let data;progress(1,'Подготавливаем файл…');
 if(/\.pgn$/i.test(file.name)){const b=new Chess();try{b.loadPgn(await file.text())}catch{throw new Error('Не удалось прочитать PGN. Проверьте последовательность ходов.')}const history=b.history({verbose:true});if(!history.length)throw new Error('В PGN нет ходов.');if(history.length>500)throw new Error('В первой версии поддерживается до 500 полуходов.');const initial=history[0].before;if(initial!==new Chess().fen())throw new Error('Пока поддерживается PGN со стандартной начальной позиции.');data={orientation:$('#pgn-side').value,title:b.header().White&&b.header().Black?`${b.header().White} — ${b.header().Black}`:null,moves:history.map(m=>({uci:m.from+m.to+(m.promotion||''),san:m.san})),result:b.header().Result||'*'}}else data=await recognizeVideo(file,color);
 checkCancel();color=data.orientation||'white';if(Number.isFinite(data.duration))await reviewRecognition(data,file,color);const b=new Chess(),positions=[b.fen()];for(const m of data.moves){b.move(m.uci);positions.push(b.fen())}
 if(Number.isFinite(data.duration))progress(55,`Видео распознано: ${data.moves.length} полуходов · последний ход ${timeLabel(data.lastTime)} из ${timeLabel(data.duration)}${data.recognitionWarning?' · есть фрагмент для проверки':''}. Далее оценка Stockfish.`);
 const e=await getEngine(),evals=[];for(let i=0;i<positions.length;i++){checkCancel();progress(56+43*i/positions.length,`Stockfish: позиция ${i+1} из ${positions.length}. Держите приложение открытым.`);evals.push(await e.analyze(positions[i],1500))}
 checkCancel();
 const g={id:'local-'+Date.now(),title:data.title||file.name.replace(/\.[^.]+$/,'').slice(0,55),source:file.name,color,orientation:color,moves:data.moves,positions,evals,result:data.result||'*',engine:'Stockfish 19 Lite',recognitionWarning:data.recognitionWarning,videoDuration:data.duration,lastMoveTime:data.lastTime,firstGapTime:data.firstGapTime,lastGoodTime:data.lastGoodTime,recognitionGaps:data.recognitionGaps,stableBoardFrames:data.stableBoardFrames,recoveredCount:data.recoveredCount,manuallyEdited:data.manuallyEdited,resumedFrom:data.resumedFrom};games.unshift(g);persist();selectGame(g);$('#import-dialog').close();toast('Партия разобрана и сохранена на этом устройстве.');if(data.recognitionWarning)info('Проверьте распознавание видео',`<p>${esc(data.recognitionWarning)}</p><p>Найдено ${data.moves.length} полуходов. Последний подтверждённый ход: ${timeLabel(data.lastTime)} из ${timeLabel(data.duration)}.</p><p>Сверьте отмеченный участок с видео, прежде чем считать разбор полной партией.</p>`);
 }catch(e){$('#import-error').textContent=e.message}finally{busy=false;wake?.release();$('#file-input').disabled=false;for(const id of ['mode-file','mode-text','pgn-text','pgn-side'])$('#'+id).disabled=false;updateImport();$('#progress-box').hidden=true}
};
function renderEmpty(){$('#game-title').textContent='Добавьте партию, чтобы начать';$('#game-label').textContent='РАЗБОР ПАРТИИ';$('#opening').textContent='Загрузите запись экрана или PGN';$('#fragment').textContent='Партии хранятся на этом устройстве';$('#board').innerHTML='';$('#tab-content').innerHTML='<article class="insight-card"><h3>Начните с вашей партии</h3><p>Добавьте запись экрана или PGN кнопкой «＋ Партия».</p></article>';$('#games').innerHTML='';$('#count').textContent='0';$('#eval-label').textContent='—';$('#position-label').textContent='Здесь появится доска с вашей партией';$('#first').disabled=$('#prev').disabled=$('#next').disabled=$('#last').disabled=true}
async function boot(){try{const samples=await fetch('./samples.json').then(r=>r.json());let saved=[];try{saved=JSON.parse(localStorage.getItem('atelier-games-v1')||'[]').filter(g=>g.moves?.length&&g.positions?.length&&g.evals?.length)}catch{}games=[...saved,...samples];if(games.length)selectGame(games[0]);else renderEmpty()}catch(e){$('#game-title').textContent='Не удалось загрузить партии';$('#tab-content').innerHTML='<p>Проверьте интернет и обновите страницу.</p>';console.error(e)}}
boot();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).catch(()=>{});
