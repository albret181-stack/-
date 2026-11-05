import {Chess} from './chess.js';
import {VideoSequence,boardKey} from './video-sequence.js';

// A resume is a proposal. Neither observations nor failures mutate the draft.
export class RecognitionResume {
 constructor(data,index,time){
  if(!Number.isInteger(index)||index<1||index>data.moves.length)throw new Error('Выберите ход, после которого продолжить распознавание.');
  if(!Number.isFinite(time)||time<0||time>=data.duration-.4)throw new Error('Выберите кадр раньше конца видео, чтобы осталось время на продолжение.');
  if(!['white','black'].includes(data.orientation))throw new Error('Не определена ориентация записи. Повторите импорт видео.');
  this.source=structuredClone(data);this.index=index;this.time=time;this.anchored=false;this.matches=0;
  const board=new Chess();for(const m of data.moves.slice(0,index))board.move(m.uci);
  this.sequence=new VideoSequence(board.fen());this.sequence.lastTime=time;this.key=boardKey(board);
 }
 observe(observation){
  const key=this.source.orientation==='black'?[...observation.key].reverse().join(''):observation.key;
  if(!Number.isFinite(observation.t)||observation.t<this.time)throw new Error('Некорректное время продолжения.');
  if(!this.anchored){
   if(observation.t>this.time+1.01)throw new Error('Кадр не совпал с выбранной позицией. Переместите видео к моменту сразу после выбранного хода и повторите.');
   this.matches=key===this.key&&Number.isFinite(observation.errorScore)&&observation.errorScore<.025?this.matches+1:0;
   if(this.matches<2)return {status:'anchor-waiting'};
   this.anchored=true;return {status:'same'};
  }
  return this.sequence.observe({...observation,key});
 }
 get moves(){return this.sequence.moves;}
 get lastTime(){return this.sequence.lastTime;}
 get board(){return this.sequence.board;}
 get orientation(){return this.source.orientation;}
 finish(tail){
  if(!this.anchored)throw new Error('Не удалось подтвердить выбранную позицию на видео.');
  if(!tail.moves.length)throw new Error('Позиция подтверждена, но новых ходов не найдено. Список ходов оставлен без изменений.');
  const prefix=structuredClone(this.source.moves.slice(0,this.index)),moves=[...prefix,...structuredClone(tail.moves)];
  if(moves.length>500)throw new Error('Поддерживается до 500 полуходов.');
  const board=new Chess();for(const move of moves)board.move(move.uci);
  const prefixWarning=this.source.manuallyEdited||prefix.some(m=>m.recovered)||this.source.recognitionWarning?'Сверьте сохранённое начало партии с видео, особенно исправленные и восстановленные ходы. ':'';
  return {...this.source,...tail,moves,manuallyEdited:!!this.source.manuallyEdited,
   resumedFrom:{index:this.index,time:this.time},
   recoveredCount:moves.filter(m=>m.recovered).length,
   recognitionWarning:(prefixWarning+(tail.recognitionWarning||'')).trim()||null};
 }
}
