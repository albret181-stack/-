import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Chess} from '../dist/chess.js';
import {validateBackupSequence} from '../dist/backup-sequence.mjs';
function fixture(){const b=new Chess(),g={moves:[],positions:[b.fen()],training:{0:{solved:true}}};for(const uci of ['e2e4','e7e5','g1f3']){const m=b.move(uci);g.moves.push({uci,san:m.san});g.positions.push(b.fen())}return g}
test('validates synthetic sequence without changing progress',()=>{const g=fixture(),before=JSON.stringify(g);assert.deepEqual(validateBackupSequence(g),{moveCount:3});assert.equal(JSON.stringify(g),before)});
test('rejects illegal moves, mismatched positions and notation',()=>{for(const mutate of [g=>g.moves[0].uci='e2e5',g=>g.positions[2]=g.positions[0],g=>g.moves[0].san='e5',g=>g.positions.pop(),g=>g.moves[0].uci='bad']){const g=fixture();mutate(g);assert.throws(()=>validateBackupSequence(g))}});
test('accepts older moves without SAN',()=>{const g=fixture();g.moves.forEach(m=>delete m.san);assert.equal(validateBackupSequence(g).moveCount,3)});
