import {inspectBackupEnvelope} from './backup-envelope.mjs';
import {validateBackupSequence} from './backup-sequence.mjs';
import {validateBackupProgress} from './backup-progress.mjs';
import {validateBackupAnalysis} from './backup-analysis.mjs';
// Read-only summary. A successful preview is not permission to write storage.
export function previewLearningBackup(text){
 const envelope=inspectBackupEnvelope(text),copy=JSON.parse(text);
 const summary={gameCount:envelope.gameCount,moveCount:0,progressCount:0,analysisCount:0,comparisonCount:0};
 for(let i=0;i<copy.games.length;i++){
  const game=copy.games[i];
  try{
   if(typeof game.title!=='string'||!['white','black'].includes(game.color))throw new Error('Некорректное название или сторона партии.');
   if(game.result!=null&&typeof game.result!=='string')throw new Error('Некорректный результат партии.');
   if(game.recognitionGaps!=null&&(!Array.isArray(game.recognitionGaps)||game.recognitionGaps.some(g=>!g||typeof g!=='object')))throw new Error('Некорректные отметки распознавания.');
   for(const key of ['lastMoveTime','lastGoodTime','firstGapTime','recoveredCount'])if(game[key]!=null&&!Number.isFinite(game[key]))throw new Error('Некорректные данные о записи.');
   const sequence=validateBackupSequence(game),progress=validateBackupProgress(game),analysis=validateBackupAnalysis(game);
   summary.moveCount+=sequence.moveCount;summary.progressCount+=progress.recordCount;
   summary.analysisCount+=analysis.rowCount;summary.comparisonCount+=analysis.comparisonCount;
  }catch(error){throw new Error('Партия '+(i+1)+': '+error.message)}
 }
 return summary;
}
