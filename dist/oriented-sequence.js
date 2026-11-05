import {VideoSequence} from './video-sequence.js';
// Orientation is inferred only from a legal observed move, never from player colour.
export class OrientedSequence {
 constructor(){this.candidates=[new VideoSequence(),new VideoSequence()];this.selected=null;this.orientation=null;}
 observe(observation){
  if(this.selected)return this.selected.observe({...observation,key:this.orientation==='black'?[...observation.key].reverse().join(''):observation.key});
  const results=this.candidates.map((s,i)=>s.observe({...observation,key:i?[...observation.key].reverse().join(''):observation.key}));
  const accepted=this.candidates.map((s,i)=>s.moves.length?i:-1).filter(i=>i>=0);
  if(accepted.length===1){const i=accepted[0];this.selected=this.candidates[i];this.orientation=i?'black':'white';return results[i];}
  return {status:results.some(r=>r.status==='unmatched')?'unmatched':'uncertain'};
 }
 get moves(){return this.selected?.moves||[];}
 get lastTime(){return this.selected?.lastTime||0;}
 get board(){return this.selected?.board;}
}
