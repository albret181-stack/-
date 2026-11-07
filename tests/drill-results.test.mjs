import test from 'node:test';
import assert from 'node:assert/strict';
import {readDrillResult,saveDrillResult} from '../dist/drill-results.js';

function memory(){
 const values=new Map([['atelier-games-v1','[{"id":"saved-game"}]']]);
 return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
}
test('keeps first outcome, updates latest and isolates exercises and games',()=>{
 const storage=memory();
 assert.equal(readDrillResult(storage,'a'),null);
 saveDrillResult(storage,'a','revealed');
 saveDrillResult(storage,'b','independent');
 assert.deepEqual(saveDrillResult(storage,'a','assisted'),{first:'revealed',latest:'assisted'});
 assert.deepEqual(readDrillResult(storage,'b'),{first:'independent',latest:'independent'});
 assert.equal(storage.getItem('atelier-games-v1'),'[{"id":"saved-game"}]');
});
test('invalid results and failed storage writes leave the previous result intact',()=>{
 const storage=memory();
 saveDrillResult(storage,'a','independent');
 assert.throws(()=>saveDrillResult(storage,'a','failed'),/Неизвестный результат/);
 storage.setItem=()=>{throw new Error('quota')};
 assert.throws(()=>saveDrillResult(storage,'a','revealed'),/quota/);
 assert.deepEqual(readDrillResult(storage,'a'),{first:'independent',latest:'independent'});
});
