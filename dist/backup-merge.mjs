import {previewLearningBackup} from './backup-preview.mjs';
// Pure merge plan: preserve existing records including progress. No storage writes.
export function planBackupMerge(text,current){
 const summary=previewLearningBackup(text);
 if(!Array.isArray(current)||current.some(g=>!g||typeof g.id!=='string'))throw new Error('Не удалось проверить текущие партии.');
 const ids=new Set(current.map(g=>g.id)),incoming=JSON.parse(text).games;
 const added=incoming.filter(g=>!ids.has(g.id));
 const games=JSON.parse(JSON.stringify([...current,...added]));
 return {games,summary:{...summary,addedCount:added.length,skippedCount:incoming.length-added.length}};
}
