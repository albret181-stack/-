// Local Chess.com green-theme detection. No fixed screen coordinates.
export function detectBoard({data,width,height}) {
 if(!width||!height||data.length!==width*height*4)return null;
 const rows=new Uint32Array(height),cols=new Uint32Array(width);
 const green=i=>data[i+1]-data[i]>15&&data[i+1]-data[i+2]>25&&data[i+1]>65;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(green((y*width+x)*4))rows[y]++;
 const runs=[];let start=-1,last=-1;
 for(let y=0;y<=height;y++){
  if(y<height&&rows[y]>width*.15){if(start<0)start=y;last=y;}
  else if(start>=0&&(y-last>Math.max(2,height*.008)||y===height)){runs.push([start,last+1]);start=-1;}
 }
 for(const [top,bottom] of runs.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]))){
  cols.fill(0);for(let y=top;y<bottom;y++)for(let x=0;x<width;x++)if(green((y*width+x)*4))cols[x]++;
  let left=0,right=width;while(left<width&&cols[left]<(bottom-top)*.15)left++;while(right>left&&cols[right-1]<(bottom-top)*.15)right--;
  left=Math.max(0,left-1);right=Math.min(width,right+1);
  const w=right-left,h=bottom-top;if(w<width*.4||h/w<.8||h/w>1.2)continue;
  // Check the alternating cell backgrounds away from piece centres.
  let hits=[0,0];for(let r=0;r<8;r++)for(let c=0;c<8;c++){
   const x=Math.min(width-1,Math.floor(left+(c+.15)*w/8)),y=Math.min(height-1,Math.floor(top+(r+.12)*h/8));
   const isGreen=green((y*width+x)*4);if(isGreen===!!((r+c)%2))hits[0]++;else hits[1]++;
  }
  if(Math.max(...hits)<48)continue;
  return {x:left,y:top,width:w,height:h};
 }
 return null;
}
export class PieceClassifier {
 constructor({templates,labels}) {
  this.templates=[];
  for(let t=0;t<templates.length;t++)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const a=new Float32Array(169);for(let y=0;y<13;y++)for(let x=0;x<13;x++)if(y+dy>=0&&y+dy<13&&x+dx>=0&&x+dx<13)a[y*13+x]=templates[t][(y+dy)*13+x+dx];
   this.templates.push({a,label:labels[t],norm:a.reduce((s,x)=>s+x*x,0)});
  }
 }
 classify(pixels,black=false){
  const p=new Uint8ClampedArray(pixels),features=new Float32Array(169),out=[];let total=0;
  if(p.length!==256*256*4)throw new Error('Invalid board image');
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
   features.fill(0);for(let y=0;y<26;y++)for(let x=0;x<26;x++){
    const i=((r*32+3+y)*256+c*32+3+x)*4,R=p[i],G=p[i+1],B=p[i+2];
    if(Math.max(R,G,B)-Math.min(R,G,B)<22)features[(y>>1)*13+(x>>1)]+=(.3+.7*(R+G+B)/765)/4;
   }
   let norm=0;for(const v of features)norm+=v*v;let best=Infinity,label='.';
   for(const t of this.templates){let dot=0;for(let j=0;j<169;j++)dot+=features[j]*t.a[j];const d=norm+t.norm-2*dot;if(d<best){best=d;label=t.label}}
   out.push(label);total+=Math.max(0,best)/169;
  }
  if(black)out.reverse();return {key:out.join(''),errorScore:total/64};
 }
}
