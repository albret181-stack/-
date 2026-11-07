import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {previewLearningBackup} from '../dist/backup-preview.mjs';
function fixture(){const b=new Chess(),fen=b.fen();b.move('e2e4');return {id:'local-synthetic',title:'Тест',color:'white',moves:[{uci:'e2e4',san:'e4'}],positions:[fen,b.fen()],evals:[[{cp:10,line:[{uci:'e2e4'}]}],null],training:{0:{solved:true}}}}
const encode=games=>JSON.stringify({format:'chess-atelier-learning',version:1,games});
test('combined preview counts saved data without returning writable games',()=>{const text=encode([fixture(),{...fixture(),id:'local-other'}]);assert.deepEqual(previewLearningBackup(text),{gameCount:2,moveCount:2,progressCount:2,analysisCount:2,comparisonCount:0});assert.equal(text,encode([fixture(),{...fixture(),id:'local-other'}]))});
test('rejects entire copy if later game is damaged and identifies its number',()=>{for(const mutate of [g=>g.moves[0].uci='e2e5',g=>g.training[0].solved='true',g=>g.evals[0][0].cp='bad',g=>g.color='other']){const good=fixture(),bad={...fixture(),id:'local-bad'};mutate(bad);assert.throws(()=>previewLearningBackup(encode([good,bad])),/Партия 2:/)}});
test('foreign envelope is rejected before examining games',()=>assert.throws(()=>previewLearningBackup('{}')));
