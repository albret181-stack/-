import {Chess} from './chess.js';
const centre=['d4','e4','d5','e5'];
const name={p:'пешка',n:'конь',b:'слон',r:'ладья',q:'ферзь',k:'король'};
function features(fen,uci){
 const before=new Chess(fen),b=new Chess(fen),m=b.move(uci),rank=m.color==='w'?'1':'8',rows=[];
 const add=(key,text)=>rows.push({key,text});
 if(centre.includes(m.to)&&m.piece==='p')add('centre',`Пешка занимает центральное поле ${m.to}: оттуда она ограничивает движение фигур соперника в середине доски.`);
 const controlled=centre.filter(s=>b.attackers(s,m.color).includes(m.to)&&!before.attackers(s,m.color).includes(m.from));
 if(controlled.length)add('pressure',`${name[m.promotion||m.piece][0].toUpperCase()+name[m.promotion||m.piece].slice(1)} начинает контролировать ${controlled.join(' и ')}. Фигуру соперника, пришедшую на эти поля, можно будет атаковать; возможность взятия зависит от связок и защиты.`);
 if(['n','b'].includes(m.piece)&&m.from[1]===rank&&m.to[1]!==rank)add('development',`Вы выводите ${m.piece==='n'?'коня':'слона'} с начального ряда в игру. Теперь фигура может участвовать в борьбе за центр вместо того, чтобы оставаться за пешками.`);
 if(m.flags.includes('k')||m.flags.includes('q'))add('castle','Рокировка убирает короля из центра и одновременно выводит ладью ближе к игре. Это не гарантирует безопасность, но решает сразу две задачи развития.');
 // Check newly opened diagonal squares for each bishop, stopping at the first occupied square.
 const rays=(board,sq,color)=>{const out=[];for(const [dx,dy] of [[1,1],[1,-1],[-1,1],[-1,-1]]){let x=sq.charCodeAt(0)-97+dx,y=+sq[1]+dy;while(x>=0&&x<8&&y>=1&&y<=8){const s=String.fromCharCode(97+x)+y,p=board.get(s);if(p?.color===color)break;out.push(s);if(p)break;x+=dx;y+=dy}}return out};
 if(m.piece==='p')for(const row of b.board())for(const piece of row){if(piece?.color!==m.color||piece.type!=='b')continue;const old=rays(before,piece.square,m.color),opened=rays(b,piece.square,m.color).filter(s=>!old.includes(s));if(opened.length>=2)add('bishop',`После ухода пешки открывается диагональ слону на ${piece.square}: ему становятся доступны направления через ${opened.slice(0,3).join(', ')}. Так слона проще подключить к игре. Это описание открытой линии, а не обещание безопасного хода слоном.`)}
 if(m.piece==='r'&&!b.board().flat().some(p=>p?.type==='p'&&p.square[0]===m.to[0]))add('file',`Ладья занимает открытую вертикаль ${m.to[0]}: пешек на ней нет, поэтому ей проще действовать вдоль этой линии.`);
 return rows;
}
export function positionalComparison(fen,played,best){try{const a=features(fen,played),b=features(fen,best),keys=new Set(a.map(x=>x.key)),extra=b.filter(x=>!keys.has(x.key));if(!extra.length)return null;return {better:extra.slice(0,2).map(x=>x.text).join(' '),reason:'Сыгранный ход не решает задачи, которые доступны лучшему варианту: '+extra.slice(0,2).map(x=>x.text).join(' ')+' Это видимые позиционные различия; они не доказывают всю численную разницу оценки.'};}catch{return null}}
