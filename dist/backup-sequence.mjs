import {Chess} from './chess.js';
// Sequence validation only. Assessments and progress need separate validation before import.
export function validateBackupSequence(game){
 if(!game || !Array.isArray(game.moves) || !game.moves.length || game.moves.length>500 || !Array.isArray(game.positions) || game.positions.length!==game.moves.length+1) throw new Error('Некорректная длина партии в копии.');
 const board=new Chess();
 if(game.positions[0]!==board.fen()) throw new Error('Начальная позиция копии не поддерживается.');
 for(let i=0;i<game.moves.length;i++){
  const move=game.moves[i];
  if(!move || typeof move.uci!=='string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move.uci)) throw new Error('Некорректный ход в копии.');
  let played;try{played=board.move(move.uci)}catch{}
  if(!played || game.positions[i+1]!==board.fen() || (move.san!==undefined && move.san!==played.san)) throw new Error('Ходы и позиции копии не совпадают.');
 }
 return {moveCount:game.moves.length};
}
