import {Chess} from './chess.js';
const names={p:'пешка',n:'конь',b:'слон',r:'ладья',q:'ферзь',k:'король'};
const accusative={p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя',k:'короля'};
const instrumental={p:'пешкой',n:'конём',b:'слоном',r:'ладьёй',q:'ферзём',k:'королём'};
const values={p:1,n:3,b:3,r:5,q:9,k:100};
const upper=s=>s[0].toUpperCase()+s.slice(1);
const uci=m=>m.from+m.to+(m.promotion||'');
export function describeMove(fen,move){
 try{
  const b=new Chess(fen),m=b.move(move);let text;
  if(m.flags.includes('k')||m.flags.includes('q')){
   const rank=m.color==='w'?'1':'8',short=m.flags.includes('k');
   text=`Рокировка: король с ${m.from} переходит на ${m.to}, ладья с ${short?'h':'a'}${rank} — на ${short?'f':'d'}${rank}.`;
  }else if(m.flags.includes('e'))text=`Пешка с ${m.from} идёт на ${m.to} и берёт на проходе пешку на ${m.to[0]+m.from[1]}.`;
  else text=`${upper(names[m.piece])} с ${m.from} ${m.captured?`берёт ${accusative[m.captured]} на`:'идёт на'} ${m.to}${m.flags.includes('e')?' (взятие на проходе)':''}${m.promotion?` и превращается в ${accusative[m.promotion]}`:''}.`;
  return text+(b.isCheckmate()?' Это мат.':b.isCheck()?' Даёт шах.':'');
 }catch{return 'Не удалось подтвердить перемещение фигуры.';}
}
function capturesBy(board,color,square){
 // Ask for legal captures with the attacking side to move. This excludes pinned attacks.
 const parts=board.fen().split(' ');parts[1]=color;parts[3]='-';
 const view=new Chess(parts.join(' '));
 return {view,moves:view.moves({verbose:true}).filter(m=>m.from===square&&m.captured&&m.captured!=='k')};
}
export function moveStory(fen,move){
 try{
  const before=new Chess(fen),original=before.fen(),m=before.move(move),after=before;
  const action=describeMove(original,move),actor=after.get(m.to),old=new Chess(original);
  const previous=new Set(capturesBy(old,m.color,m.from).moves.map(m=>m.to));
  const {view,moves}=capturesBy(after,m.color,m.to),seen=new Set(),threats=[];
  for(const capture of moves){
   if(seen.has(capture.to))continue;seen.add(capture.to);
   const target=after.get(capture.to);if(!target||target.color===m.color)continue;
   const defended=after.attackers(capture.to,target.color).length>0;
   view.move(uci(capture));const recapture=view.moves({verbose:true}).some(reply=>reply.to===capture.to&&reply.captured);view.undo();
   threats.push({square:capture.to,piece:target.type,undefended:!defended&&!recapture,recapture,newAttack:!previous.has(capture.to)});
  }
  threats.sort((a,b)=>(values[b.piece]*10+Number(b.newAttack))-(values[a.piece]*10+Number(a.newAttack)));
  if(after.isCheckmate()||!threats.length)return {action,idea:'',threats:[]};
  const first=threats[0],subject=`${upper(names[actor.type])} на ${m.to}`;
  let idea;
  if(threats.length>1&&values[first.piece]>=3&&values[threats[1].piece]>=3){
   const second=threats[1];idea=`${subject} одновременно нападает на ${accusative[first.piece]} на ${first.square} и ${accusative[second.piece]} на ${second.square}. Возникает двойное нападение; это ещё не гарантирует выигрыш фигуры.`;
  }else{
   idea=`${subject} ${first.newAttack?'нападает':'сохраняет нападение'} на ${accusative[first.piece]} на ${first.square}. `;
   idea+=first.undefended?'Эта фигура сейчас не защищена другими фигурами: возникает угроза её взятия.':first.recapture?`На возможное взятие на ${first.square} есть легальное ответное взятие — цель нельзя считать беззащитной.`:`Немедленного ответного взятия на ${first.square} не найдено; это не исключает другие способы защиты.`;
  }
  const replies=after.moves({verbose:true});
  if(replies.length&&replies.every(reply=>reply.from===first.square))idea+=` Сопернику придётся ответить ходом ${instrumental[first.piece]}.`;
  return {action,idea,threats};
 }catch{return {action:describeMove(fen,move),idea:'',threats:[]};}
}
