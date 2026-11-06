import {tacticalConcepts} from './tactical-concepts.js';
import {Chess} from './chess.js';
import {moveStory} from './move-language.js';
const targetNames={p:'пешку',n:'коня',b:'слона',r:'ладью',q:'ферзя',k:'короля'};
const names={p:'пешка',n:'конь',b:'слон',r:'ладья',q:'ферзь',k:'король'};
export function squarePoint(square,flipped=false){const x=square.charCodeAt(0)-97,y=8-Number(square[1]);return flipped?[7-x+.5,7-y+.5]:[x+.5,y+.5]}
export function moveVisuals(fen,uci){
 try{
 const b=new Chess(fen),m=b.move(uci),story=moveStory(fen,uci),actor=b.get(m.to),rows=[{from:m.from,to:m.to,kind:'move',knight:m.piece==='n',text:story.action}];
 if(b.isCheck()){const king=b.board().flat().find(p=>p?.type==='k'&&p.color!==m.color);for(const from of b.attackers(king.square,m.color).slice(0,2))rows.push({from,to:king.square,kind:'threat',knight:b.get(from)?.type==='n',text:'Шах: '+names[b.get(from).type]+' на '+from+' атакует короля на '+king.square+'. Соперник обязан устранить шах: уйти королём, закрыться или взять атакующую фигуру, если это разрешено позицией.'});}
 else for(const t of story.threats.slice(0,2))rows.push({from:m.to,to:t.square,kind:'threat',knight:actor.type==='n',text:names[actor.type][0].toUpperCase()+names[actor.type].slice(1)+' на '+m.to+' атакует '+targetNames[t.piece]+' на '+t.square+'. '+(t.undefended?'Цель не защищена другими фигурами. Если соперник оставит её под ударом, появится возможность взятия.':t.recapture?'Цель защищена: после взятия соперник может взять в ответ. Нападение не означает бесплатный выигрыш фигуры.':'Сопернику стоит учесть угрозу взятия; это не означает, что он обязан отступать. Интермеццо и другие способы защиты тоже возможны.')});
 if(rows.length===1)for(const square of ['d4','e4','d5','e5']){
 if(b.get(square)||!b.attackers(square,m.color).includes(m.to))continue;
 const parts=b.fen().split(' ');parts[1]=m.color;parts[3]='-';const probe=new Chess(parts.join(' '));probe.put({type:'n',color:m.color==='w'?'b':'w'},square);
 if(!probe.moves({verbose:true}).some(x=>x.from===m.to&&x.to===square&&x.captured))continue;
 rows.push({from:m.to,to:square,kind:'control',knight:actor.type==='n',text:'Поле '+square+' сейчас пустое. '+names[actor.type][0].toUpperCase()+names[actor.type].slice(1)+' на '+m.to+' держит его под ударом: сопернику нужно учитывать возможное взятие при размещении там фигуры. Это контроль поля, а не нападение на уже стоящую фигуру.'});if(rows.length===3)break;
 }
 const pin=tacticalConcepts(fen,uci).find(x=>x.kind==='pin');if(pin)rows.splice(1,0,{from:pin.from,to:pin.to,kind:'threat',text:pin.text});
 return rows.slice(0,4);
 }catch{return []}
}
export function arrowsSvg(rows,flipped=false){
 const colors={move:'#23876d',threat:'#c07732',control:'#427fa5'};
 return '<svg class="move-arrows" viewBox="0 0 8 8" aria-hidden="true"><defs>'+Object.entries(colors).map(([k,c])=>'<marker id="arrow-'+k+'" markerWidth="3" markerHeight="3" refX="2.3" refY="1.5" orient="auto"><path d="M0 0 3 1.5 0 3z" fill="'+c+'"/></marker>').join('')+'</defs>'+rows.map((row,i)=>{const a=squarePoint(row.from,flipped),b=squarePoint(row.to,flipped),dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),end=[b[0]-dx/length*.18,b[1]-dy/length*.18],d=row.knight?'M'+a.join(' ')+' L'+a[0]+' '+end[1]+' L'+end.join(' '):'M'+a.join(' ')+' L'+end.join(' ');return '<g data-visual-arrow="'+i+'"><path data-arrow="'+row.kind+'" d="'+d+'" fill="none" stroke="'+colors[row.kind]+'" stroke-width=".105" stroke-linecap="round" stroke-linejoin="round" opacity=".82" '+(row.kind==='control'?'stroke-dasharray=".16 .12" ':'')+'marker-end="url(#arrow-'+row.kind+')"/><circle cx="'+a[0]+'" cy="'+a[1]+'" r=".18" fill="'+colors[row.kind]+'"/><text x="'+a[0]+'" y="'+(a[1]+.065)+'" text-anchor="middle" fill="white" font-size=".2" font-family="sans-serif">'+(i+1)+'</text></g>'}).join('')+'</svg>';
}
