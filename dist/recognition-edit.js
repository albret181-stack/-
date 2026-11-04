import {Chess} from './chess.js';

// Validate completely before touching the caller's draft.
export function editRecognition(original, text) {
 const board=new Chess();
 try { board.loadPgn(text); } catch { throw new Error('Не удалось прочитать ходы. Проверьте запись и продолжение после исправления.'); }
 const history=board.history({verbose:true});
 if(!history.length||history.length>500)throw new Error('Нужно от 1 до 500 полуходов.');
 if(history[0].before!==new Chess().fen())throw new Error('Поддерживается только стандартная начальная позиция.');
 let changed=false;
 const moves=history.map((move,i)=>{
  const uci=move.from+move.to+(move.promotion||'');
  if(uci!==original.moves[i]?.uci)changed=true;
  return changed?{uci,san:move.san,manualEdited:true}:{...original.moves[i],san:move.san};
 });
 const edited=changed||moves.length!==original.moves.length;
 if(!edited)return structuredClone(original);
 return {...structuredClone(original),moves,manuallyEdited:true,
  recoveredCount:moves.filter(m=>m.recovered).length,
  result:board.isCheckmate()?(board.turn()==='w'?'0-1':'1-0'):'*',
  recognitionWarning:'Список ходов изменён вручную. Сверьте продолжение и полноту партии с видео. '+(original.recognitionWarning||'')};
}

// Build a proposal; caller must explicitly confirm any removed continuation.
export function replaceRecognizedMove(original,current,index,uci) {
 if(!Number.isInteger(index)||index<0||index>=current.moves.length)throw new Error('Выберите ход для исправления.');
 const board=new Chess();
 for(const move of current.moves.slice(0,index))board.move(move.uci);
 board.move(uci);const replacementFen=board.fen();let end=index+1;
 for(;end<current.moves.length;end++){
  try{board.move(current.moves[end].uci)}catch{break}
 }
 return {data:editRecognition(original,board.pgn()),dropped:current.moves.length-end,replacementFen};
}
