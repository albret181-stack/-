import {Chess} from './chess.js';
const pieces={p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя',k:'короля'};
export function reviewMove(game,index){
 const before=game.evals[index]?.[0],after=game.evals[index+1]?.[0],played=game.moves[index],side=index%2===0?1:-1;
 const available=Number.isFinite(before?.cp)&&Number.isFinite(after?.cp);
 let best=null,reply=null;
 try{const b=new Chess(game.positions[index]),m=b.move(before?.line?.[0]?.uci);if(m)best={...m,uci:m.from+m.to+(m.promotion||''),fen:b.fen()};}catch{}
 try{const b=new Chess(game.positions[index+1]),m=b.move(after?.line?.[0]?.uci);if(m)reply={...m,mate:b.isCheckmate(),check:b.isCheck()};}catch{}
 // Independent short searches can disagree slightly; the engine's own best move is not an error.
 const loss=available?(best?.uci===played?.uci?0:Math.max(0,(before.cp-after.cp)*side)):null;
 const grade=loss===null?'Недостаточно данных':loss>=200?'Грубая ошибка':loss>=100?'Ошибка':loss>=60?'Неточность':best?.uci===played?.uci?'Лучший по расчёту':'Без заметной ошибки';
 let reason=loss===null?'Оценки этой позиции недостаточно для вывода об ошибке.':loss<60?'В текущем расчёте ход не привёл к заметной потере оценки.':`После ${played.san} оценка вашей позиции ухудшилась примерно на ${(loss/100).toFixed(1)} пешки. Конкретную тактическую причину пока не удалось определить.`;
 if(loss>=60){
  if(reply?.mate)reason=`После ${played.san} соперник может поставить мат одним ходом — ${reply.san}.`;
  else if(after.mate!=null&&after.mate*side<0)reason=`После ${played.san} движок находит форсированный мат вашему королю.`;
  else if(before.mate!=null&&before.mate*side>0&&!(after.mate!=null&&after.mate*side>0))reason=`Ход ${played.san} упускает найденный движком форсированный мат.`;
  else if(reply?.captured)reason=`После ${played.san} сопернику доступно взятие: ${reply.san} забирает ${pieces[reply.captured]} на ${reply.to}. Оценка вашей позиции ухудшается.`;
  else if(best?.captured)reason=`В исходной позиции движок предпочитает ${best.san} — взятие ${pieces[best.captured]} на ${best.to}. После сыгранного ${played.san} оценка хуже.`;
 }
 const better=best?best.captured?`${best.san} сразу берёт ${pieces[best.captured]} на ${best.to}.`:best.flags.includes('k')||best.flags.includes('q')?`${best.san} выполняет рокировку.`:`${best.san}: переместить ${pieces[best.piece]} с ${best.from} на ${best.to}.`:null;
 return {loss,grade,best,reason,better};
}
