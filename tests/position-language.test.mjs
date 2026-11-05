import test from 'node:test';import assert from 'node:assert/strict';import {Chess} from '../dist/chess.js';import {positionalComparison} from '../dist/position-language.js';
test('h3 versus d4 explains centre and concrete attacked fields',()=>{const r=positionalComparison(new Chess().fen(),'h2h3','d2d4');assert.match(r.better,/центральное поле d4/);assert.match(r.better,/контролировать e5/);assert.doesNotMatch(r.better,/выигрываете|беззащит/)});
test('equivalent central pawn moves do not invent a unique benefit',()=>{assert.equal(positionalComparison(new Chess().fen(),'e2e4','d2d4'),null)});
test('invalid move does not generate explanation',()=>{assert.equal(positionalComparison(new Chess().fen(),'h2h8','d2d4'),null)});
