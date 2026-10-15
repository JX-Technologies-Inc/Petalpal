import assert from 'node:assert/strict';
import test from 'node:test';
import {loadPlantingModules} from './loadPlantingModules.mjs';
const {immediateSupportHint,GENERAL_SUPPORT}=loadPlantingModules()('../../../services/emotionalSafety');
test('immediate-danger hints are supportive, local and do not block saving or claim emergency monitoring',()=>{
 for(const text of ['I am going to hurt myself tonight','I cannot keep myself safe','我今晚要自杀','我刚服药过量'])assert.ok(immediateSupportHint(text));
 assert.match(immediateSupportHint('I will kill myself now'),/still save/);
 assert.match(GENERAL_SUPPORT,/local emergency/);
});
test('ordinary distress, trauma disclosure, past/negated risk and figurative language remain ordinary writing',()=>{
 for(const text of ['I feel sad and anxious','I need help after abuse','I am not going to kill myself tonight','I used to hurt myself','I will kill time now','我很难过，想找人说话','我不想伤害自己','I am worried about a friend'])assert.equal(immediateSupportHint(text),null,text);
});
