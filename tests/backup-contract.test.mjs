import {test} from 'node:test';
import assert from 'node:assert/strict';
import {learningBackup} from '../dist/backup.js';
import {inspectBackupEnvelope} from '../dist/backup-envelope.mjs';
test('exported backups remain readable by envelope inspector with legacy data and progress',()=>{
 const games=[{id:'sample-demo'},{id:'legacy',moves:[]},{id:'own',moves:[{uci:'e2e4'}],training:{0:{solved:true,nextReviewAt:123}},comparisons:{0:{loss:20}},future:{value:'сохранить'}}];
 const before=JSON.stringify(games);
 const text=learningBackup(games,{appVersion:'test'});
 assert.deepEqual(inspectBackupEnvelope(text),{gameCount:2,version:1});
 assert.deepEqual(JSON.parse(text).games,games.slice(1));
 assert.equal(JSON.stringify(games),before);
});
test('duplicate IDs in exported source are rejected before any recovery',()=>{
 const text=learningBackup([{id:'same',moves:[]},{id:'same',moves:[]}]);
 assert.throws(()=>inspectBackupEnvelope(text),/повторяются/);
});
