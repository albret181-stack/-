import {planBackupMerge} from './backup-merge.mjs';

const key='atelier-games-v1';

// Preparing never writes. Commit rejects a changed snapshot before writing once.
export function prepareBackupRestore(text,storage){
 const read=()=>{
  try{return storage.getItem(key)}
  catch{throw new Error('Не удалось прочитать сохранённые партии.')}
 };
 const snapshot=read();
 let current;
 try{current=snapshot===null?[]:JSON.parse(snapshot)}
 catch{throw new Error('Сохранённые партии не удалось прочитать. Восстановление отменено.')}
 const {games,summary}=planBackupMerge(text,current);
 const encoded=summary.addedCount?JSON.stringify(games):null;
 return {
  summary:Object.freeze(summary),
  commit(){
   if(read()!==snapshot)throw new Error('Список партий изменился. Проверьте копию ещё раз.');
   if(encoded!==null){
    try{storage.setItem(key,encoded)}
    catch{throw new Error('Не удалось сохранить восстановленные партии. Проверьте доступное место в браузере.')}
   }
   return {games:JSON.parse(encoded??snapshot??'[]'),summary};
  }
 };
}
