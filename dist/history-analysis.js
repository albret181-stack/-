import {compareMoves,comparisonFor} from './compare-moves.js';
import {reviewMove} from './move-review.js';

export function missingAnalysisPositions(game){
 if(!Array.isArray(game.positions)||!Array.isArray(game.moves)||!game.moves.length||
    game.positions.length!==game.moves.length+1||!['white','black'].includes(game.color))return [];
 return game.positions.flatMap((fen,index)=>Number.isFinite(game.evals?.[index]?.[0]?.cp)?[]:[index]);
}

export async function completeGameAnalysis(game,missing,analyze,check,progress){
 const result={...game,evals:[...(game.evals||[])],comparisons:{...game.comparisons}};
 for(const [step,index] of missing.entries()){
  check();
  progress('Позиция '+(step+1)+' из '+missing.length);
  const rows=await analyze(game.positions[index],1500);
  check();
  if(!Number.isFinite(rows?.[0]?.cp))throw new Error('Stockfish не вернул оценку позиции.');
  result.evals[index]=rows;
 }
 for(let i=game.color==='black'?1:0;i<game.moves.length;i+=2){
  check();
  if(comparisonFor(result,i))continue;
  const candidate=reviewMove(result,i);
  if(candidate.loss<60||!candidate.best)continue;
  progress('Уточняем ход '+(Math.floor(i/2)+1));
  result.comparisons[i]=await compareMoves(analyze,game.positions[i],game.moves[i].uci,candidate.best.uci,check);
 }
 return result;
}

export function saveCompletedAnalysis(storage,current,visible,original,result){
 const key='atelier-games-v1';
 const stored=JSON.parse(storage.getItem(key)??'[]');
 if(!Array.isArray(stored)||JSON.stringify(stored.filter(visible))!==JSON.stringify(current)||
    stored.filter(g=>g?.id===original.id).length!==1){
  throw new Error('Список сохранённых партий изменился. Откройте приложение заново.');
 }
 const next=stored.map(g=>g?.id===original.id?result:g);
 try{storage.setItem(key,JSON.stringify(next))}
 catch{throw new Error('Не удалось сохранить разбор. Проверьте свободное место в браузере.')}
}
