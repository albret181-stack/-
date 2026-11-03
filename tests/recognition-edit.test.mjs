import test from 'node:test';
import assert from 'node:assert/strict';
import {editRecognition} from '../dist/recognition-edit.js';
const original={moves:[{uci:'e2e4',san:'e4',time:1,recovered:true},{uci:'e7e5',san:'e5',time:1,recovered:true},{uci:'g1f3',san:'Nf3',time:2}],duration:4,result:'*',recoveredCount:2,recognitionWarning:'Check gap'};
test('editing preserves only the unchanged prefix timestamps and never mutates source',()=>{
 const snapshot=structuredClone(original),out=editRecognition(original,'1. e4 e5 2. Nc3 *');
 assert.deepEqual(original,snapshot);assert.equal(out.moves[0].time,1);assert.equal(out.moves[2].time,undefined);assert.equal(out.moves[2].manualEdited,true);assert.equal(out.moves[2].san,'Nc3');assert.equal(out.recoveredCount,2);
});
test('invalid and empty PGNs are rejected without changing source',()=>{
 const snapshot=structuredClone(original);
 for(const text of ['1. e4 e5 2. Qh9','', '[SetUp "1"]\n[FEN "8/8/8/8/8/8/1k6/6K1 w - - 0 1"]\n\n1. Kf1 *'])assert.throws(()=>editRecognition(original,text));
 assert.deepEqual(original,snapshot);
});
test('same moves restore original diagnostics; shorter game is marked edited',()=>{
 assert.deepEqual(editRecognition(original,'1. e4 e5 2. Nf3 *'),original);
 const shorter=editRecognition(original,'1. e4 *');assert.equal(shorter.manuallyEdited,true);assert.equal(shorter.moves.length,1);assert.equal(shorter.recoveredCount,1);
});
test('result comes from board, not an arbitrary PGN result header',()=>{
 assert.equal(editRecognition(original,'1. d4 1-0').result,'*');
 assert.equal(editRecognition(original,'1. f3 e5 2. g4 Qh4# *').result,'0-1');
});
