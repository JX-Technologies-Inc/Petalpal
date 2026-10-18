(function(root){
'use strict';
const labels=['Left Contact','Left Down','Right Passing','Right Contact','Right Down','Left Passing'];
function step(index,delta){return ((index+delta)%6+6)%6;}
function sample(elapsed,fps,loop=true){const absolute=Math.floor(Math.max(0,elapsed)*fps/1000);return {index:loop?absolute%6:Math.min(5,absolute),ended:!loop&&absolute>=6};}
const api={labels,step,sample};if(typeof module!=='undefined')module.exports=api;else root.FairySix=api;
})(typeof window!=='undefined'?window:globalThis);
