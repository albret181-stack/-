import {Chess} from './chess.js';
// Optional legacy fields stay optional. No writes or normalization.
export function validateBackupProgress(game){
 if(game.training===undefined)return {recordCount:0};
 if(!game.training || typeof game.training!=='object' || Array.isArray(game.training))throw new Error('Некорректный прогресс в копии.');
 let count=0;
 for(const [key,p] of Object.entries(game.training)){
  const i=Number(key);
  if(!/^(0|[1-9][0-9]*)$/.test(key)||!Number.isSafeInteger(i)||i>=game.moves.length||!p||typeof p!=='object'||Array.isArray(p))throw new Error('Некорректная позиция прогресса.');
  for(const field of ['solved','revealed'])if(p[field]!==undefined&&typeof p[field]!=='boolean')throw new Error('Некорректный статус прогресса.');
  for(const field of ['attempts','streak','nextReviewAt','updatedAt'])if(p[field]!==undefined&&(!Number.isSafeInteger(p[field])||p[field]<0))throw new Error('Некорректное число в прогрессе.');
  if(p.lastResult!==undefined&&!['solved','failed','assisted'].includes(p.lastResult))throw new Error('Неизвестный результат тренировки.');
  if(p.fen!==undefined&&p.fen!==game.positions[i])throw new Error('Прогресс относится к другой позиции.');
  if(p.bestUci!==undefined){
   if(p.fen===undefined||typeof p.bestUci!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(p.bestUci))throw new Error('Некорректный ответ тренировки.');
   try{if(!new Chess(p.fen).move(p.bestUci))throw Error()}catch{throw new Error('Незаконный ответ тренировки.')}
  }
  count++;
 }
 return {recordCount:count};
}
