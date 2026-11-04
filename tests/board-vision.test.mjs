import test from 'node:test';import assert from 'node:assert/strict';
import {detectBoard,PieceClassifier} from '../dist/board-vision.js';
import {OrientedSequence} from '../dist/oriented-sequence.js';import {Chess} from '../dist/chess.js';import {boardKey} from '../dist/video-sequence.js';
function image(w,h,x,y,size){const data=new Uint8ClampedArray(w*h*4);for(let row=0;row<h;row++)for(let col=0;col<w;col++){
 let rgb=[30,30,30];if(row>=y&&row<y+size&&col>=x&&col<x+size)rgb=(Math.floor((row-y)*8/size)+Math.floor((col-x)*8/size))%2?[118,150,86]:[238,238,210];data.set([...rgb,255],(row*w+col)*4);
}return {data,width:w,height:h};}
for(const [w,h,x,y,size] of [[320,640,10,160,296],[640,1200,48,400,544]])test('detect shifted checkerboard '+w,()=>{const r=detectBoard(image(w,h,x,y,size));assert.ok(r);assert.ok(Math.abs(r.x-x)<=1);assert.equal(r.y,y);assert.ok(Math.abs(r.width-size)<=2);assert.equal(r.height,size)});
test('reject uniform green and no board',()=>{const im=image(320,640,0,0,0);assert.equal(detectBoard(im),null);for(let i=0;i<im.data.length;i+=4)im.data.set([118,150,86,255],i);assert.equal(detectBoard(im),null)});
for(const reverse of [false,true])test('orientation from legal observations '+reverse,()=>{const s=new OrientedSequence(),b=new Chess();b.move('e4');const key=reverse?[...boardKey(b)].reverse().join(''):boardKey(b);s.observe({key,errorScore:0,t:1});assert.equal(s.orientation,null);s.observe({key,errorScore:0,t:1.2});assert.equal(s.orientation,reverse?'black':'white');assert.equal(s.moves[0].uci,'e2e4')});
test('unrelated or low-confidence boards cannot select orientation',()=>{const s=new OrientedSequence(),key=boardKey(new Chess());for(let t=0;t<3;t++)s.observe({key,errorScore:1,t});assert.equal(s.orientation,null);assert.equal(s.moves.length,0)});
test('classifier tolerates a small translation without changing label',()=>{
 const template=new Array(169).fill(0);for(let y=4;y<9;y++)for(let x=5;x<8;x++)template[y*13+x]=1;
 const cl=new PieceClassifier({templates:[template,new Array(169).fill(0)],labels:['P','.']});
 for(const shift of [-2,0,2]){const p=new Uint8ClampedArray(256*256*4);for(let i=0;i<p.length;i+=4)p.set([118,150,86,255],i);
 for(let r=0;r<8;r++)for(let c=0;c<8;c++)for(let y=8;y<18;y++)for(let x=10;x<16;x++)p.set([255,255,255,255],((r*32+3+y)*256+c*32+3+x+shift)*4);
 const result=cl.classify(p.buffer);assert.equal(result.key,'P'.repeat(64));assert.ok(result.errorScore<.001);}
});
