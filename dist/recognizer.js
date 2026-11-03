let templates,labels,norms;
onmessage=async e=>{try{if(e.data.init){const j=await fetch('./templates-browser.json').then(r=>r.json());templates=j.templates.map(a=>Float32Array.from(a));labels=j.labels;norms=templates.map(a=>a.reduce((s,x)=>s+x*x,0));postMessage({ready:true});return}
 const p=new Uint8ClampedArray(e.data.pixels),features=new Float32Array(169),out=[];let total=0;
 for(let r=0;r<8;r++)for(let c=0;c<8;c++){
  features.fill(0);for(let y=0;y<26;y++)for(let x=0;x<26;x++){
   const i=((r*32+3+y)*256+c*32+3+x)*4,R=p[i],G=p[i+1],B=p[i+2];if(Math.max(R,G,B)-Math.min(R,G,B)<22)features[Math.floor(y/2)*13+Math.floor(x/2)]+=(.3+.7*(R+G+B)/765)/4;
  }
  let n=0;for(let j=0;j<169;j++)n+=features[j]*features[j];let best=Infinity,label='.';
  for(let t=0;t<templates.length;t++){let dot=0;const a=templates[t];for(let j=0;j<169;j++)dot+=features[j]*a[j];const d=n+norms[t]-2*dot;if(d<best){best=d;label=labels[t]}}
  out.push(label);total+=best/169;
 }
 if(e.data.black)out.reverse();postMessage({key:out.join(''),errorScore:total/64})
 }catch(err){postMessage({error:err.message})}};
