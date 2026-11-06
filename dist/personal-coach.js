import {gameLesson} from './learning.js';
import {matchingPractice,practiceDueAt,comparePracticeTasks} from './practice-memory.js';
export function personalCoach(games,getLesson=gameLesson,now=Date.now()){
 const groups=new Map();let duplicates=0,unavailable=0;
 for(const g of games){if(String(g?.id||'').startsWith('sample-'))continue;if(!['white','black'].includes(g?.color)||!g.moves?.length||g.positions?.length!==g.moves.length+1){unavailable++;continue}const key=g.color+'|'+g.positions[0]+'|'+g.moves.map(m=>m.uci).join(' ');if(groups.has(key)){groups.get(key).aliases.push(g);duplicates++}else groups.set(key,{game:g,aliases:[g]})}
 const topics=new Map(),pool=new Map();let gameCount=0,reviewed=0,verified=0;
 for(const group of groups.values()){
 const g=group.game;let lesson;try{lesson=getLesson(g)}catch{unavailable++;continue}if(!lesson.reviewed){unavailable++;continue}gameCount++;reviewed+=lesson.reviewed;verified+=lesson.verified||0;
 for(const t of lesson.themeCounts||[]){if(t.key==='calculation')continue;const x=topics.get(t.key)||{...t,count:0,games:0};x.count+=t.count;x.games++;topics.set(t.key,x)}
 for(const task of lesson.exercises||[]){const records=group.aliases.map(a=>matchingPractice(a,task)).filter(Boolean).sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0));const item={...task,sourceGame:g,progress:records[0]||null},key=g.positions[task.index]+'|'+task.best.uci;const old=pool.get(key);if(!old||(Number(item.progress?.updatedAt)||0)>(Number(old.progress?.updatedAt)||0)||(!old.progress&&!item.progress&&item.loss>old.loss))pool.set(key,item);}
 }
 const exercises=[...pool.values()],queue=exercises.filter(t=>practiceDueAt(t.progress)<=now).sort(comparePracticeTasks).slice(0,3),allQueue=[...exercises].sort(comparePracticeTasks).slice(0,3),repeated=[...topics.values()].filter(x=>x.games>=2).sort((a,b)=>b.games-a.games||b.count-a.count);
 return {gameCount,duplicates,unavailable,reviewed,verified,exerciseCount:exercises.length,readyCount:exercises.filter(t=>practiceDueAt(t.progress)<=now).length,solvedCount:exercises.filter(t=>t.progress?.solved).length,queue,allQueue,repeated};
}
