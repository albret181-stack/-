import test from 'node:test';import assert from 'node:assert/strict';import {Chess} from '../dist/chess.js';import {personalCoach} from '../dist/personal-coach.js';import {recordPractice} from '../dist/practice-memory.js';
function game(id,sans=['e4','e5'],color='white'){const b=new Chess(),positions=[b.fen()],moves=sans.map(s=>{const m=b.move(s);positions.push(b.fen());return {uci:m.from+m.to,san:m.san}});return {id,color,positions,moves}}
const lesson=(g,key='king')=>({reviewed:1,verified:0,themeCounts:[{key,count:1,title:'Тема',tip:'Проверьте угрозу'}],exercises:[{index:0,loss:200,best:{uci:'d2d4'}}]});
test('confirmed themes aggregate across distinct games even once per game',()=>{const a=game('a'),b=game('b',['e4','c5']);const p=personalCoach([a,b],lesson,100);assert.equal(p.gameCount,2);assert.equal(p.repeated[0].games,2);assert.equal(p.repeated[0].count,2)});
test('identical imported games do not inflate topics or training',()=>{const a=game('a'),b={...a,id:'copy'};const p=personalCoach([a,b],lesson,100);assert.equal(p.gameCount,1);assert.equal(p.duplicates,1);assert.equal(p.repeated.length,0);assert.equal(p.exerciseCount,1)});
test('same exercise in different games is deduplicated and retains newest progress',()=>{const a=game('a'),b=game('b',['e4','c5']);b.training={0:recordPractice(null,{fen:b.positions[0],bestUci:'d2d4'},'solved',{now:100})};const p=personalCoach([a,b],lesson,200);assert.equal(p.exerciseCount,1);assert.equal(p.readyCount,0);assert.equal(p.solvedCount,1);assert.equal(p.allQueue[0].sourceGame,b)});
test('duplicate game progress is carried on the representative exercise without mutating games',()=>{const a=game('new'),b={...a,id:'old',training:{0:recordPractice(null,{fen:a.positions[0],bestUci:'d2d4'},'solved',{now:100})}};const before=JSON.stringify([a,b]);const p=personalCoach([a,b],lesson,200);assert.equal(p.readyCount,0);assert.equal(p.solvedCount,1);assert.equal(p.allQueue[0].sourceGame,a);assert.equal(JSON.stringify([a,b]),before)});
test('unknown causes, demos and unavailable evaluations never invent a pattern',()=>{const a=game('a'),b=game('b',['e4','c5']);const p=personalCoach([a,b,game('sample-demo'),{id:'bad'}],g=>lesson(g,'calculation'),100);assert.equal(p.repeated.length,0);assert.equal(p.gameCount,2);assert.equal(p.unavailable,1)});
test('all-game queue prioritizes unresolved positions and retains their source',()=>{const a=game('a'),b=game('b',['d4','d5']);b.training={0:{fen:b.positions[0],bestUci:'e2e4',lastResult:'failed',nextReviewAt:0,updatedAt:10}};const p=personalCoach([a,b],g=>({...lesson(g),exercises:[{index:0,loss:100,best:{uci:g.id==='b'?'e2e4':'d2d4'}}]}),100);assert.equal(p.queue[0].sourceGame,b);assert.equal(p.queue.length,2)});
test('stale progress and throwing analysis are ignored without removing games',()=>{const a=game('a'),b=game('b',['d4','d5']);a.training={0:{fen:'stale',bestUci:'d2d4',solved:true,nextReviewAt:1e12}};const p=personalCoach([a,b],g=>{if(g.id==='b')throw Error('bad');return lesson(g)},100);assert.equal(p.readyCount,1);assert.equal(p.solvedCount,0);assert.equal(p.unavailable,1)});
test('report picks the strongest example per game and separates unknown causes',()=>{
 const a=game('a'),b=game('b',['e4','c5']),pending=game('pending',['d4','d5']);
 const result=personalCoach([a,{...a,id:'copy'},b,pending],g=>{
  if(g===pending)return {reviewed:0};
  const king=(loss,reason)=>({index:0,theme:'king',loss,reason});
  return {...lesson(g),themeCounts:[{key:'king',count:g===a?2:1},{key:'calculation',count:1}],
   errors:g===a?[king(90,'weaker'),king(200,'strongest')]:[king(100,'second game')]};
 });
 assert.equal(result.gameCount,2);
 assert.equal(result.unavailable,1);
 assert.equal(result.unclassified,2);
 assert.equal(result.repeated[0].count,3);
 assert.deepEqual(result.repeated[0].examples.map(e=>[e.sourceGame.id,e.reason]),[['a','strongest'],['b','second game']]);
});
