import {Chess} from './chess.js';
export const COMPARISON_NODES=60000;
export async function compareMoves(analyze,fen,playedUci,bestUci,check=()=>{}){
 for(const uci of [playedUci,bestUci]){const b=new Chess(fen);b.move(uci)}
 const get=async uci=>{check();const rows=await analyze(fen,1500,{nodes:COMPARISON_NODES,searchMove:uci});check();const row=rows?.[0];if(!Number.isFinite(row?.cp)||row.line?.[0]?.uci!==uci)throw new Error('Движок не подтвердил сравниваемый ход. Прежний разбор сохранён.');return row};
 const best=await get(bestUci),played=playedUci===bestUci?best:await get(playedUci);
 return {fen,playedUci,bestUci,best,played,nodes:COMPARISON_NODES,method:'equal-nodes-v1'};
}
export function comparisonFor(game,index){const c=game.comparisons?.[index];if(c?.method!=='equal-nodes-v1'||c.nodes!==COMPARISON_NODES||c.fen!==game.positions[index]||c.playedUci!==game.moves[index]?.uci||c.best?.line?.[0]?.uci!==c.bestUci||c.played?.line?.[0]?.uci!==c.playedUci||!Number.isFinite(c.best.cp)||!Number.isFinite(c.played.cp))return null;try{const b=new Chess(c.fen);b.move(c.bestUci);return c}catch{return null}}
