// Versioned, lossless local export. Import is deliberately a separate step.
export function learningBackup(games,{appVersion,now=new Date()}={}){
 const saved=games.filter(g=>typeof g.id==='string'&&!g.id.startsWith('sample-'));
 if(!saved.length)throw new Error('Пока нет своих сохранённых партий. Добавьте партию, затем создайте копию.');
 return JSON.stringify({format:'chess-atelier-learning',version:1,appVersion,createdAt:now.toISOString(),games:saved},null,2);
}
