import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {learningBackup} from '../dist/backup.js';
import {prepareBackupRestore} from '../dist/backup-restore.mjs';

function game(id){
 const board=new Chess(),start=board.fen();
 board.move('e2e4');
 return {id,title:'Тест',color:'white',moves:[{uci:'e2e4'}],positions:[start,board.fen()],evals:[null,null],training:{0:{solved:true}}};
}
const backup=()=>learningBackup([game('same'),game('new')]);
function fixture(value=null){
 return {value,writes:0,getItem(key){assert.equal(key,'atelier-games-v1');return this.value},
  setItem(key,next){assert.equal(key,'atelier-games-v1');this.writes++;this.value=next}};
}
test('writes only on confirmation and keeps current records intact',()=>{
 const current={...game('same'),training:{0:{solved:false}}},s=fixture(JSON.stringify([current]));
 const preview=prepareBackupRestore(backup(),s);
 assert.equal(s.writes,0);assert.equal(preview.summary.addedCount,1);
 assert.deepEqual(preview.commit().games,[current,game('new')]);
 assert.deepEqual(JSON.parse(s.value),[current,game('new')]);
 assert.equal(s.writes,1);
 assert.equal(prepareBackupRestore(backup(),s).commit().summary.addedCount,0);
 assert.equal(s.writes,1);
});
test('refuses stale confirmation, invalid storage and invalid backup',()=>{
 const s=fixture(),p=prepareBackupRestore(backup(),s);
 s.value=JSON.stringify([game('other-tab')]);
 assert.throws(()=>p.commit(),/изменился/);
 s.value='broken';
 assert.throws(()=>prepareBackupRestore(backup(),s),/отменено/);
 s.value=null;
 assert.throws(()=>prepareBackupRestore('{}',s),/не копия/);
 assert.equal(s.writes,0);
});
test('a quota error leaves the stored snapshot intact and can be retried',()=>{
 const previous=JSON.stringify([game('same')]),s=fixture(previous),write=s.setItem;
 s.setItem=()=>{throw new Error('quota')};
 const p=prepareBackupRestore(backup(),s);
 assert.throws(()=>p.commit(),/Не удалось сохранить/);
 assert.equal(s.value,previous);
 s.setItem=write;
 assert.equal(p.commit().summary.addedCount,1);
});
