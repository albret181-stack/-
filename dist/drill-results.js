const statuses=new Set(['independent','assisted','revealed']);
const key=id=>'atelier-drill-result-v1:'+id;

export function readDrillResult(storage,id){
 const raw=storage.getItem(key(id));
 if(raw===null)return null;
 const result=JSON.parse(raw);
 if(!statuses.has(result?.first)||!statuses.has(result?.latest)){
  throw new Error('Сохранённый результат задачи повреждён.');
 }
 return result;
}

export function saveDrillResult(storage,id,status){
 if(!statuses.has(status))throw new Error('Неизвестный результат задачи.');
 const previous=readDrillResult(storage,id);
 const result={first:previous?.first??status,latest:status};
 storage.setItem(key(id),JSON.stringify(result));
 return result;
}
