// Envelope inspection only: never writes storage or approves game payloads for import.
export function inspectBackupEnvelope(text) {
 let copy;
 try { copy=JSON.parse(text); } catch { throw new Error('Файл копии содержит повреждённый JSON.'); }
 if(!copy || Array.isArray(copy) || copy.format!=='chess-atelier-learning') throw new Error('Это не копия обучения Шахматного ателье.');
 if(copy.version!==1) throw new Error('Версия копии не поддерживается.');
 if(!Array.isArray(copy.games) || !copy.games.length) throw new Error('В копии нет списка партий.');
 const ids=new Set();
 for(const game of copy.games){
  if(!game || Array.isArray(game) || typeof game.id!=='string' || !game.id.trim() || game.id.startsWith('sample-')) throw new Error('Некорректная запись партии.');
  if(ids.has(game.id)) throw new Error('В копии повторяются идентификаторы партий.');
  ids.add(game.id);
 }
 return {gameCount:copy.games.length,version:copy.version};
}
