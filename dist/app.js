import {Chess} from './chess.js';
import {editRecognition,replaceRecognizedMove} from './recognition-edit.js';
import {OrientedSequence} from './oriented-sequence.js';
import {detectBoard} from './board-vision.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],VERSION='0.3.5',BUILD_ID='source';
let games=[],game,selected=0,tab='errors',lineMode='best',lineIndex=0,step=0,flipped=false,playing=null,currentLine=[],baseFen='',actualIndex=0,openings={},busy=false,cancelled=false,selectedFile=null,engine=null,recognitionDecision=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(s){$('#toast').textContent=s;$('#toast').classList.add('show');setTimeout(()=>$('#toast').classList.remove('show'),4000)}
function info(title,html){$('#info-title').textContent=title;$('#info-body').innerHTML=html;$('#info-dialog').showModal()}
function score(e){if(!e)return '—';return e.mate!=null?'M'+Math.abs(e.mate):(e.cp>=0?'+':'')+(e.cp/100).toFixed(1)}
function loss(i){const before=game.evals[i]?.[0],after=game.evals[i+1]?.[0];if(!before||!after)return 0;return Math.max(0,(before.cp-after.cp)*(i%2===0?1:-1))}
function severity(i){let l=loss(i);return l>=200?'Грубая ошибка':l>=100?'Ошибка':l>=60?'Неточность':l<20?'Сильный ход':'Хороший ход'}
function mine(i){return i%2===(game.color==='white'?0:1)}
function errors(){return game.moves.map((m,i)=>i).filter(i=>mine(i)&&loss(i)>=60)}
function moveLabel(i){return `${Math.floor(i/2)+1}${i%2?'…':'.'} ${game.moves[i]?.san||''}`}
function persist(){try{localStorage.setItem('atelier-games-v1',JSON.stringify(games.filter(g=>!g.id.startsWith('sample-'))))}catch{toast('Недостаточно места: экспортируйте партию в PGN.')}}
function renderGames(){
 $('#count').textContent=games.length;$('#games').innerHTML=games.map((g,i)=>`<button class="game-card ${g===game?'selected':''}" data-game="${i}"><span class="game-icon">${g.color==='white'?'♘':'♞'}</span><span class="game-date">${g.id.startsWith('sample')?'ВАША ЗАПИСЬ':'ИМПОРТ'}</span><strong>${esc(g.title)}</strong><small>${g.moves.length} полуходов · ${g.color==='white'?'белые':'чёрные'}</small><span class="game-badge">${g.opening?esc(g.opening.name.split(':')[0]):'Без совпадения в базе дебютов'}</span></button>`).join('');
 $$('[data-game]').forEach(b=>b.onclick=()=>selectGame(games[+b.dataset.game]));
}
function selectGame(g){stopPlay();game=g;selected=errors()[0]??game.moves.findIndex((_,i)=>mine(i));selected=Math.max(0,selected);flipped=g.color==='black';lineMode='best';lineIndex=0;step=0;actualIndex=selected;renderGames();render()}
function render(){
 $('#game-title').textContent=game.title;$('#game-label').textContent=game.id.startsWith('sample')?'ВАША ЗАПИСЬ · 3 НОЯБРЯ 2026':'ЛОКАЛЬНАЯ ПАРТИЯ';
 $('#opening').textContent=game.opening?`${game.opening.eco} · ${game.opening.name}`:'Дебют не найден в базе';if(Number.isFinite(game.videoDuration)){const found=game.moves.length,last=timeLabel(game.lastMoveTime||0),duration=timeLabel(game.videoDuration),done=game.evals.length+'/'+game.positions.length;$('#fragment').textContent=game.manuallyEdited?`Список исправлен вручную · ${found} полуходов · сверьте полноту с видео`:game.recognitionGaps?.some(g=>g.resolvedAt===null)?`Возможен пропуск после ${timeLabel(game.lastGoodTime||0)} · найдено ${found} полуходов · первый спорный кадр ${timeLabel(game.firstGapTime||0)}.`:`Видео: распознано ${found} полуходов${game.recoveredCount?` · восстановлено ${game.recoveredCount}, проверьте`:''} · последний ход ${last} из ${duration} · Stockfish ${done} позиций`}else $('#fragment').textContent=game.result==='*'?'Фрагмент записи':game.result;
 $$('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
 if(tab==='errors')renderErrors();else if(tab==='moves')renderMoves();else renderOpening();
 prepareLine();renderBoard();renderChart();
}

function tacticalNote(i){
 const after=game.evals[i+1]?.[0]?.line||[],b=new Chess(game.positions[i+1]),own=i%2===0?'w':'b',names={p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя'},values={p:1,n:3,b:3,r:5,q:9};let event=null;
 for(let j=0;j<Math.min(after.length,8);j++){const m=b.move(after[j].uci);if(m.color!==own&&m.captured&&(!event||values[m.captured]>values[event.piece]))event={piece:m.captured,san:m.san,square:m.to,ply:j+1};if(b.isCheckmate())return `В рассчитанном продолжении ход ${m.san} завершает игру матом.`}
 if(event&&values[event.piece]>=3)return `Конкретная угроза в показанном варианте: соперник играет ${event.san} и забирает ${names[event.piece]} на ${event.square} (через ${event.ply} полуходов после вашего хода). Это взятие в линии, а не обязательно чистый выигрыш материала.`;
 const best=game.evals[i]?.[0]?.line?.[0];if(best){const bb=new Chess(game.positions[i]),m=bb.move(best.uci);if(m.captured)return `Предложенный ход ${m.san} сразу забирает ${names[m.captured]} на ${m.to}. Дальнейшие ответы показаны в варианте.`;if(['n','b'].includes(m.piece)&&['1','8'].includes(m.from[1]))return `Предложенный ход выводит ${m.piece==='n'?'коня':'слона'} с ${m.from} на ${m.to}. Просмотрите ответы соперника, чтобы увидеть дальнейший план.`;if(m.san.includes('O-O'))return 'Вместо этого движок предлагает рокировку. Продолжение показывает, как играть после перемещения короля и ладьи.'}
 return 'Сравните позиции после нескольких ходов в обоих вариантах: один показывает защиту соперника после вашего хода, другой — продолжение с более сильного первого хода.';
}

function renderErrors(){
 const ids=errors(),blunders=ids.filter(i=>loss(i)>=200).length,mistakes=ids.filter(i=>loss(i)>=100&&loss(i)<200).length,inacc=ids.length-blunders-mistakes;
 const before=game.evals[selected]?.[0],after=game.evals[selected+1]?.[0],best=before?.line?.[0]?.san,played=game.moves[selected]?.san;
 const reply=after?.line?.slice(0,2).map(m=>m.san).join(' ');
 $('#tab-content').innerHTML=`<div class="summary"><div><strong>${blunders}</strong><small>грубых ошибок</small></div><div><strong>${mistakes}</strong><small>ошибок</small></div><div><strong>${inacc}</strong><small>неточностей</small></div></div><div class="error-list">${ids.map(i=>`<button class="error-chip ${i===selected?'active':''}" data-error="${i}">${moveLabel(i)} ${loss(i)>=200?'??':loss(i)>=100?'?':'?!'}</button>`).join('')||'<span class="empty">Заметных потерь оценки в ваших ходах не найдено.</span>'}</div><article class="insight-card"><div class="insight-kicker"><span>ХОД ${Math.floor(selected/2)+1} · ${selected%2?'ЧЁРНЫЕ':'БЕЛЫЕ'}</span><span class="classification">${severity(selected)}</span></div><h3>${best&&best!==played?`Лучше было ${esc(best)}`:`Ваш ход ${esc(played)}`}</h3><div class="score-change"><b>${score(before)}</b><span>→</span><b>${score(after)}</b><small>оценка за белых</small></div><p>${loss(selected)>=60?`После <b>${esc(played)}</b> оценка ухудшилась для ${selected%2?'чёрных':'белых'}. ${reply?`Сильное продолжение соперника: <b>${esc(reply)}</b>.`:''}`:'Этот ход не привёл к заметному ухудшению оценки при текущем расчёте.'} ${best&&best!==played?'Сравните сыгранное продолжение с вариантом движка.':''}</p><p>${esc(tacticalNote(selected))}</p><div class="line-switch"><button data-line="best" class="${lineMode==='best'?'active':''}">Лучше сыграть</button><button data-line="actual" class="${lineMode==='actual'?'active':''}">Как было сыграно</button><button data-line="punish" class="${lineMode==='punish'?'active':''}">Ответ соперника</button></div><p class="subtle">${lineMode==='best'?'Альтернатива движка начинается перед сыгранным ходом.':lineMode==='actual'?'Здесь показаны фактические ходы вашей партии.':'Здесь показан лучший ответ соперника после сыгранного хода.'}</p><div id="line-moves" class="line-moves"></div><p id="line-note" class="subtle"></p>${(game.evals[selected]?.length||0)>1&&lineMode==='best'?`<button id="alternative" class="text-btn">${lineIndex?'Вернуть основной вариант':'Другой кандидат на первый ход'} ↗</button>`:''}${lineMode!=='actual'?'<button id="deeper" class="secondary">Углубить расчёт этой позиции</button>':''}<button id="return-game" class="secondary return-game">Вернуться к моей партии · ход ${Math.floor(selected/2)+1}</button><p class="subtle" style="margin:10px 0 0">Продолжение учитывает ответы соперника. Оценка предварительная; это не гарантия результата партии.</p></article>`;
 $$('[data-error]').forEach(b=>b.onclick=()=>{stopPlay();selected=+b.dataset.error;actualIndex=selected+1;step=0;lineIndex=0;render();$('#tab-content').scrollIntoView({behavior:'smooth',block:'start'})});
 $$('[data-line]').forEach(b=>b.onclick=()=>{stopPlay();lineMode=b.dataset.line;step=0;lineIndex=0;render()});
 if($('#alternative'))$('#alternative').onclick=()=>{lineIndex=lineIndex?0:1;step=0;render()};
 if($('#deeper'))$('#deeper').onclick=deeper;
 $('#return-game').onclick=()=>{stopPlay();tab='moves';actualIndex=selected+1;step=0;render();$('#move-detail').scrollIntoView({behavior:'smooth',block:'center'})};
}
function renderMoves(){
 const i=Math.max(0,Math.min(game.moves.length-1,actualIndex?actualIndex-1:selected)),played=game.moves[i],best=game.evals[i]?.[0]?.line?.[0]?.san,role=mine(i)?'Ваш ход':'Ход соперника';
 let html='<p class="subtle">Это ходы вашей партии. У каждого хода есть оценка; выберите ход, чтобы увидеть разбор и позицию на доске.</p><div class="move-list">';
 for(let j=0;j<game.moves.length;j+=2)html+=`<div class="move-row"><span>${j/2+1}.</span>${[j,j+1].map(k=>game.moves[k]?`<button data-move="${k}" class="${loss(k)>=60?'error ':''}${actualIndex===k+1?'active':''}"><span>${esc(game.moves[k].san)}</span><small class="move-grade ${loss(k)>=60?'weak':''}">${severity(k)}</small></button>`:'<span></span>').join('')}</div>`;
 const correction=loss(i)>=60&&best&&best!==played.san?`<p>Вместо <b>${esc(played.san)}</b> движок предлагает <b>${esc(best)}</b>. ${esc(tacticalNote(i))}</p><button id="compare-move" class="secondary">Посмотреть исправление и продолжение</button>`:`<p>${loss(i)<20?'Ход сохраняет или улучшает оценку позиции.':loss(i)<60?'Ход в целом сохраняет позицию.':'Явная потеря оценки в этом расчёте не найдена.'} Можно изучить продолжение движка отдельно.</p><button id="compare-move" class="secondary">Показать варианты после этого хода</button>`;
 html+=`</div><article id="move-detail" class="move-detail"><div class="insight-kicker"><span>${role.toUpperCase()} · ХОД ${Math.floor(i/2)+1}</span><span class="classification">${severity(i)}</span></div><h3>${esc(played.san)} <small>сыграно в партии</small></h3><div class="score-change"><b>${score(game.evals[i]?.[0])}</b><span>→</span><b>${score(game.evals[i+1]?.[0])}</b><small>оценка за белых</small></div>${correction}</article>`;
 $('#tab-content').innerHTML=html;
 $$('[data-move]').forEach(b=>b.onclick=()=>{actualIndex=+b.dataset.move+1;selected=actualIndex-1;step=0;render();$('#move-detail').scrollIntoView({behavior:'smooth',block:'center'})});
 $('#compare-move').onclick=()=>{stopPlay();selected=i;tab='errors';lineMode='best';lineIndex=0;step=0;render()}
}
function renderOpening(){
 const o=game.opening,isGambit=/gambit/i.test(o?.name||'');
 $('#tab-content').innerHTML=`<article class="opening-card"><p class="eco">${o?esc(o.eco):'БАЗА ДЕБЮТОВ'}</p><h3>${o?esc(o.name):'Нет точного совпадения'}</h3><p>${o?'Найдена именованная позиция в начале вашей партии. Сопоставление учитывает расположение фигур, очередь хода и права рокировки.':'Для восстановленного начала именованная позиция не найдена. Это не означает, что ходы ошибочны.'}</p>${o?`<p><b>Линия из базы</b><br>${esc(o.pgn)}</p>`:''}<p>${isGambit?'В названии найденной линии есть гамбит. Само название не означает, что любая последующая жертва корректна.':'Точного совпадения с именованным гамбитом здесь не найдено. Похожая жертва сама по себе не делает позицию гамбитом.'}</p><p class="subtle">Источник: Lichess chess-openings, CC0. Объяснения типовых планов и поиск похожих мастерских партий ещё не добавлены.</p></article>`;
}
function prepareLine(){
 if(tab==='moves'||tab==='opening'){baseFen=game.positions[actualIndex];currentLine=[];return}
 const pos=lineMode==='best'?selected:lineMode==='punish'?selected+1:selected;
 baseFen=game.positions[pos];
 if(lineMode==='actual'){
  const b=new Chess(baseFen);currentLine=[];
  for(const move of game.moves.slice(selected,selected+20)){
   try{const played=b.move(move.uci);currentLine.push({uci:move.uci,san:played?.san||move.san,fen:b.fen()})}catch{break}
  }
 }else currentLine=game.evals[pos]?.[lineIndex]?.line||[];
 step=Math.min(step,currentLine.length);
 const box=$('#line-moves');if(box){
  const label=(m,i)=>lineMode==='actual'?`${Math.floor((selected+i)/2)+1}${(selected+i)%2?'…':'.'} ${esc(m.san)}`:`${Math.floor((pos+i)/2)+1}${(pos+i)%2?'…':'.'} ${esc(m.san)}`;
  box.innerHTML=`<button data-step="0" class="${step===0?'active':''}">Начало</button>`+currentLine.map((m,i)=>`<button data-step="${i+1}" class="${step===i+1?'active':''}">${label(m,i)}</button>`).join('');
  $$('[data-step]').forEach(b=>b.onclick=()=>{stopPlay();step=+b.dataset.step;render()});
  $('#line-note').textContent=lineMode==='actual'?`Ходы именно из вашей партии · ${currentLine.length} полуходов. Здесь ничего не заменено вариантом движка.`:`${currentLine.length} полуходов в рассчитанной линии · глубина ${game.evals[pos]?.[lineIndex]?.depth||'—'}. До 10 полных ходов, если движок выдал такую линию.`;
 }
}
function renderBoard(){
 const fen=step&&currentLine[step-1]?currentLine[step-1].fen:baseFen,b=new Chess(fen),lastMove=step?currentLine[step-1]?.uci:tab==='moves'&&actualIndex?game.moves[actualIndex-1]?.uci:null;
 let html='';for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  let file=flipped?7-c:c,rank=flipped?r:7-r,sq='abcdefgh'[file]+(rank+1),p=b.get(sq);
  html+=`<div class="square ${(r+c)%2?'dark':''} ${lastMove&&(lastMove.slice(0,2)===sq||lastMove.slice(2,4)===sq)?'highlight':''}" data-square="${sq}" aria-label="${sq}${p?' '+p.color+p.type:''}">${c===0?`<span class="rank">${rank+1}</span>`:''}${r===7?`<span class="file">${'abcdefgh'[file]}</span>`:''}${p?`<img src="pieces/${p.color}${p.type}.svg" alt="" draggable="false">`:''}</div>`
 }$('#board').innerHTML=html;
 $('#top-player').textContent=flipped?'Белые':'Чёрные';$('#bottom-player').textContent=flipped?'Чёрные':'Белые';
 $('#bottom-player').textContent+=(flipped===(game.color==='black'))?' · вы':' · соперник';$('#top-player').textContent+=(flipped===(game.color==='black'))?' · соперник':' · вы';
 const pos=tab==='errors'?(lineMode==='best'?selected:lineMode==='punish'?selected+1:selected+step):actualIndex;$('#eval-label').textContent=score(game.evals[pos]?.[lineIndex]||game.evals[pos]?.[0]);
 $('#position-label').textContent=tab==='errors'?(lineMode==='actual'?(step?`Партия · после ${moveLabel(selected+step-1)}`:`Перед сыгранным ${moveLabel(selected)}`):step?`Вариант · ${step} / ${currentLine.length} полуходов`:`${lineMode==='best'?'Перед':'После'} ${moveLabel(selected)}`):actualIndex?`Партия · после ${moveLabel(actualIndex-1)}`:'Начальная позиция';
 const next=currentLine[step]?.uci;$('#arrow').style.display=next?'':'none';if(next){const xy=s=>{let f='abcdefgh'.indexOf(s[0]),r=+s[1]-1;return[(flipped?7-f:f)*100+50,(flipped?r:7-r)*100+50]};const a=xy(next.slice(0,2)),z=xy(next.slice(2,4));['x1','y1','x2','y2'].forEach((k,i)=>$('#arrow').setAttribute(k,[...a,...z][i]))}
 $('#prev').disabled=tab==='errors'?step===0:actualIndex===0;$('#first').disabled=$('#prev').disabled;$('#next').disabled=tab==='errors'?step>=currentLine.length:actualIndex>=game.moves.length;$('#last').disabled=$('#next').disabled;
 $('#play').textContent=playing?'Ⅱ':'▶';
}
function renderChart(){ $('#chart').innerHTML=game.evals.map((e,i)=>{const cp=e[0]?.cp||0,v=Math.tanh(cp/500),h=Math.max(3,Math.abs(v)*48);return `<button data-pos="${i}" aria-label="Позиция ${i}: ${score(e[0])}" title="${i}: ${score(e[0])}" class="${i&&loss(i-1)>=60?'bad ':''}${i===selected?'current':''}" style="height:${h}px;transform:translateY(${v<0?h/2:-h/2}px)"></button>`}).join('');$$('[data-pos]').forEach(b=>b.onclick=()=>{stopPlay();actualIndex=+b.dataset.pos;tab='moves';render()})}
function stopPlay(){if(playing)clearInterval(playing);playing=null;$('#play').textContent='▶'}
function advance(d){if(tab==='errors'){step=Math.max(0,Math.min(currentLine.length,step+d));prepareLine();renderBoard()}else{actualIndex=Math.max(0,Math.min(game.moves.length,actualIndex+d));render()}}
$('#prev').onclick=()=>{stopPlay();advance(-1)};$('#next').onclick=()=>{stopPlay();advance(1)};$('#first').onclick=()=>{stopPlay();advance(-1000)};$('#last').onclick=()=>{stopPlay();advance(1000)};$('#play').onclick=()=>{if(playing)return stopPlay();if($('#next').disabled)advance(-1000);playing=setInterval(()=>{if($('#next').disabled)stopPlay();else advance(1)},1000);renderBoard()};$('#flip').onclick=()=>{flipped=!flipped;renderBoard()};
$$('.tabs button').forEach(b=>b.onclick=()=>{stopPlay();tab=b.dataset.tab;step=0;render()});
$$('dialog .close').forEach(b=>b.onclick=()=>{if(b.closest('dialog').id==='import-dialog'&&busy){cancelled=true;recognitionDecision?.(false);return}b.closest('dialog').close()});
$('#import-dialog').addEventListener('cancel',e=>{if(busy){e.preventDefault();cancelled=true;recognitionDecision?.(false)}});
$$('.upload-trigger').forEach(b=>b.onclick=()=>$('#import-dialog').showModal());
$('#export').onclick=()=>{const b=new Chess();game.moves.forEach(m=>b.move(m.uci));download(b.pgn(),'party.pgn','application/x-chess-pgn')};
function download(data,name,type){const u=URL.createObjectURL(new Blob([data],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)}
$('#about').onclick=()=>info('Первая версия',`<p>Импортируйте PGN или запись экрана, чтобы получить оценку каждого хода и варианты Stockfish. Ваши партии хранятся в браузере на устройстве.</p><p>Ошибки классифицируются по потере оценки: от 0,6 пешки — неточность, от 1 — ошибка, от 2 — грубая ошибка. Оценки могут измениться при углублении.</p><p>Распознавание требует последовательных кадров с начала партии. Короткий пропуск восстанавливается только при единственной легальной последовательности из двух полуходов. Восстановленные ходы отмечены для проверки. Более длинный или неоднозначный пропуск требует PGN.</p><p>Глубокие стратегические объяснения и другие темы доски ещё не добавлены. Исходный код проекта опубликован на GitHub.</p><p>Для установки: Safari → «Поделиться» → «На экран Домой». Первую загрузку выполните с интернетом. Хранение браузера может быть очищено системой — сохраняйте важные партии в PGN.</p>`);
$('#bell').onclick=async()=>{try{const v=await fetch('./version.json?t='+Date.now(),{cache:'no-store'}).then(r=>r.json()),current=v.build?v.build===BUILD_ID:v.version===VERSION,latest=`${esc(v.version||VERSION)}${v.build?' · сборка '+esc(v.build):''}`;info('Обновления',`<p>Установлена версия <b>${VERSION}</b>${BUILD_ID!=='source'?' · сборка '+esc(BUILD_ID):''}.</p><p>${current?'Это последняя версия из GitHub.':'В GitHub доступно обновление: '+latest+'.'}</p>${current?'':'<button id="update-now" class="primary">Обновить приложение</button>'}<p>Колокольчик проверяет опубликованную версию GitHub Pages. Ваши партии остаются на устройстве.</p>`);if($('#update-now'))$('#update-now').onclick=async()=>{const btn=$('#update-now');btn.disabled=true;btn.textContent='Обновляем…';try{const reg=await navigator.serviceWorker?.getRegistration();if(reg){const changed=new Promise(resolve=>{const timer=setTimeout(resolve,8000);navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve()},{once:true})});await reg.update();await changed}}catch{}location.reload()}}catch{info('Обновления',`<p>Версия ${VERSION}. Не удалось связаться с GitHub Pages. Проверьте интернет и попробуйте ещё раз.</p>`)}};
class Engine{
 constructor(){this.worker=new Worker('./stockfish-19-lite-single.js');this.ready=new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('Движок не загрузился. Проверьте соединение и повторите.')),30000);this.worker.onerror=()=>{clearTimeout(timeout);reject(new Error('Не удалось запустить Stockfish в этом браузере.'));if(this.reject)this.reject(new Error('Движок остановлен.'))};this.worker.onmessage=e=>{const line=String(e.data);if(line==='uciok'){clearTimeout(timeout);this.worker.postMessage('setoption name Hash value 32');resolve()}if(this.handler)this.handler(line)};this.worker.postMessage('uci')})}
 async analyze(fen,ms=700){await this.ready;return new Promise((resolve,reject)=>{const rows={},b=new Chess(fen),sign=b.turn()==='w'?1:-1;const timer=setTimeout(()=>{this.worker.postMessage('stop');reject(new Error('Расчёт занял слишком долго. Повторите.'))},ms+30000);this.reject=reject;this.handler=line=>{if(line.startsWith('info ')&&line.includes(' pv ')&&!/ (lowerbound|upperbound) /.test(line)){const cp=line.match(/score (cp|mate) (-?\d+)/),pv=line.split(' pv ')[1].trim().split(' '),depth=+(line.match(/depth (\d+)/)?.[1]||0),mp=+(line.match(/multipv (\d+)/)?.[1]||1);if(!cp)return;const bb=new Chess(fen),moves=[];for(const uci of pv.slice(0,20)){try{const m=bb.move(uci);moves.push({uci,san:m.san,fen:bb.fen()})}catch{break}}rows[mp]={cp:sign*(cp[1]==='cp'?+cp[2]:(+cp[2]>=0?100000:-100000)),mate:cp[1]==='mate'?sign*+cp[2]:null,depth,line:moves}}
 if(line.startsWith('bestmove')){clearTimeout(timer);this.handler=null;this.reject=null;let out=Object.keys(rows).sort().map(k=>rows[k]);if(!out.length){if(b.isCheckmate())out=[{cp:-sign*100000,mate:0,depth:0,line:[]}];else if(b.isGameOver())out=[{cp:0,mate:null,depth:0,line:[]}];else return reject(new Error('Движок не вернул оценку позиции.'))}resolve(out)}};this.worker.postMessage('setoption name MultiPV value 2');this.worker.postMessage('position fen '+fen);this.worker.postMessage('go movetime '+ms)})}
}
async function getEngine(){if(!engine)engine=new Engine();try{await engine.ready;return engine}catch(e){engine?.worker.terminate();engine=null;throw e}}
async function extendLines(e,fen,rows){
 for(const row of rows){let guard=0;while(row.line.length<10&&guard++<10){checkCancel();const tail=row.line.length?row.line[row.line.length-1].fen:fen;const b=new Chess(tail);if(b.isGameOver())break;const extra=(await e.analyze(tail,400))[0]?.line||[];if(!extra.length)break;row.line.push(...extra.slice(0,20-row.line.length))}}
 return rows;
}
async function deeper(){if(busy)return;const btn=$('#deeper'),g=game,pos=lineMode==='best'?selected:selected+1;btn.disabled=true;btn.textContent='Считаем сильные продолжения…';busy=true;try{cancelled=false;const e=await getEngine();g.evals[pos]=await extendLines(e,g.positions[pos],await e.analyze(g.positions[pos],5000));persist();if(g===game)render();toast('Расчёт углублён. Линия обновлена.')}catch(e){toast(e.message)}finally{busy=false;if($('#deeper')){$('#deeper').disabled=false;$('#deeper').textContent='Углубить расчёт этой позиции'}}}
$('#file-input').onchange=e=>{selectedFile=e.target.files[0]||null;$('#file-name').textContent=selectedFile?`${selectedFile.name} · ${(selectedFile.size/1048576).toFixed(1)} МБ`:'';$('#import-start').disabled=!selectedFile;$('#import-error').textContent=''};
$('#cancel').onclick=()=>{cancelled=true;recognitionDecision?.(false);$('#progress-text').textContent='Останавливаем обработку…'};
function timeLabel(t){if(!Number.isFinite(+t))return '—';return `${Math.floor(+t/60)}:${String(Math.floor(+t%60)).padStart(2,'0')}`}
function progress(value,text){$('#progress').value=value;$('#progress-text').textContent=text}
function checkCancel(){if(cancelled)throw new Error('Обработка остановлена. Исходный файл не изменён.')}
async function seek(video,t){return new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{cleanup();reject(new Error('Не удалось прочитать кадр видео. Попробуйте MP4 с кодеком H.264.'))},10000);const cleanup=()=>{clearTimeout(timeout);video.removeEventListener('seeked',done)};const done=()=>{cleanup();resolve()};video.addEventListener('seeked',done);if(Math.abs(video.currentTime-t)<.001&&video.readyState>=2){cleanup();resolve()}else video.currentTime=t})}
async function recognizeVideo(file,color){
 const v=$('#import-video'),url=URL.createObjectURL(file);let worker=null;
 try{
 await new Promise((resolve,reject)=>{const tm=setTimeout(()=>reject(new Error('Не удалось открыть видео.')),20000);v.onloadeddata=()=>{clearTimeout(tm);resolve()};v.onerror=()=>{clearTimeout(tm);reject(new Error('Формат видео не поддерживается браузером.'))};v.src=url;v.load()});
 if(!Number.isFinite(v.duration)||v.duration<1)throw new Error('Не удалось определить длительность видео.');
 if(!v.videoWidth||!v.videoHeight)throw new Error('Не удалось определить размер кадра.');
 if(v.duration>1200)throw new Error('В первой версии поддерживаются записи до 20 минут.');
 worker=new Worker('./recognizer.js',{type:'module'});let readyResolve,readyReject;const ready=new Promise((a,b)=>{readyResolve=a;readyReject=b});worker.onmessage=e=>{if(e.data.ready)readyResolve();else if(e.data.error)readyReject(new Error(e.data.error))};worker.onerror=()=>readyReject(new Error('Не удалось загрузить распознавание.'));worker.postMessage({init:true});let readyTimer;try{await Promise.race([ready,new Promise((_,reject)=>{readyTimer=setTimeout(()=>reject(new Error('Распознаватель не загрузился. Повторите импорт.')),20000)})])}finally{clearTimeout(readyTimer)};
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d',{willReadFrequently:true}),sequence=new OrientedSequence();let totalBoard=0,pendingMismatch=0,pendingMismatchStart=0;const recognitionGaps=[];let rect=null,plausibleFrames=0;const scan=document.createElement('canvas');scan.width=Math.min(768,v.videoWidth);scan.height=Math.round(v.videoHeight*scan.width/v.videoWidth);const scanCtx=scan.getContext('2d',{willReadFrequently:true});
 const classify=data=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Распознавание кадра не ответило. Повторите импорт.')),10000);worker.onmessage=e=>{clearTimeout(timer);e.data.error?reject(new Error(e.data.error)):resolve(e.data)};worker.onerror=()=>{clearTimeout(timer);reject(new Error('Ошибка обработки кадра.'))};worker.postMessage({pixels:data.data.buffer},[data.data.buffer])});
 for(let t=0;t<v.duration-.05;t+=.2){checkCancel();await seek(v,t);if(!rect){scanCtx.drawImage(v,0,0,scan.width,scan.height);const found=detectBoard(scanCtx.getImageData(0,0,scan.width,scan.height));if(found){const scale=v.videoWidth/scan.width;rect={x:found.x*scale,y:found.y*scale,width:found.width*scale,height:found.height*scale}}else{if(Math.round(t*5)%10===0)progress(5+50*t/v.duration,`Ищем зелёную доску · ${timeLabel(t)} / ${timeLabel(v.duration)}`);continue;}}ctx.drawImage(v,rect.x,rect.y,rect.width,rect.height,0,0,256,256);const r=await classify(ctx.getImageData(0,0,256,256));
 if(r.errorScore<.025)totalBoard++;
 const observation=sequence.observe({...r,t});if(observation.status!=='uncertain')plausibleFrames++;
 if(['same','replay'].includes(observation.status))pendingMismatch=0;
 else if(['move','recovered'].includes(observation.status)){
  if(pendingMismatch>=3||observation.status==='recovered')recognitionGaps.push({after:observation.after,firstSeen:pendingMismatch?pendingMismatchStart:t,frames:pendingMismatch,resolvedAt:+t.toFixed(1),recovered:observation.status==='recovered'});
  pendingMismatch=0;
 }else if(observation.status==='unmatched'){if(!pendingMismatch)pendingMismatchStart=t;pendingMismatch++}
 if(Math.round(t*5)%10===0)progress(5+50*t/v.duration,`Распознавание ${timeLabel(t)} / ${timeLabel(v.duration)} · ${sequence.moves.length} полуходов`);
 }
 const {moves,lastTime}=sequence;
 if(pendingMismatch>=3)recognitionGaps.push({after:lastTime,firstSeen:pendingMismatchStart,frames:pendingMismatch,resolvedAt:null});
 if(!rect)throw new Error('Не удалось найти зелёную доску Chess.com в кадре. Проверьте, что доска видна целиком и не перекрыта. Другие темы пока не поддерживаются.');
 if(!moves.length)throw new Error(plausibleFrames?'Доска найдена, но позиции не удалось связать с началом партии. Проверьте наличие первых ходов; можно загрузить PGN.':'Доска найдена, но фигуры не удалось уверенно распознать. Попробуйте исходную запись без сжатия или импорт PGN.');
 const gap=recognitionGaps.find(g=>g.resolvedAt===null)||null,recoveredCount=moves.filter(m=>m.recovered).length;
 const recognitionWarning=gap?`Не удалось связать распознанные позиции после ${timeLabel(gap.after)}; первый спорный кадр — ${timeLabel(gap.firstSeen)}. Партия может быть распознана не полностью.`:recoveredCount?`Восстановлено ${recoveredCount} полуходов по единственной легальной последовательности. Сверьте отмеченные ходы с записью.`:null;
 const result=sequence.board.isCheckmate()?(sequence.board.turn()==='w'?'0-1':'1-0'):'*';
 return {moves,orientation:sequence.orientation,boardRect:rect,duration:v.duration,result,recognitionWarning,lastTime,firstGapTime:gap?.firstSeen??null,lastGoodTime:gap?.after??lastTime,recognitionGaps,stableBoardFrames:totalBoard,recoveredCount};
 }finally{worker?.terminate();v.removeAttribute('src');v.load();URL.revokeObjectURL(url)}
}
async function reviewRecognition(data,file,color,original=structuredClone(data)){
 let restart=false;
 const box=$('#recognition-review');box.hidden=false;
 const pgn=new Chess(),positions=[pgn.fen()];data.moves.forEach(m=>{pgn.move(m.uci);positions.push(pgn.fen())});
 box.innerHTML=`<p class="subtle">Доска найдена автоматически · ${data.orientation==='black'?'чёрные':'белые'} снизу. Ваш цвет для разбора: ${color==='black'?'чёрные':'белые'}.</p><h3>${data.manuallyEdited?'После исправления:':'Найдено'} ${data.moves.length} полуходов</h3><p>Видео просмотрено до ${timeLabel(data.duration)}. ${data.manuallyEdited?'Время изменённых ходов не определено.':`Последний найденный ход — ${timeLabel(data.lastTime)}.`}</p><p>${data.result==='*'?'Конец партии по правилам шахмат не подтверждён: запись может содержать только часть игры. Долгое отсутствие новых ходов само по себе не означает пропуск.':'На последней восстановленной позиции — мат.'}</p>${data.recognitionWarning?`<p role="alert">${esc(data.recognitionWarning)}</p>`:''}<p>Проверьте список перед расчётом Stockfish. Звёздочкой отмечены восстановленные полуходы; их точное время внутри пропуска неизвестно.</p><div class="recognition-compare"><div><div id="recognition-board" class="board" aria-label="Распознанная позиция"></div><p id="recognition-position" role="status"></p><button id="recognition-board-edit" class="secondary" type="button">Исправить этот ход на доске</button><div id="recognition-board-editor" hidden><p id="board-edit-status" role="status"></p><div id="board-promotion"></div><button id="board-edit-apply" class="secondary" type="button" disabled>Применить исправление</button><button id="board-edit-cancel" class="text-btn" type="button">Отменить исправление</button></div><div class="recognition-controls"><button id="recognition-start" type="button">Начало</button><button id="recognition-prev" type="button" aria-label="Предыдущий распознанный ход">←</button><button id="recognition-next" type="button" aria-label="Следующий распознанный ход">→</button></div></div><div><video id="recognition-video" controls muted playsinline preload="metadata" aria-label="Исходная запись"></video><p class="subtle">Сверьте доску с записью. Выбор хода перемещает видео к моменту распознавания. Для восстановленного хода время приблизительное.</p></div></div><div class="line-moves" style="max-height:220px;overflow:auto">${data.moves.map((m,i)=>`<button type="button" class="tag" data-recognition-move="${i+1}">${Math.floor(i/2)+1}${i%2?'…':'.'} ${esc(m.san)}${m.recovered?' *':''}</button>`).join(' ')}</div><details id="recognition-editor"><summary>Исправить список ходов</summary><label class="field" for="recognition-pgn">Ходы партии в шахматной записи (PGN)</label><textarea id="recognition-pgn" rows="6" spellcheck="false"></textarea><p class="subtle">Например: 1. e4 e5 2. Nf3. Исправьте ход и при необходимости последующее продолжение. Изменения применятся только после проверки.</p><p id="recognition-edit-error" role="alert"></p><button id="recognition-apply" class="secondary" type="button">Проверить и применить</button><button id="recognition-reset" class="text-btn" type="button">Вернуть исходное распознавание</button></details><button id="recognized-pgn" class="secondary" type="button">Скачать найденные ходы · PGN</button><button id="recognition-continue" class="primary" type="button">Разобрать ${data.moves.length} полуходов</button>`;

 const video=$('#recognition-video'),videoURL=URL.createObjectURL(file);let position=0,boardEditing=false,fromSquare=null,proposal=null;
 const showPosition=()=>{
  const board=new Chess(boardEditing?(proposal?.replacementFen||positions[position-1]):positions[position]),move=data.moves[position-1],flip=(data.orientation||color)==='black';let html='';
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
   const square='abcdefgh'[flip?7-c:c]+(flip?r+1:8-r),piece=board.get(square),highlight=move&&(move.uci.slice(0,2)===square||move.uci.slice(2,4)===square);
   html+=`<div class="square ${(r+c)%2?'dark':''} ${highlight?'highlight':''}" data-square="${square}" aria-label="${square}${piece?' '+piece.color+piece.type:''}">${piece?`<img src="pieces/${piece.color}${piece.type}.svg" alt="" draggable="false">`:''}</div>`;
  }
  $('#recognition-board').innerHTML=html;
  $('#recognition-position').textContent=position?`${Math.floor((position-1)/2)+1}${position%2?'.':'…'} ${move.san} · ${position} из ${data.moves.length}${move.manualEdited?' · изменён вручную, время неизвестно':move.recovered?' · восстановлен, проверьте по видео':''}`:'Начальная позиция';
  $('#recognition-prev').disabled=$('#recognition-start').disabled=boardEditing||position===0;$('#recognition-next').disabled=boardEditing||position===data.moves.length;$('#recognition-board-edit').disabled=boardEditing||position===0||$('#recognition-continue').disabled;
  $$('[data-recognition-move]').forEach(b=>{b.disabled=boardEditing;b.setAttribute('aria-pressed',String(+b.dataset.recognitionMove===position))});
  if(boardEditing){const legal=new Chess(positions[position-1]).moves({verbose:true});$$('#recognition-board .square').forEach(cell=>{const sq=cell.dataset.square;cell.setAttribute('role','button');cell.tabIndex=0;cell.classList.toggle('edit-selected',sq===fromSquare);cell.classList.toggle('edit-target',!!fromSquare&&legal.some(m=>m.from===fromSquare&&m.to===sq));cell.onclick=()=>chooseSquare(sq);cell.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseSquare(sq)}}})}
  video.pause();if(video.readyState>=1&&(!move||Number.isFinite(move.time)))video.currentTime=Math.min(move?.time||0,video.duration||data.duration);
 };

 const lockEditor=locked=>{
  $('#recognition-continue').disabled=$('#recognized-pgn').disabled=locked;
  $('#recognition-pgn').disabled=$('#recognition-apply').disabled=locked;
  $('#recognition-reset').disabled=locked||!data.manuallyEdited;
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
 $('#recognition-pgn').value=pgn.pgn();$('#recognition-reset').disabled=!data.manuallyEdited;
 $('#recognition-pgn').oninput=()=>{$('#recognition-board-edit').disabled=true;$('#recognition-continue').disabled=true;$('#recognized-pgn').disabled=true;$('#recognition-reset').disabled=false;$('#recognition-edit-error').textContent='Примените правки или верните исходное распознавание перед разбором.'};
 $('#recognition-apply').onclick=()=>{try{const updated=editRecognition(original,$('#recognition-pgn').value);Object.assign(data,updated);data.manuallyEdited=!!updated.manuallyEdited;recognitionDecision?.('edit')}catch(e){$('#recognition-edit-error').textContent=e.message}};
 $('#recognition-reset').onclick=()=>{Object.assign(data,structuredClone(original));data.manuallyEdited=false;recognitionDecision?.('edit')};
 $('#recognized-pgn').onclick=()=>download(pgn.pgn(),'recognized-party.pgn','application/x-chess-pgn');
 progress(55,'Распознавание завершено. Проверьте найденные ходы.');
 try{await new Promise((resolve,reject)=>{recognitionDecision=confirmed=>{recognitionDecision=null;restart=confirmed==='edit';confirmed?resolve():reject(new Error('Расчёт отменён. Найденные ходы не добавлены в историю; исходное видео не изменено.'))};$('#recognition-continue').onclick=()=>recognitionDecision?.(true)});checkCancel()}
 finally{recognitionDecision=null;video.pause();video.removeAttribute('src');video.load();URL.revokeObjectURL(videoURL);box.hidden=true;box.innerHTML=''}
 if(restart)return reviewRecognition(data,file,color,original);
}
$('#import-start').onclick=async()=>{
 if(!selectedFile||busy)return;busy=true;cancelled=false;$('#import-start').disabled=true;$('#file-input').disabled=true;$('#color').disabled=true;$('#progress-box').hidden=false;$('#import-error').textContent='';const file=selectedFile,color=$('#color').value;let wake=null;
 try{try{wake=await navigator.wakeLock?.request('screen')}catch{};let data;progress(1,'Подготавливаем файл…');
 if(/\.pgn$/i.test(file.name)){const b=new Chess();try{b.loadPgn(await file.text())}catch{throw new Error('Не удалось прочитать PGN. Проверьте последовательность ходов.')}const history=b.history({verbose:true});if(!history.length)throw new Error('В PGN нет ходов.');if(history.length>500)throw new Error('В первой версии поддерживается до 500 полуходов.');const initial=history[0].before;if(initial!==new Chess().fen())throw new Error('Пока поддерживается PGN со стандартной начальной позиции.');data={moves:history.map(m=>({uci:m.from+m.to+(m.promotion||''),san:m.san})),result:b.header().Result||'*'}}else data=await recognizeVideo(file,color);
 checkCancel();if(Number.isFinite(data.duration))await reviewRecognition(data,file,color);const b=new Chess(),positions=[b.fen()];let opening=null;for(const m of data.moves){b.move(m.uci);positions.push(b.fen());opening=openings[b.fen().split(' ').slice(0,3).join(' ')]||opening}
 if(Number.isFinite(data.duration))progress(55,`Видео распознано: ${data.moves.length} полуходов · последний ход ${timeLabel(data.lastTime)} из ${timeLabel(data.duration)}${data.recognitionWarning?' · есть фрагмент для проверки':''}. Далее оценка Stockfish.`);
 const e=await getEngine(),evals=[];for(let i=0;i<positions.length;i++){checkCancel();progress(56+43*i/positions.length,`Stockfish: позиция ${i+1} из ${positions.length}. Держите приложение открытым.`);evals.push(await e.analyze(positions[i],1000))}
 checkCancel();
 const g={id:'local-'+Date.now(),title:file.name.replace(/\.[^.]+$/,'').slice(0,55),source:file.name,color,moves:data.moves,positions,evals,opening,result:data.result||'*',engine:'Stockfish 19 Lite',recognitionWarning:data.recognitionWarning,videoDuration:data.duration,lastMoveTime:data.lastTime,firstGapTime:data.firstGapTime,lastGoodTime:data.lastGoodTime,recognitionGaps:data.recognitionGaps,stableBoardFrames:data.stableBoardFrames,recoveredCount:data.recoveredCount,manuallyEdited:data.manuallyEdited};games.unshift(g);persist();selectGame(g);$('#import-dialog').close();toast('Партия разобрана и сохранена на этом устройстве.');if(data.recognitionWarning)info('Проверьте распознавание видео',`<p>${esc(data.recognitionWarning)}</p><p>Найдено ${data.moves.length} полуходов. Последний подтверждённый ход: ${timeLabel(data.lastTime)} из ${timeLabel(data.duration)}.</p><p>Сверьте отмеченный участок с видео, прежде чем считать разбор полной партией.</p>`);
 }catch(e){$('#import-error').textContent=e.message}finally{busy=false;wake?.release();$('#import-start').disabled=!selectedFile;$('#file-input').disabled=false;$('#color').disabled=false;$('#progress-box').hidden=true}
};
function renderEmpty(){$('#game-title').textContent='Добавьте партию, чтобы начать';$('#game-label').textContent='РАЗБОР ПАРТИИ';$('#opening').textContent='Загрузите PGN или запись экрана';$('#fragment').textContent='Партии хранятся на этом устройстве';$('#board').innerHTML='';$('#chart').innerHTML='';$('#tab-content').innerHTML='<article class="move-detail"><h3>Начните с вашей партии</h3><p>Нажмите «Добавить партию», чтобы загрузить PGN или запись экрана. Затем здесь появится ваша партия с оценкой каждого хода.</p></article>';$('#games').innerHTML='';$('#count').textContent='0';$('#eval-label').textContent='—';$('#position-label').textContent='Здесь появится доска с вашей партией';$('#first').disabled=$('#prev').disabled=$('#next').disabled=$('#last').disabled=true}
async function boot(){try{const [samples,ops]=await Promise.all([fetch('./samples.json').then(r=>r.json()),fetch('./openings.json').then(r=>r.json())]);openings=ops;let saved=[];try{saved=JSON.parse(localStorage.getItem('atelier-games-v1')||'[]').filter(g=>g.moves?.length&&g.positions?.length&&g.evals?.length)}catch{}games=[...saved,...samples];if(games.length)selectGame(games[0]);else renderEmpty()}catch(e){$('#game-title').textContent='Не удалось загрузить партии';$('#tab-content').innerHTML='<p>Проверьте интернет и обновите страницу.</p>';console.error(e)}}
boot();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=0.3.5').catch(()=>{});
