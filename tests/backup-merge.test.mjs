import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {planBackupMerge} from '../dist/backup-merge.mjs';
function game(id){const b=new Chess(),fen=b.fen();b.move('e2e4');return {id,title:'Тест',color:'white',moves:[{uci:'e2e4'}],positions:[fen,b.fen()],evals:[null,null],training:{0:{solved:true}}}}
const encode=games=>JSON.stringify({format:'chess-atelier-learning',version:1,games});
test('adds new games and preserves existing progress on ID collision',()=>{const current=[game('same')],incoming=[{...game('same'),training:{}},game('new')],before=JSON.stringify(current);const p=planBackupMerge(encode(incoming),current);assert.equal(p.summary.addedCount,1);assert.equal(p.summary.skippedCount,1);assert.deepEqual(p.games,[...current,incoming[1]]);p.games[0].training[0].solved=false;assert.equal(JSON.stringify(current),before)});
test('repeated recovery is idempotent and accepts empty destination',()=>{const text=encode([game('new')]),first=planBackupMerge(text,[]),second=planBackupMerge(text,first.games);assert.deepEqual(second.games,first.games);assert.equal(second.summary.addedCount,0)});
test('invalid incoming record rejects whole merge even when its ID exists',()=>{const bad=game('same');bad.moves[0].uci='e2e5';const current=[game('same')],before=JSON.stringify(current);assert.throws(()=>planBackupMerge(encode([game('new'),bad]),current));assert.equal(JSON.stringify(current),before)});
