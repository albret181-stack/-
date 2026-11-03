import {Chess} from './chess.js';

export const boardKey = board => board.board().flat().map(p => p ? (p.color === 'w' ? p.type.toUpperCase() : p.type) : '.').join('');
const uci = move => move.from + move.to + (move.promotion || '');
const plausible = key => typeof key === 'string' && /^[prnbqkPRNBQK.]{64}$/.test(key)
 && [...key].filter(p => p === 'K').length === 1 && [...key].filter(p => p === 'k').length === 1
 && [...key].filter(p => p !== '.').length <= 32;

// Only exact observed boards are accepted. Never choose a path by engine score.
export class VideoSequence {
 constructor(fen, {maxNodes=4096}={}) {
  this.maxNodes=maxNodes;
  this.board = new Chess(fen); this.moves = []; this.lastTime = 0;
  this.previous = ''; this.stable = 0; this.seen = new Set([boardKey(this.board)]);
  this.refresh();
 }
 refresh() {
  this.key = boardKey(this.board); this.single = new Map(); this.double = null;
  for (const move of this.board.moves({verbose:true})) {
   this.board.move(move); this.single.set(boardKey(this.board), uci(move)); this.board.undo();
  }
 }
 twoPlyPaths() {
  if (this.double) return this.double;
  this.double = new Map(); let nodes=0;
  for (const first of this.board.moves({verbose:true})) {
   this.board.move(first);
   for (const second of this.board.moves({verbose:true})) {
    if (++nodes > this.maxNodes) { this.board.undo(); this.double = new Map(); return this.double; }
    this.board.move(second); const key = boardKey(this.board);
    // Null records ambiguity rather than silently replacing another path.
    this.double.set(key, this.double.has(key) ? null : [uci(first), uci(second)]);
    this.board.undo();
   }
   this.board.undo();
  }
  return this.double;
 }
 observe({key, errorScore, t}) {
  if (!Number.isFinite(t) || t < 0) throw new Error('Invalid frame timestamp');
  if (!Number.isFinite(errorScore) || errorScore >= .025 || !plausible(key)) {
   this.previous = ''; this.stable = 0; return {status:'uncertain'};
  }
  this.stable = key === this.previous ? this.stable + 1 : 1; this.previous = key;
  if (this.stable < 2) return {status:'unstable'};
  if (key === this.key) return {status:'same'};
  let path = this.single.has(key) ? [this.single.get(key)] : null;
  if (!path && this.seen.has(key)) return {status:'replay'};
  if (!path) path = this.twoPlyPaths().get(key);
  if (!path) return {status:'unmatched'};
  const recovered = path.length === 2, after = this.lastTime, added = [];
  for (const move of path) {
   const played = this.board.move(move);
   const entry = {uci:move, san:played.san, time:+t.toFixed(1)};
   if (recovered) Object.assign(entry, {recovered:true, timeRange:[after, +t.toFixed(1)]});
   this.moves.push(entry); added.push(entry); this.seen.add(boardKey(this.board));
  }
  this.lastTime = t; this.refresh();
  return {status:recovered ? 'recovered' : 'move', added, after};
 }
}
