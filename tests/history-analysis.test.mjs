import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {completeGameAnalysis,missingAnalysisPositions,saveCompletedAnalysis} from '../dist/history-analysis.js';

const row=(cp=0,uci)=>[{cp,line:uci?[{uci}]:[]}];
function sample(){
 const board=new Chess(),positions=[board.fen()];
 const moves=['e4','h6'].map(san=>{
  const move=board.move(san);
  positions.push(board.fen());
  return {uci:move.from+move.to,san};
 });
 return {id:'synthetic',color:'black',positions,moves,evals:[row(),null,row(200)],training:{1:{streak:2}}};
}
const check=()=>{};
test('fills missing scores, retains existing rows and compares suspicious moves for the selected side',async()=>{
 const game=sample(),before=JSON.stringify(game),calls=[];
 const missing=missingAnalysisPositions(game);
 assert.deepEqual(missing,[1]);
 const result=await completeGameAnalysis(game,missing,async(fen,ms,{searchMove}={})=>{
  calls.push([fen,searchMove]);
  return row(searchMove==='h7h6'?200:-100,searchMove||'e7e5');
 },check,()=>{});
 assert.deepEqual(calls,[[game.positions[1],undefined],[game.positions[1],'e7e5'],[game.positions[1],'h7h6']]);
 assert.deepEqual(result.comparisons[1].played.line,[{uci:'h7h6'}]);
 assert.equal(result.evals[2],game.evals[2]);
 assert.equal(result.training,game.training);
 assert.deepEqual(missingAnalysisPositions(result),[]);
 assert.equal(JSON.stringify(game),before);
});
test('stop during a position leaves the original party and evaluations intact',async()=>{
 const game=sample(),before=JSON.stringify(game);let stopped=false;
 await assert.rejects(completeGameAnalysis(game,[1],async()=>{
  stopped=true;return row(30,'e7e5');
 },()=>{if(stopped)throw Error('stopped')},()=>{}),/stopped/);
 assert.equal(JSON.stringify(game),before);
});
test('writes one completed game, preserves other data and rejects a stale view or failed write',()=>{
 const game=sample(),hidden={id:'old-hidden'},other={...sample(),id:'other'},completed={...game,evals:[row(),row(),row()]};
 let stored=JSON.stringify([game,hidden,other]),fail=false;
 const storage={getItem:()=>stored,setItem:(key,value)=>{if(fail)throw Error('quota');stored=value}};
 const visible=g=>Array.isArray(g.evals),current=[game,other],before=stored;
 fail=true;
 assert.throws(()=>saveCompletedAnalysis(storage,current,visible,game,completed),/Не удалось сохранить/);
 assert.equal(stored,before);
 fail=false;
 saveCompletedAnalysis(storage,current,visible,game,completed);
 assert.deepEqual(JSON.parse(stored),[completed,hidden,other]);
 assert.throws(()=>saveCompletedAnalysis(storage,current,visible,other,other),/изменился/);
 assert.deepEqual(JSON.parse(stored),[completed,hidden,other]);
});
