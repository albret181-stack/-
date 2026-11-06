import {test} from 'node:test';
import assert from 'node:assert/strict';
import {learningBackup} from '../dist/backup.js';
test('backup preserves old and new game data without changing live state',()=>{
 const games=[{id:'sample-demo',moves:[]},{id:'local-1',title:'<тест>',moves:[{uci:'e2e4'}],positions:['before','after'],evals:[null,{cp:34}],training:{0:{solved:true,nextReviewAt:123}},comparisons:{0:{loss:20}},futureField:{nested:[1,2]}},{id:'local-legacy',moves:[]}];
 const before=JSON.stringify(games),copy=JSON.parse(learningBackup(games,{appVersion:'test',now:new Date('2026-11-06T00:00:00Z')}));
 assert.equal(copy.format,'chess-atelier-learning');assert.equal(copy.version,1);assert.equal(copy.createdAt,'2026-11-06T00:00:00.000Z');assert.deepEqual(copy.games,games.slice(1));assert.equal(JSON.stringify(games),before);
});
test('no misleading empty backup',()=>{assert.throws(()=>learningBackup([{id:'sample-demo'}]),/нет своих/)});
