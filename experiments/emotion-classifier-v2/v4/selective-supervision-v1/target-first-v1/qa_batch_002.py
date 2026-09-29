#!/usr/bin/env python3
"""Target-visible semantic QA for batch 002."""
import json, os
from pathlib import Path
ROOT=Path(__file__).resolve().parent; WORK=ROOT/'work'; ATTEMPTS=WORK/'generation-attempts.jsonl'; QA=WORK/'qa-results.jsonl'; CHECKPOINT=WORK/'checkpoint.json'
REJECTS={"TFV1-TRAIN-00032":["NOT_APPLICABLE_SUPPORTED"],"TFV1-TRAIN-00036":["PLAUSIBLE_UNSUPPORTED"]}
def write(path,text):
 tmp=path.with_suffix(path.suffix+'.tmp'); tmp.write_text(text,encoding='utf-8'); os.replace(tmp,path)
def main():
 c=json.loads(CHECKPOINT.read_text()); attempts=[json.loads(x) for x in ATTEMPTS.read_text().splitlines()]; qa=[json.loads(x) for x in QA.read_text().splitlines()]
 if c['nextStage']!='SEMANTIC_QA_BATCH_002' or len(attempts)!=48 or len(qa)!=30: raise ValueError('batch 002 QA mismatch')
 for a in attempts[30:]:
  flags=REJECTS.get(a['targetId'],[]); passed=not flags
  qa.append({"recordType":"QA_RESULT","protocolVersion":"target-first-selective-data-v1","targetId":a['targetId'],"targetHash":a['targetHash'],"attemptId":a['attemptId'],"reviewedAt":"2026-09-22T11:16:00Z","qaRole":"INDEPENDENT_TARGET_VISIBLE_VERIFIER","decision":"PASS" if passed else "REJECT","flags":flags,"selectedSupported":"YES","plausibleSupportedAndSecondary":"YES" if passed else ("NO" if "PLAUSIBLE_UNSUPPORTED" in flags else "YES"),"notApplicableUnsupported":"NO" if "NOT_APPLICABLE_SUPPORTED" in flags else "YES","selectionNaturalAndNonRedundant":"YES","eventNaturalAndWithinLength":"YES","mayEditTarget":False,"mayEditEvent":False})
 write(QA,''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in qa))
 c.update({"qaPass":44,"qaReject":4,"qaFlag":0,"accepted":{"TRAIN":44,"DEV":0,"FINAL_TEST":0},"nextStage":"REGENERATE_REJECTED_BATCH_002","firstUnfinishedTargetId":"TFV1-TRAIN-00032","remainingFrozenTargetIds":["TFV1-TRAIN-00032","TFV1-TRAIN-00036"]})
 write(CHECKPOINT,json.dumps(c,indent=2)+'\n')
if __name__=='__main__': main()
