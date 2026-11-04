import {PieceClassifier} from './board-vision.js';
let classifier;
onmessage=async e=>{try{
 if(e.data.init){const response=await fetch('./templates-browser.json');if(!response.ok)throw new Error('Не удалось загрузить шаблоны фигур.');classifier=new PieceClassifier(await response.json());postMessage({ready:true});return;}
 if(!classifier)throw new Error('Распознаватель ещё не готов.');
 postMessage(classifier.classify(e.data.pixels));
}catch(err){postMessage({error:err.message})}};
