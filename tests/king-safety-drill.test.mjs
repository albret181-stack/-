import test from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {kingSafetyDrill as drill,kingSafetyReply,matchesKingSafetyDrill} from '../dist/king-safety-drill.js';

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

test('matches a preventable back-rank mate for either side',()=>{
 assert.equal(matchesKingSafetyDrill('3r2k1/7p/8/8/8/R7/5PPP/6K1 w - - 0 1','a3a4','h2h3','d8d1'),true);
 assert.equal(matchesKingSafetyDrill('6k1/r4ppp/8/8/8/8/7P/3R2K1 b - - 0 1','a7a6','h7h6','d1d8'),true);
});
test('does not offer this exercise for diagonal mate, a mere check, or the same training position',()=>{
 const board=new Chess();
 board.move('f3');board.move('e5');
 assert.equal(matchesKingSafetyDrill(board.fen(),'g2g4','e2e4','d8h4'),false);
 const fen='3r2k1/7p/8/8/8/R7/5PPP/6K1 w - - 0 1';
 assert.equal(matchesKingSafetyDrill(fen,'h2h3','h2h4','d8d1'),false);
 assert.equal(matchesKingSafetyDrill(fen,'a3a4','a3a5','d8d1'),false);
 assert.equal(matchesKingSafetyDrill(fen,'a3a4','h2h3',null),false);
 assert.equal(matchesKingSafetyDrill(drill.fen.replace('0 1','2 9'),'a2a3','h2h3','e8e1'),false);
});
