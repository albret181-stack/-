import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {validateBackupProgress} from '../dist/backup-progress.mjs';
const fixture=()=>({moves:[{uci:'e2e4'}],positions:[new Chess().fen()],training:{0:{fen:new Chess().fen(),bestUci:'e2e4',solved:true,attempts:2,nextReviewAt:123,updatedAt:100,lastResult:'solved'}}});
test('preserves valid progress and optional legacy fields',()=>{const g=fixture(),before=JSON.stringify(g);assert.deepEqual(validateBackupProgress(g),{recordCount:1});assert.equal(JSON.stringify(g),before);assert.equal(validateBackupProgress({}).recordCount,0);assert.equal(validateBackupProgress({...g,training:{0:{solved:true}}}).recordCount,1)});
test('rejects broken progress without changing original game',()=>{for(const patch of [{solved:'true'},{attempts:-1},{updatedAt:1.5},{nextReviewAt:Infinity},{fen:'other'},{bestUci:'e2e5'},{lastResult:'unknown'}]){const g=fixture();Object.assign(g.training[0],patch);assert.throws(()=>validateBackupProgress(g))}});
test('rejects foreign indexes and malformed containers',()=>{for(const training of [null,[],{'-1':{}},{'01':{}},{1:{}},{0:null}])assert.throws(()=>validateBackupProgress({...fixture(),training}))});
