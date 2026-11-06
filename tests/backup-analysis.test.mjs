import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {validateBackupAnalysis} from '../dist/backup-analysis.mjs';
const fixture=()=>({positions:[new Chess().fen()],moves:[{uci:'e2e4'}],evals:[[{cp:20,line:[{uci:'e2e4'},{uci:'e7e5'}]}]]});
test('validates analysis without mutation and permits uncalculated positions',()=>{const g=fixture(),before=JSON.stringify(g);assert.deepEqual(validateBackupAnalysis(g),{rowCount:1,comparisonCount:0});assert.equal(JSON.stringify(g),before);g.evals=[null];assert.equal(validateBackupAnalysis(g).rowCount,0)});
test('rejects malformed score and illegal continuation',()=>{for(const patch of [{cp:'20'},{cp:Infinity},{mate:1.5},{line:[{uci:'e2e5'}]},{line:[{uci:'e2e4'},{uci:'d2d4'}]}]){const g=fixture();Object.assign(g.evals[0][0],patch);assert.throws(()=>validateBackupAnalysis(g))}});
test('validates equal-node comparison identity and rows',()=>{const g=fixture(),r={cp:20,line:[{uci:'e2e4'}]};g.comparisons={0:{fen:g.positions[0],playedUci:'e2e4',bestUci:'e2e4',best:r,played:r,nodes:60000,method:'equal-nodes-v1'}};assert.equal(validateBackupAnalysis(g).comparisonCount,1);g.comparisons[0].nodes=1;assert.throws(()=>validateBackupAnalysis(g))});
