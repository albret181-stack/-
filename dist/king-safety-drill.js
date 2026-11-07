import {Chess} from './chess.js';
import {practiceReply} from './practice-memory.js';

// Original teaching position: Black threatens ...Re1# if White ignores the back rank.
export const kingSafetyDrill={
 index:0,
 fen:'4r1k1/7p/8/8/8/8/R4PPP/6K1 w - - 0 1',
 title:'Безопасность короля',
 goal:'Ход белых. Сделайте ход, после которого чёрные не смогут поставить мат сразу.',
 tip:'Проверьте шахи чёрной ладьи и найдите для короля поле отхода.',
 best:{uci:'h2h3'},
 explanation:'Например, h3 освобождает h2. Если чёрные сыграют ладьёй на e1 с шахом, король сможет уйти на h2.'
};

export function kingSafetyReply(fen,uci){
 const board=new Chess(fen);
 board.move(uci);
 const mate=board.moves({verbose:true}).find(move=>move.san.endsWith('#'));
 return mate?practiceReply(fen,uci,mate.from+mate.to+(mate.promotion||'')):null;
}
