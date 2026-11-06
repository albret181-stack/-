import {comparisonFor} from './compare-moves.js';
import {tacticalConcepts} from './tactical-concepts.js';
import {positionalComparison} from './position-language.js';
import {Chess} from './chess.js';
import {describeMove,moveStory} from './move-language.js';
const pieces={p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя',k:'короля'};
function mateInOne(board){
 for(const move of board.moves({verbose:true})){board.move(move);const mate=board.isCheckmate();board.undo();if(mate)return true;}
 return false;
}
function apply(board,move){try{return board.move(move)}catch{return null}}
function recapture(board,square){return board.moves({verbose:true}).find(m=>m.to===square&&m.captured)}
function explainBetter(game,index,best,reply,loss){
 if(!best)return null;
 const played=game.moves[index];
 if(best.uci===played.uci)return 'Ваш ход совпадает с лучшим ходом текущего расчёта.';
 const candidate=new Chess(best.fen),actual=new Chess(game.positions[index+1]);
 if(candidate.isCheckmate()&&actual.isCheckmate())return 'Оба хода сразу ставят мат; преимущества одного перед другим здесь нет.';
 if(candidate.isCheckmate())return `${best.san} сразу ставит мат. Сыгранный ${played.san} партию матом не завершает.`;
 if(reply?.mate&&!mateInOne(candidate))return `${best.san} не допускает мата в один ход. После ${played.san} соперник мог поставить мат ходом ${reply.san}; после ${best.san} немедленного мата нет.`;
 if(reply?.captured){
  const captureUci=reply.from+reply.to+(reply.promotion||''),sameCapture=apply(candidate,captureUci);
  if(!sameCapture||!sameCapture.captured){
   const movedVictim=best.from===reply.to;
   const canTake=movedVictim&&new Chess(best.fen).moves({verbose:true}).some(m=>m.to===best.to&&m.captured);
   if(movedVictim&&!canTake)return `${best.san} уводит ${pieces[best.piece]} с ${best.from} на ${best.to}, где соперник не может сразу взять эту фигуру. После ${played.san} соперник мог забрать эту фигуру ходом ${reply.san}.`;
   if(movedVictim&&canTake)return `После ${best.san} фигуру всё ещё можно сразу взять. Движок предпочитает этот ход, но конкретное преимущество пока не удалось подтвердить.`;
   return `${best.san} не допускает конкретного взятия ${reply.san}, доступного после вашего ${played.san}.`;
  }
  const actualCapture=apply(actual,captureUci);
  if(actualCapture&&!recapture(actual,reply.to)&&recapture(candidate,reply.to))return `${best.san} добавляет защиту: на взятие ${reply.san} можно ответить взятием на ${reply.to}. После вашего ${played.san} такого ответного взятия нет.`;
 }
 let playedMove=null;try{playedMove=new Chess(game.positions[index]).move(played.uci)}catch{}
 if(best.captured&&!(playedMove?.captured&&playedMove.to===best.to))return `${best.san} использует возможность сразу взять ${pieces[best.captured]} на ${best.to}. Ход ${played.san} это взятие не выполняет; движок оценивает позицию после ${best.san} выше. Само взятие не обязательно означает чистый выигрыш материала.`;
 const oldMotifs=new Set(tacticalConcepts(game.positions[index],played.uci).map(x=>x.key));const motifs=tacticalConcepts(game.positions[index],best.uci).filter(x=>!oldMotifs.has(x.key));if(motifs.length)return motifs[0].text+' В сыгранном ходе такого нового ограничения нет. Это конкретное различие ходов; вся разница оценки может включать и другие факторы.';
 const positional=positionalComparison(game.positions[index],played.uci,best.uci);
 if(positional)return positional.better+' В отличие от сыгранного хода, этот вариант решает перечисленные задачи. Это позиционные преимущества, а не гарантия выигрыша.';
 const before=game.evals[index]?.[0],after=game.evals[index+1]?.[0];
 const comparison=Number.isFinite(loss)&&before?.mate==null&&after?.mate==null?` По текущему расчёту разница с ${played.san} — около ${(loss/100).toFixed(1)} пешки в вашу пользу.`:'';
 return `Движок предпочитает ${best.san} в этой позиции.${comparison} Конкретное преимущество этого хода пока не удалось надёжно объяснить.`;
}

export function reviewMove(game,index){
 const comparison=comparisonFor(game,index),before=comparison?.best||game.evals[index]?.[0],after=comparison?.played||game.evals[index+1]?.[0],played=game.moves[index],side=index%2===0?1:-1;
 const available=Number.isFinite(before?.cp)&&Number.isFinite(after?.cp);
 let best=null,reply=null;
 try{const b=new Chess(game.positions[index]),m=b.move(before?.line?.[0]?.uci);if(m)best={...m,uci:m.from+m.to+(m.promotion||''),fen:b.fen()};}catch{}
 try{const b=new Chess(game.positions[index+1]),m=b.move(game.evals[index+1]?.[0]?.line?.[0]?.uci);if(m)reply={...m,mate:b.isCheckmate(),check:b.isCheck()};}catch{}
 // Independent short searches can disagree slightly; the engine's own best move is not an error.
 const loss=available?(best?.uci===played?.uci?0:Math.max(0,(before.cp-after.cp)*side)):null;
 const grade=loss===null?'Недостаточно данных':loss>=200?'Грубая ошибка':loss>=100?'Ошибка':loss>=60?'Неточность':best?.uci===played?.uci?'Лучший по расчёту':'Без заметной ошибки';
 let reason=loss===null?'Оценки этой позиции недостаточно для вывода об ошибке.':loss<60?'В текущем расчёте ход не привёл к заметной потере оценки.':`После ${played.san} оценка вашей позиции ухудшилась примерно на ${(loss/100).toFixed(1)} пешки. Конкретную тактическую причину пока не удалось определить.`;
 if(loss>=60){
  if(reply?.mate)reason=`После ${played.san} соперник может поставить мат одним ходом — ${reply.san}. ${describeMove(game.positions[index+1],reply.from+reply.to+(reply.promotion||''))}`;
  else if(after.mate!=null&&after.mate*side<0)reason=`После ${played.san} движок находит форсированный мат вашему королю.`;
  else if(before.mate!=null&&before.mate*side>0&&!(after.mate!=null&&after.mate*side>0))reason=`Ход ${played.san} упускает найденный движком форсированный мат.`;
  else if(reply?.captured)reason=`После ${played.san} сопернику доступно взятие: ${reply.san} забирает ${pieces[reply.captured]} на ${reply.to}. Оценка вашей позиции ухудшается.`;
  else if(best?.captured)reason=`В исходной позиции движок предпочитает ${best.san} — можно взять ${pieces[best.captured]} на ${best.to}. После сыгранного ${played.san} оценка хуже.`;
 }
 if(loss>=60&&best&&reason.includes('Конкретную тактическую причину')){const positional=positionalComparison(game.positions[index],played.uci,best.uci);if(positional)reason=positional.reason;}
 const better=explainBetter(game,index,best,reply,loss);
 const playedStory=moveStory(game.positions[index],played.uci),bestStory=best?moveStory(game.positions[index],best.uci):null;
 return {loss,grade,best,reason,better,comparisonVerified:!!comparison,playedText:playedStory.action,playedIdea:playedStory.idea,bestText:bestStory?.action,bestIdea:bestStory?.idea,bestThreats:bestStory?.threats||[]};
}
