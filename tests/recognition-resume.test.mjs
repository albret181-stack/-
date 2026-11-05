import test from 'node:test';import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';import {boardKey} from '../dist/video-sequence.js';import {RecognitionResume} from '../dist/recognition-resume.js';
function draft(sans,orientation='white'){const b=new Chess();return {orientation,duration:10,moves:sans.map((san,i)=>{const m=b.move(san);return {uci:m.from+m.to+(m.promotion||''),san:m.san,time:i/2}})}}
function observe(resume,board,t,errorScore=0){const raw=boardKey(board);return resume.observe({key:resume.orientation==='black'?[...raw].reverse().join(''):raw,errorScore,t})}
function anchor(resume,board){observe(resume,board,1);observe(resume,board,1.2);assert.equal(resume.anchored,true)}
function append(resume,board,san,t){board.move(san);observe(resume,board,t);observe(resume,board,t+.2)}
test('resume is atomic, preserves prefix metadata and replaces only tail',()=>{
 const d=draft(['e4','e5','Nf3']),before=structuredClone(d),r=new RecognitionResume(d,2,1),b=new Chess();b.move('e4');b.move('e5');anchor(r,b);append(r,b,'Nc3',2);
 assert.deepEqual(d,before);const out=r.finish({moves:r.moves,duration:10,lastTime:r.lastTime,orientation:r.orientation,recognitionGaps:[]});
 assert.deepEqual(out.moves.slice(0,2),d.moves.slice(0,2));assert.deepEqual(out.moves.map(m=>m.uci),['e2e4','e7e5','b1c3']);assert.deepEqual(out.resumedFrom,{index:2,time:1});assert.deepEqual(d,before);
});
test('wrong or isolated anchor cannot accept continuation',()=>{
 const d=draft(['e4','e5']),r=new RecognitionResume(d,2,1),b=new Chess();observe(r,b,1);assert.throws(()=>observe(r,b,2.2),/Кадр не совпал/);assert.equal(r.moves.length,0);assert.throws(()=>r.finish({moves:[]}),/подтвердить/);
 const q=new RecognitionResume(d,2,1);b.move('e4');b.move('e5');observe(q,b,1);observe(q,b,1.2,1);assert.equal(q.anchored,false);
});
test('full state allows castling after resume',()=>{
 const d=draft(['e4','e5','Nf3','Nc6','Bc4','Nf6']),b=new Chess();d.moves.forEach(m=>b.move(m.uci));const r=new RecognitionResume(d,6,1);anchor(r,b);append(r,b,'O-O',2);assert.equal(r.moves[0].uci,'e1g1');assert.equal(r.board.fen(),b.fen());
});
test('en passant and black-bottom orientation survive resume',()=>{
 const d=draft(['e4','a6','e5','d5'],'black'),b=new Chess();d.moves.forEach(m=>b.move(m.uci));const r=new RecognitionResume(d,4,1);anchor(r,b);append(r,b,'exd6',2);assert.equal(r.moves[0].uci,'e5d6');assert.equal(r.board.fen(),b.fen());
});
test('invalid start and empty extension leave edited draft unchanged',()=>{
 const d={...draft(['e4','e5']),manuallyEdited:true},before=structuredClone(d);for(const t of [-1,NaN,9.8])assert.throws(()=>new RecognitionResume(d,2,t));assert.throws(()=>new RecognitionResume(d,0,1));
 const r=new RecognitionResume(d,2,1),b=new Chess();d.moves.forEach(m=>b.move(m.uci));anchor(r,b);assert.throws(()=>r.finish({moves:[]}),/новых ходов/);assert.deepEqual(d,before);
});
