// Synthetic offline compatibility fixtures only; no database or inference.
import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { REFLECTION_OUTPUT_LOCALES, weeklyReportLocale } from '../../lib/report-locale.js';
import { REFLECTION_V2_SCHEMAS, REFLECTION_V2, buildReflectionV2, validateReflectionV2 } from '../../lib/reflection-v2.js';
import { WEEKLY_REFLECTION_SCHEMA } from '../../lib/sonnet-weekly.js';
import { MONTHLY_REFLECTION_SCHEMA } from '../../lib/opus-monthly.js';
import { PrivateReportRepository, GroundedReportPersistenceService } from '../../lib/report-foundation.js';
import { reflectionV2ValidationCode } from '../../scripts/reflection-v2-validation-diagnostics.mjs';

const RETIRED = ['zh-Hant', 'zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant-TW', 'zh-Hans-TW'];
test('new Reflection languages are English and Simplified Chinese; retired preferences fail without conversion', () => {
  assert.deepEqual(REFLECTION_OUTPUT_LOCALES, ['en', 'zh-Hans']);
  for (const locale of ['en', 'en-CA', 'EN-us']) assert.equal(weeklyReportLocale(locale), 'en');
  for (const locale of ['zh', 'zh-Hans', 'zh-CN', 'zh-SG', 'zh-Hans-CN']) assert.equal(weeklyReportLocale(locale), 'zh-Hans');
  for (const locale of [...RETIRED, 'ja', '', null]) assert.throws(() => weeklyReportLocale(locale), { code:'REPORT_NARRATIVE_INVALID_INPUT' });
  for (const schema of [WEEKLY_REFLECTION_SCHEMA, MONTHLY_REFLECTION_SCHEMA, ...Object.values(REFLECTION_V2_SCHEMAS)]) {
    assert.deepEqual(schema.properties.locale.enum, ['en', 'zh-Hans']);
    assert.equal(schema.additionalProperties, false);
  }
});

test('Weekly and Monthly reject retired new packet/output locales while preserving Traditional source evidence', () => {
  for (const type of ['WEEKLY','MONTHLY']) {
    const items = ['我沒有覺得事情變好了。', 'I enjoyed reading.', '我还没决定。'].map((text, i) => ({
      text, topics:[], eventDate:new Date(`2026-09-${14+i}T12:00:00Z`), week:type==='MONTHLY'?`W${i+1}`:null,
      previous:false, source:{sourceEventId:`event-${i}`,sourceMemoryId:`memory-${i}`}
    }));
    for (const locale of RETIRED) assert.throws(() => buildReflectionV2({type,locale,timezone:'UTC',items}), {code:'REPORT_NARRATIVE_INVALID_INPUT'});
    const built=buildReflectionV2({type,locale:'zh-Hans',timezone:'UTC',items});
    assert.equal(built.packet.evidence[0].text, items[0].text);
    const output={version:REFLECTION_V2[type],locale:'zh-Hant',paragraphs:[{sentences:[{text:'合成的回顾。',refs:['E1','E2','E3']}]}]};
    const context={type,locale:'zh-Hans',built,model:'synthetic-model'};
    assert.throws(()=>validateReflectionV2(output,context),{code:'REPORT_NARRATIVE_GROUNDING_FAILED'});
    assert.equal(reflectionV2ValidationCode(output,context),'REFLECTION_V2_LOCALE_UNSUPPORTED');
  }
});

test('historical Traditional v1/v2 Weekly and Monthly reports remain readable and finalized without locale conversion', async () => {
  for (const type of ['WEEKLY','MONTHLY']) for (const version of ['v1','v2']) {
    const saved={id:'historical-report',ownerId:'alice',periodKey:'2026-09',narrativeStatus:'GENERATED',
      summary:'你沒有說過自己不再畫畫。',narrativeSections:[{locale:'zh-Hant',contractVersion:`${type.toLowerCase()}-reflection-${version}`,
        claim:'你沒有說過自己不再畫畫。'}],evidence:[{sourceEventId:'historical-event'}]};
    const snapshot=structuredClone(saved); let consent=true, reads=0;
    const model={findFirst:async ({where})=>{ reads++; assert.equal(where.locale,undefined); return where.ownerId===saved.ownerId?saved:null; }};
    const db={weeklyReport:model,monthlyReport:model,
      $transaction:async fn=>fn(db),
      $queryRawUnsafe:async (_sql,ownerId)=>[{userId:ownerId,aiProcessing:consent,personalization:consent,memoryEnabled:consent}],
      user:{findUnique:()=>assert.fail('historical reads must not normalize current preferences')}
    };
    const reader=new PrivateReportRepository(db), method=type==='WEEKLY'?'getWeeklyReportById':'getMonthlyReportById';
    assert.deepEqual(await reader[method]({identity:{userId:'alice'},reportId:saved.id}),snapshot);
    assert.equal(await reader[method]({identity:{userId:'bob'},reportId:saved.id}),null);
    assert.deepEqual(await new GroundedReportPersistenceService(db).findFinalized({identity:{userId:'alice'},reportType:type,periodKey:saved.periodKey}),snapshot);
    consent=false; const before=reads;
    await assert.rejects(reader[method]({identity:{userId:'alice'},reportId:saved.id}),{code:'AI_FORBIDDEN'});
    assert.equal(reads,before); assert.deepEqual(saved,snapshot);
  }
});

test('Monthly implementation differs from the parent only in its generation locale allowlist', () => {
  const root=new URL('../../',import.meta.url);
  const original=execFileSync('git',['show','c2c4f6e72f3a4dc75dd6e37c3c371e0c2fda97b8:lib/opus-monthly.js'],{cwd:root,encoding:'utf8'});
  const expected=original.replace('import { MONTHLY_EVIDENCE_POLICY, monthlyWeek } from "./monthly-evidence.js";',
    'import { MONTHLY_EVIDENCE_POLICY, monthlyWeek } from "./monthly-evidence.js";\nimport { REFLECTION_OUTPUT_LOCALES } from "./report-locale.js";')
    .replace('const locales = ["en", "zh-Hans", "zh-Hant"];','const locales = REFLECTION_OUTPUT_LOCALES;');
  assert.equal(readFileSync(new URL('lib/opus-monthly.js',root),'utf8'),expected);
});
