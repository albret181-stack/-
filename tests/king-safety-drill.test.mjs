import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {kingSafetyDrill as drill,kingSafetyReply} from '../dist/king-safety-drill.js';

test('ignoring the back rank allows the exact mate shown in the exercise',()=>{
 const reply=kingSafetyReply(drill.fen,'a2a3');
 assert.equal(reply.replySan,'Re1#');
 assert.equal(reply.from,'e8');
 assert.equal(reply.to,'e1');
 assert.equal(new Chess(reply.fen).isCheckmate(),true);
});
test('the example creates the stated escape square and other legal defenses are accepted',()=>{
 assert.equal(kingSafetyReply(drill.fen,drill.best.uci),null);
 const board=new Chess(drill.fen);
 board.move(drill.best.uci);
 assert.equal(board.move('e8e1').san,'Re1+');
 assert.equal(board.move('g1h2').san,'Kh2');
 for(const uci of ['h2h4','a2a1','a2e2'])assert.equal(kingSafetyReply(drill.fen,uci),null);
 assert.throws(()=>kingSafetyReply(drill.fen,'h2g3'));
});
