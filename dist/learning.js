import {practiceQueue} from './practice-memory.js';
import {Chess} from './chess.js';
import {reviewMove} from './move-review.js';
import {tacticalConcepts} from './tactical-concepts.js';
const themes={king:{title:'Безопасность короля',tip:'Перед своим планом проверьте шахи соперника: нет ли мата в один ход и чем можно закрыть угрозу.'},mate:{title:'Не упускать мат',tip:'Начните поиск с шахов. После каждого шаха проверьте все законные ответы, прежде чем считать его матом.'},material:{title:'Защита фигур',tip:'Перед ходом посмотрите, что соперник сможет взять. После предполагаемого взятия проверьте, можете ли вы взять в ответ.'},exchange:{title:'Расчёт разменов',tip:'Не останавливайтесь на первом взятии: мысленно выполните ответное взятие и сравните, какие фигуры останутся.'},pin:{title:'Связки',tip:'Проверьте линии к королям. Фигура между дальнобойной фигурой соперника и королём может быть ограничена в движении.'},fork:{title:'Двойные нападения',tip:'Перед ходом ищите фигуру, которая сможет одновременно атаковать две важные цели. Проверьте, не сможет ли соперник ответить шахом или взятием.'},activity:{title:'Активность фигур',tip:'Если прямых угроз нет, ищите ход, который подключает фигуру к борьбе: выводит с начального ряда, открывает ей линию или помогает занять центр.'},calculation:{title:'Точнее сравнивать варианты',tip:'Сначала проверьте шахи, взятия и угрозы обеих сторон. Затем сравните, что меняется после вашего хода и предложенного варианта.'}};
function themeOf(g,i,r){
 if(/соперник может поставить мат|мат вашему королю/.test(r.reason))return 'king';
 if(/упускает.*мат/.test(r.reason))return 'mate';
 try{const b=new Chess(g.positions[i+1]),reply=b.move(g.evals[i+1]?.[0]?.line?.[0]?.uci);if(reply?.captured){const canRetake=b.moves({verbose:true}).some(m=>m.to===reply.to&&m.captured);return canRetake?'exchange':'material'}}catch{}
 if(r.best){const played=new Set(tacticalConcepts(g.positions[i],g.moves[i].uci).map(x=>x.key));const t=tacticalConcepts(g.positions[i],r.best.uci).find(x=>!played.has(x.key));if(t)return t.kind;}
 if(/центр|централь|диагональ|Рокировка|выводите|вертикаль/.test(r.better||''))return 'activity';return 'calculation';
}
export function gameLesson(game,reviewAt=i=>reviewMove(game,i)){
 const own=game.color==='black'?1:0,errors=[],counts={};let reviewed=0,verified=0;
 for(let i=own;i<game.moves.length;i+=2){const r=reviewAt(i);if(!Number.isFinite(r.loss))continue;reviewed++;if(r.comparisonVerified)verified++;if(r.loss<60)continue;const theme=themeOf(game,i,r);counts[theme]=(counts[theme]||0)+1;let valid=false;try{if(r.best?.uci&&r.best.uci!==game.moves[i].uci){new Chess(game.positions[i]).move(r.best.uci);valid=true}}catch{}
 errors.push({index:i,loss:r.loss,theme,title:themes[theme].title,tip:themes[theme].tip,reason:r.reason,best:r.best,trainable:valid});}
 errors.sort((a,b)=>b.loss-a.loss||a.index-b.index);
 const repeated=Object.entries(counts).filter(([key,n])=>key!=='calculation'&&n>=2).sort((a,b)=>b[1]-a[1]);const focus=repeated[0]?.[0]||errors[0]?.theme||'calculation';
 return {themeCounts:Object.entries(counts).map(([key,count])=>({key,count,title:themes[key].title,tip:themes[key].tip})),reviewed,verified,totalErrors:errors.length,highlights:errors.slice(0,3),exercises:errors.filter(x=>x.trainable),queue:practiceQueue(game,errors.filter(x=>x.trainable)),repeated:repeated.map(([key,count])=>({key,count,title:themes[key].title})),tip:themes[focus].tip};
}
export function practiceOutcome(pair,color){const sign=color==='black'?-1:1;if(!Number.isFinite(pair?.best?.cp)||!Number.isFinite(pair?.played?.cp))return {accepted:false,unknown:true,text:'Недостаточно данных для проверки. Попробуйте ещё раз.'};const gap=Math.max(0,(pair.best.cp-pair.played.cp)*sign);const bothMate=pair.best.mate*sign>0&&pair.played.mate*sign>0;return {accepted:bothMate||gap<=35,gap,text:bothMate?'Оба варианта сохраняют найденный движком мат.':gap<=35?'Хорошая альтернатива: в одинаковых условиях расчёта она близка к варианту разбора. Это ограниченный расчёт, а не доказательство абсолютной точности.':'В текущем сравнении вариант разбора сильнее. Проверьте, какие шахи, взятия или угрозы ваш ход оставляет сопернику.'};}
