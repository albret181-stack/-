import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectBackupEnvelope} from '../dist/backup-envelope.mjs';
const envelope={format:'chess-atelier-learning',version:1,games:[{id:'local-old'},{id:'local-new',training:{0:{solved:true}}}]};
test('counts legacy and current records without changing input',()=>{
 const text=JSON.stringify(envelope);assert.deepEqual(inspectBackupEnvelope(text),{gameCount:2,version:1});assert.equal(JSON.stringify(envelope),text);
});
test('rejects damaged JSON and foreign envelope',()=>{
 for(const text of ['{','null','[]','{}',JSON.stringify({...envelope,format:'other'})])assert.throws(()=>inspectBackupEnvelope(text));
});
test('rejects unsupported versions and malformed game lists',()=>{
 for(const patch of [{version:2},{version:'1'},{games:[]},{games:{}},{games:[null]},{games:[{id:'sample-demo'}]},{games:[{id:' '}]},{games:[{id:'a'},{id:'a'}]}])assert.throws(()=>inspectBackupEnvelope(JSON.stringify({...envelope,...patch})));
});
