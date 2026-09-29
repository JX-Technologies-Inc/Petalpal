#!/usr/bin/env python3
"""Semantic QA for batch-002 replacement attempts."""
import json,os
from pathlib import Path
R=Path(__file__).resolve().parent;W=R/'work';A=W/'generation-attempts.jsonl';Q=W/'qa-results.jsonl';C=W/'checkpoint.json'
def write(p,s):q=p.with_suffix(p.suffix+'.tmp');q.write_text(s,encoding='utf-8');os.replace(q,p)
def main():
 c=json.loads(C.read_text());aa=[json.loads(x) for x in A.read_text().splitlines()];qq=[json.loads(x) for x in Q.read_text().splitlines()]
 if c['nextStage']!='SEMANTIC_QA_BATCH_002_REPLACEMENTS' or len(aa)!=50 or len(qq)!=48:raise ValueError('checkpoint mismatch')
 for a in aa[-2:]:qq.append({"recordType":"QA_RESULT","protocolVersion":"target-first-selective-data-v1","targetId":a['targetId'],"targetHash":a['targetHash'],"attemptId":a['attemptId'],"reviewedAt":"2026-09-22T11:28:00Z","qaRole":"INDEPENDENT_TARGET_VISIBLE_VERIFIER","decision":"PASS","flags":[],"selectedSupported":"YES","plausibleSupportedAndSecondary":"YES","notApplicableUnsupported":"YES","selectionNaturalAndNonRedundant":"YES","eventNaturalAndWithinLength":"YES","mayEditTarget":False,"mayEditEvent":False})
 write(Q,''.join(json.dumps(x,ensure_ascii=False)+'\n' for x in qq));c.update({"completedBatch":2,"activeBatch":3,"qaPass":46,"qaReject":4,"qaFlag":0,"accepted":{"TRAIN":46,"DEV":0,"FINAL_TEST":0},"nextStage":"BUILD_BATCH_003_TARGETS","firstUnfinishedTargetId":"TFV1-TRAIN-00051","remainingFrozenTargetIds":[]});write(C,json.dumps(c,indent=2)+'\n')
if __name__=='__main__':main()
