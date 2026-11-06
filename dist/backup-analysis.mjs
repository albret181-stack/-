import {Chess} from './chess.js';
import {comparisonFor} from './compare-moves.js';
// Validate saved analysis, not its playing strength. No storage writes.
export function validateBackupAnalysis(game){
 const fail=()=>{throw new Error('Некорректный анализ в копии.');};
 const row=(r,fen)=>{
  if(!r||typeof r!=='object'||Array.isArray(r)||!Number.isFinite(r.cp)||!Array.isArray(r.line))fail();
  if(r.mate!=null&&!Number.isSafeInteger(r.mate))fail();
  const b=new Chess(fen);
  for(const m of r.line){if(!m||typeof m.uci!=='string'||!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(m.uci))fail();try{if(!b.move(m.uci))fail()}catch{fail()}}
 };
 if(!Array.isArray(game.evals)||game.evals.length>game.positions.length)fail();
 let rows=0,comparisons=0;
 game.evals.forEach((items,i)=>{if(items==null)return;if(!Array.isArray(items))fail();for(const r of items){row(r,game.positions[i]);rows++}});
 if(game.comparisons!==undefined){
  if(!game.comparisons||typeof game.comparisons!=='object'||Array.isArray(game.comparisons))fail();
  for(const key of Object.keys(game.comparisons)){
   const i=Number(key);if(!/^(0|[1-9][0-9]*)$/.test(key)||!Number.isSafeInteger(i)||i>=game.moves.length)fail();
   const c=comparisonFor(game,i);if(!c)fail();row(c.best,c.fen);row(c.played,c.fen);comparisons++;
  }
 }
 return {rowCount:rows,comparisonCount:comparisons};
}
