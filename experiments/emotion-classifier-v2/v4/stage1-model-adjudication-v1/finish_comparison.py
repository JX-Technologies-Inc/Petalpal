"""Seal completed blind Astra judgments, then join frozen human evidence.

Never invokes a model, assigns a final label, or edits an existing source artifact.
"""
import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent
VALUES = ['NO', 'PLAUSIBLE', 'CLEAR']

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def read_json(name):
    return json.loads((OUT / name).read_text())

def write_json(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def read_csv(name):
    with (OUT / name).open(newline='', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        return reader.fieldnames, list(reader)

def write_csv(name, fields, data):
    with (OUT / name).open('w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(data)

def main():
    assert not (OUT / 'model-human-comparison.csv').exists(), 'Refuse to overwrite comparison'
    assert not (OUT / 'astra-judgments-lock.json').exists(), 'Refuse to overwrite judgment seal'
    protocol = read_json('protocol.json')
    for name, expected in read_json('blind-input-lock.json')['sha256'].items():
        assert sha(OUT / name) == expected, f'Blind input changed: {name}'
    fields, judgments = read_csv('astra-judgments.csv')
    assert fields == ['adjudication_id','applicability','confidence','reason_code','short_rationale']
    blind_fields, blind = read_csv('model-judge-blind-input.csv')
    assert blind_fields == protocol['blind_fields']
    assert len(judgments) == len(blind)
    by_id = {r['adjudication_id']: r for r in judgments}
    assert len(by_id) == len(judgments)
    assert set(by_id) == {r['adjudication_id'] for r in blind}
    for r in judgments:
        assert r['applicability'] in VALUES
        assert r['confidence'] in protocol['confidence']
        assert r['reason_code'] in protocol['reason_codes']
        assert 0 < len(r['short_rationale']) <= protocol['short_rationale_max_chars']
        assert len(r['short_rationale'].split()) <= protocol['short_rationale_max_words']
        assert '\n' not in r['short_rationale']
    completion = read_json('astra-work/completion.json')
    assert completion['model'] == 'gpt-6-astra'
    assert completion['no_human_or_other_model_answers_read'] is True
    assert completion['final_labels_created'] is False
    # The complete immutable judgment file is sealed before human values are read here.
    sealed = datetime.now(timezone.utc).isoformat()
    write_json('astra-judgments-lock.json', {
        'sealed_utc': sealed, 'model': 'gpt-6-astra', 'judge_task': '/root/astra_blind_judge',
        'judgment_n': len(judgments), 'sha256': sha(OUT / 'astra-judgments.csv'),
        'semantic_inputs_sha256': read_json('blind-input-lock.json')['sha256'],
        'completion_attestation_sha256': sha(OUT / 'astra-work/completion.json'),
        'human_evidence_revealed_to_judge': False, 'post_blind_revision_allowed_this_task': False,
        'provenance': 'ASTRA_INDEPENDENT_BLIND_MODEL_JUDGMENT', 'final_reference_set_allowed': False})

    master_fields, master = read_csv('model-adjudication-input.csv')
    assert len(master) == len(judgments)
    compared = []
    comparisons = {name: Counter() for name in ['core1','valid_core2','normal_aux_consensus','aux_r08_sensitivity']}
    for r in master:
        a = by_id[r['adjudication_id']]
        counts = {v: int(r[f'aux_{v}_count_normal']) for v in VALUES}
        n = int(r['aux_valid_n_normal'])
        assert n == sum(counts.values())
        majority = [v for v in VALUES if counts[v] * 2 > n]
        consensus = majority[0] if majority else ''
        strong = n >= 5 and bool(consensus) and counts[consensus] / n >= .8
        output = dict(r)
        output.update(astra_applicability=a['applicability'], astra_confidence=a['confidence'],
            astra_reason_code=a['reason_code'], astra_short_rationale=a['short_rationale'],
            astra_provenance='ASTRA_INDEPENDENT_BLIND_MODEL_JUDGMENT',
            aux_normal_consensus=consensus, aux_normal_consensus_status='STRICT_MAJORITY' if consensus else 'MIXED',
            aux_normal_strong_support=str(strong).lower(),
            final_reference_set_allowed='false')
        sources = {
            'core1': r['core1_applicability'] if r['core1_status'] == 'VALID_HUMAN' else '',
            'valid_core2': r['core2_applicability'] if r['core2_status'] == 'VALID_HUMAN' else '',
            'normal_aux_consensus': consensus, 'aux_r08_sensitivity': r['aux_r08_applicability']}
        for name, value in sources.items():
            match = '' if not value else str(a['applicability'] == value).lower()
            output[f'astra_matches_{name}'] = match
            if value:
                comparisons[name]['comparable_n'] += 1
                comparisons[name]['match_n'] += int(a['applicability'] == value)
            else:
                comparisons[name]['unavailable_n'] += 1
        compared.append(output)
    write_csv('model-human-comparison.csv', list(compared[0]), compared)
    write_json('comparison-summary.json', {
        'created_utc': datetime.now(timezone.utc).isoformat(), 'astra_sealed_utc': sealed,
        'scope': 'Descriptive comparison of this selected queue only; no accuracy, final evaluation, gold, or human consensus claim',
        'comparisons': {name: dict(values) for name, values in comparisons.items()},
        'normal_auxiliary_consensus_rule': protocol['aux_consensus'],
        'normal_auxiliary_consensus_is_final_label': False,
        'aux_r08_in_normal_counts': False, 'post_blind_astra_changes': False,
        'final_reference_set_allowed': False})
    protocol.update(status='ASTRA_COMPLETE_LUNA_INPUT_READY_NO_FINAL_ADJUDICATION',
                    astra_judgments_completed=True, astra_judgments_n=len(judgments),
                    luna_blind_input_prepared=True, model_human_comparison_created=True,
                    astra_judgments_sealed_utc=sealed, human_evidence_revealed_to_astra=False)
    write_json('protocol.json', protocol)
    summary = read_json('queue-summary.json')
    summary.update(astra_judgments_completed=True, astra_judgments_n=len(judgments),
                   luna_blind_input_prepared=True, auxiliary_evidence_preserved=True,
                   final_reference_set_allowed=False)
    write_json('queue-summary.json', summary)
    readme = '''# Stage 1 model adjudication v1 — first phase

Human Stage 1 judgments are FROZEN HUMAN OBSERVATIONAL EVIDENCE. No further human
annotation, calibration, re-review, or manual adjudication is planned. The previous
targeted human re-review plan is superseded by the 2026-09-14 user instruction.
Stage 2/3 are deprecated; evidence, rank_order, tie_group are legacy unused fields.

## Completed scope

The queue was constructed from existing validated Astra audit artifacts and exact-hash
repository snapshots: 1,130 Core disagreements, four Core1 missing cells and 684
no-valid-Core2 cells, totaling 1,818 cells over 220 samples. The other 2,160 cells
are registered as CORE_HUMAN_AGREEMENT and are outside the primary model queue.
These counts validate queue construction; the old human agreement audit was not rerun.

A fresh-context gpt-6-astra judge authored one independent applicability judgment for
every queued cell. The judge was supplied only the blind semantic CSV and common
guidance, and attests that no human or other model answers were read. Completion and
input hashes are saved under astra-work/; the complete judgments were sealed before
the human comparison was generated. No answers were revised after that join.
This is workflow isolation and hash-based provenance, not a separate OS sandbox or
a claim about independence from the model's pretraining. Reasoning effort was not
overridden. Confidence is subjective model certainty, not a calibrated probability.

model-judge-blind-input.csv and luna-judge-input.csv are byte-identical. Both judges
use model-stage1-guidance-v1.md, the original unchanged definition strings, and the
same per-label semantic guidance. Model guidance is user-authorized model workflow
guidance derived from Sol's diagnosis; it is not a human-approved definition revision.
Luna has not been run. Queue membership itself is selected; no case_type, human
answer/count, priority, Astra answer, or final category appears in Luna's input.

## Frozen human evidence and comparison

Core1's four blanks remain CORE1_HUMAN_MISSING. Core2's R3-184..R3-221 remains
CORE2_INVALID_PLACEHOLDER; values are masked before use, never treated as NO,
human missing, or judgments. Comparison match fields are blank when unavailable.

Core reviewers remain anchors and Auxiliary reviewers remain supporting evidence.
auxiliary-frozen-evidence.csv preserves each queued cell's individual Auxiliary
values. Normal support counts include AUX-R01..R07 only. AUX-R06 participates
normally wherever valid, with pairwise-complete denominators and blank values
preserved. AUX-R08 is retained solely as separate sensitivity evidence.

A normal Auxiliary consensus in model-human-comparison.csv denotes only a unique
strict majority (>50%) of valid normal reviewers; ties/no strict majority are MIXED.
Strong support retains Sol's at-least-80%-of-at-least-five rule. Neither summary
creates a final label, equal-status Core vote, or automatic override.

## Provenance and boundaries

Current model outputs use ASTRA_INDEPENDENT_BLIND_MODEL_JUDGMENT. The reserved
MODEL_ADJUDICATED_CORE_DISAGREEMENT, MODEL_ADJUDICATED_CORE1_MISSING, and
MODEL_ADJUDICATED_NO_VALID_CORE2 categories are defined only for later final
adjudication; no such final assignment is made now. These outputs are not human
gold, human-adjudicated labels, or human consensus. Final reference set is NOT
ALLOWED: Luna independent judgment, model-panel comparison, Sol final adjudication,
and provenance freeze are still missing. This diagnostic is not product evaluation.

Texts are unchanged from the previously audited repository snapshots. This task
does not independently resolve the historical UI quote-rendering concern. No desktop
raw CSVs or protected row-level holdouts were reread. No training, external paid API,
dataset/label rewrite, old artifact modification, commit, or push was performed.

## Files and reproducibility

- protocol.json and queue-summary.json: policy, execution state and derived queue counts.
- model-adjudication-input.csv: non-blind master; never feed to either blind judge.
- model-judge-blind-input.csv / luna-judge-input.csv: identical semantic inputs.
- model-stage1-guidance-v1.md: shared applicability anchors and finite reason codes.
- astra-judgments.csv and astra-judgments-lock.json: completed, sealed independent vote.
- model-human-comparison.csv / comparison-summary.json: post-blind descriptive join.
- auxiliary-frozen-evidence.csv: individual supporting/sensitivity judgments.
- core-human-agreement-registry.csv: preserved nonqueued Core agreements.
- source-manifest.json / blind-input-lock.json: source and semantic input hashes.
- validation.json / progress-append-audit.json: final checks and append-only verification.
- build_queue.py: deterministic queue preparation, refusing an already-built queue.
- finish_comparison.py: seal and post-blind join, refusing an existing seal/comparison.
- verify.py: read-only verification of this workflow's outputs; no old audit rerun.

Next step: Luna independent blind judgment with luna-judge-input.csv and the shared
model-stage1-guidance-v1.md. Do not reveal astra-judgments.csv, the non-blind master,
human evidence or comparison to Luna. No automatic follow-up was started.
'''
    (OUT / 'README.md').write_text(readme)
    progress = OUT.parent.parent / 'ML_PROGRESS.md'
    before = read_json('progress-before.json')
    current = progress.read_bytes()
    assert len(current) == before['bytes'] and hashlib.sha256(current).hexdigest() == before['sha256'], 'Concurrent ML_PROGRESS edit: stop before append'
    delta = '''

## Human Review 221 — Transition to Model Adjudication

Date: 2026-09-14. Artifact: `v4/stage1-model-adjudication-v1/`.

- **No further human review = true.** Previous targeted human re-review/calibration/completion plan = **SUPERSEDED**. Human Stage 1 NO / PLAUSIBLE / CLEAR judgments are **FROZEN HUMAN OBSERVATIONAL EVIDENCE**. Stage 2/3 are **DEPRECATED**; `evidence / rank_order / tie_group` remain legacy unused fields.
- Core/Auxiliary hierarchy is unchanged: Core1/Core2 are frozen anchors; Auxiliary is frozen supporting evidence. Reviewer 1's four missing cells remain `CORE1_HUMAN_MISSING`; Reviewer 2 R3-184..R3-221 remains `CORE2_INVALID_PLACEHOLDER`, permanently excluded and never restored or imputed.
- Programmatically constructed primary queue: **1,130 CORE_DISAGREEMENT + 4 CORE1_MISSING + 684 NO_VALID_CORE2 = 1,818 cells**. The **2,160 CORE_HUMAN_AGREEMENT** cells remain outside this queue and cannot be automatically overturned. Existing audit statistics were reused, not rerun.
- **Astra independent blind judgments: COMPLETE (1,818/1,818)** in a fresh model context. Full judgment file and semantic inputs were hash-sealed before joining human evidence. **Luna blind input: READY**, byte-identical to Astra's semantic input, with the same versioned model guidance and no human/Astra answers. Luna was not run.
- Auxiliary evidence is preserved for post-blind comparison and later adjudication. AUX-R06 retains normal valid participation, pairwise-complete denominators and unchanged missing values; no downweighting. AUX-R08 is excluded from normal consensus/strong-support counts and retained separately as sensitivity evidence.
- Model outputs are one independent model vote, not human gold, human consensus, or final labels. Future `MODEL_ADJUDICATED_*` provenance categories are reserved, not assigned. **Final reference set = NOT ALLOWED YET**: Luna judgment, model-panel comparison, Sol final adjudication and provenance freeze remain outstanding. This is a supervision diagnostic, not product final evaluation; no training or protected holdout use is authorized.
- Next step: **Luna independent blind judgment**. No automatic follow-up started.
'''
    with progress.open('ab') as f:
        f.write(delta.encode())
    after = progress.read_bytes()
    assert after[:len(current)] == current
    write_json('progress-append-audit.json', {'path': str(progress), 'previous_bytes': len(current),
        'previous_sha256': before['sha256'], 'appended_bytes': len(delta.encode()),
        'after_sha256': hashlib.sha256(after).hexdigest(), 'previous_bytes_preserved': True,
        'section': 'Human Review 221 — Transition to Model Adjudication'})
    print(json.dumps({'astra_completed': len(judgments), 'comparison_rows': len(compared), 'ml_progress_appended': True, 'final_reference_set_allowed': False}))

if __name__ == '__main__':
    main()
