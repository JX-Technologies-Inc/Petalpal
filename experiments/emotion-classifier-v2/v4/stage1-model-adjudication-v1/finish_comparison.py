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
    # Allow retry after a prior interrupted post-lock comparison; source judgments
    # remain hash-checked and immutable below.
    # Post-lock comparison reuses the existing immutable seal; never recreate it.
    protocol = read_json('protocol.json')
    recovery = read_json('resume-state.json')
    transition = read_json('astra-configuration-transition.json')
    account = read_json('account-continuation-checkpoint.json')
    progress = OUT.parent.parent / 'ML_PROGRESS.md'
    before = {'bytes': recovery['progress_bytes'], 'sha256': recovery['progress_sha256']}
    current = progress.read_bytes()
    assert len(current) == before['bytes'] and hashlib.sha256(current).hexdigest() == before['sha256'], 'Concurrent ML_PROGRESS edit: stop before any finishing writes'
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
    assert completion['reasoning_effort'] == 'xhigh'
    assert completion['completed_cells'] == len(blind)
    judgment_bytes = (OUT / 'astra-judgments.csv').read_bytes()
    for state, byte_key, hash_key in [
        (recovery, 'judgment_prefix_bytes', 'judgment_prefix_sha256'),
        (transition, 'preserved_prefix_bytes', 'preserved_prefix_sha256'),
        (account, 'starting_prefix_bytes', 'starting_prefix_sha256')]:
        assert hashlib.sha256(judgment_bytes[:state[byte_key]]).hexdigest() == state[hash_key]
    assert judgment_bytes.startswith((OUT / 'astra-work/original.csv').read_bytes())
    assert sha(OUT / 'luna-judge-input.csv') == recovery['luna_input_sha256']
    assert sha(OUT / 'luna-judgments.csv') == recovery['luna_judgments_sha256']
    # The complete immutable judgment file is sealed before human values are read here.
    existing_lock = read_json('astra-judgments-lock.json')
    assert existing_lock['sha256'] == sha(OUT / 'astra-judgments.csv')
    assert existing_lock['judgment_n'] == len(judgments)
    sealed = existing_lock['sealed_utc']
    '''
    write_json('astra-judgments-lock.json', {
        'sealed_utc': sealed, 'model': 'gpt-6-astra', 'judge_run': 'Astra',
        'judge_tasks': ['/root/astra_blind_judge', '/root/astra_blind_resume', '/root/astra_xhigh_continuation'],
        'configuration_transition_sha256': sha(OUT / 'astra-configuration-transition.json'),
        'account_continuation_checkpoint_sha256': sha(OUT / 'account-continuation-checkpoint.json'),
        'model_identity_evidence': 'Runtime collaboration.spawn_agent explicitly selected gpt-6-astra, reasoning_effort xhigh; same agent resumed across account interruption',
        'current_reasoning_effort': 'xhigh', 'current_reasoning_configuration': 'Extremely High',
        'xhigh_applies_after_completed_count': transition['completed_count_at_configuration_transition'],
        'prior_reasoning_effort': 'not independently instrumented; not retroactively relabeled',
        'judgment_n': len(judgments), 'sha256': sha(OUT / 'astra-judgments.csv'),
        'semantic_inputs_sha256': read_json('blind-input-lock.json')['sha256'],
        'completion_attestation_sha256': sha(OUT / 'astra-work/completion.json'),
        'human_evidence_revealed_to_judge': False, 'post_blind_revision_allowed_this_task': False,
        'provenance': 'ASTRA_INDEPENDENT_BLIND_MODEL_JUDGMENT', 'final_reference_set_allowed': False})
    '''

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
        'normal_auxiliary_columns_scope': 'LEGACY_R01_THROUGH_R07_INCLUDING_R06_SENSITIVITY_ONLY; current primary excludes R06 and R08',
        'normal_auxiliary_consensus_is_final_label': False,
        'aux_r08_in_normal_counts': False, 'post_blind_astra_changes': False,
        'final_reference_set_allowed': False})
    # Extend the existing post-blind join for the newly authorized completed Luna panel
    # and separately identified R06/R08 sensitivity. Never regenerate either judge.
    from panel_comparison import extend_panel
    panel = extend_panel(OUT, protocol, by_id, blind, compared, recovery, transition, sealed)
    protocol.update(status='ASTRA_LUNA_COMPLETE_COMPARED_NO_FINAL_ADJUDICATION',
                    astra_judgments_completed=True, astra_judgments_n=len(judgments),
                    luna_blind_input_prepared=True, model_human_comparison_created=True,
                    astra_judgments_sealed_utc=sealed, human_evidence_revealed_to_astra=False,
                    astra_reasoning_configuration_transition=transition,
                    luna_judgments_completed=True, luna_judgments_n=panel['luna_judgments_n'],
                    luna_run_this_recovery=False, model_panel_comparison_completed=True,
                    remaining_gates=['Sol final adjudication', 'final provenance freeze'])
    protocol['previous_aux_r06_policy'] = protocol['aux_r06_policy']
    protocol['aux_r06_policy'] = {
        'current_use': 'SEPARATELY_IDENTIFIED_SENSITIVITY_ONLY',
        'source': 'latest user instruction; supersedes normal-count participation for current comparison',
        'prior_audit_status': 'INCOMPLETE_COVERAGE; no new distribution audit performed',
        'missing_preserved': True, 'automatic_core_override': False}
    protocol['legacy_normal_auxiliary_reviewers'] = protocol['normal_auxiliary_reviewers']
    protocol['normal_auxiliary_reviewers'] = ['AUX-R01','AUX-R02','AUX-R03','AUX-R04','AUX-R05','AUX-R07']
    protocol['legacy_aux_consensus'] = protocol['aux_consensus']
    protocol['aux_consensus'] = 'Unique strict majority (>50%) of valid AUX-R01..R05/R07; otherwise MIXED. Supporting evidence only. R06/R08 sensitivity separately.'
    write_json('protocol.json', protocol)
    summary = read_json('queue-summary.json')
    summary.update(astra_judgments_completed=True, astra_judgments_n=len(judgments),
                   luna_blind_input_prepared=True, auxiliary_evidence_preserved=True,
                   luna_judgments_completed=True, model_panel_comparison_completed=True,
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

Astra is one model-judge run (gpt-6-astra), continued across execution contexts and
checkpoints. The original 186 judgments were preserved. Recovery found 585 valid rows;
82 further rows reached disk before the explicit configuration correction, leaving
667 preserved rows at the transition. The remaining 1,151 cells were judged with
Extremely High (xhigh), yielding 1,818 complete rows. Prior reasoning levels are not
independently instrumented and are not retroactively called xhigh. This recovery
added 1,233 judgments in total. The latest cross-account continuation recovered 918
valid rows and added only its 900 missing IDs; the account change was operational,
with the same Astra judge and xhigh configuration. There is no extra model panelist.
The exact identifier gpt-6-astra is supported by the recorded runtime agent dispatch,
not inferred from a display name or account. See account-continuation-checkpoint.json.

The execution contexts used only blind semantic input/guidance and existing Astra
checkpoints. Inputs, original/checkpoint prefixes and final judgments are hash-locked.
Human/Luna comparison began after Astra completion and sealing; no judgment was
revised after that join. This is workflow isolation with execution attestations, not
an OS access-control sandbox or an independence claim about model pretraining.
Confidence is subjective certainty, not a calibrated probability.

model-judge-blind-input.csv and luna-judge-input.csv are byte-identical. Both judges
use model-stage1-guidance-v1.md, the original unchanged definition strings, and the
same per-label semantic guidance. Model guidance is user-authorized model workflow
guidance derived from Sol's diagnosis; it is not a human-approved definition revision.
The existing Luna artifact was already complete (1,818/1,818), was not regenerated,
and is byte-preserved. Exact Luna identity/configuration are recorded only when
supported by its existing completion metadata; otherwise they remain unverified.
Queue membership itself is selected; no case_type, human
answer/count, priority, Astra answer, or final category appears in Luna's input.

## Frozen human evidence and comparison

Core1's four blanks remain CORE1_HUMAN_MISSING. Core2's R3-184..R3-221 remains
CORE2_INVALID_PLACEHOLDER; values are masked before use, never treated as NO,
human missing, or judgments. Comparison match fields are blank when unavailable.

Core reviewers remain anchors and Auxiliary reviewers remain supporting evidence.
auxiliary-frozen-evidence.csv preserves each queued cell's individual Auxiliary
values. Current primary supporting summaries use AUX-R01..R05 and AUX-R07.
The latest user instruction designates both R06 and R08 as separate sensitivity
evidence. R06's earlier audit flag was INCOMPLETE_COVERAGE; no new distribution or
reviewer-quality audit is claimed. Missing values remain missing. The pre-existing
master's normal-count columns include R06; those unchanged columns and their legacy
comparison are explicitly marked sensitivity-only. Primary summary columns exclude
both R06 and R08. Individual pairwise reports identify every Auxiliary reviewer.

A primary Auxiliary consensus in model-human-comparison.csv denotes only a unique
strict majority (>50%) of valid primary supporting reviewers; no strict majority is MIXED.
Strong support retains Sol's at-least-80%-of-at-least-five rule. Neither summary
creates a final label, equal-status Core vote, or automatic override.

## Provenance and boundaries

Current model outputs use ASTRA_INDEPENDENT_BLIND_MODEL_JUDGMENT. The reserved
MODEL_ADJUDICATED_CORE_DISAGREEMENT, MODEL_ADJUDICATED_CORE1_MISSING, and
MODEL_ADJUDICATED_NO_VALID_CORE2 categories are defined only for later final
adjudication; no such final assignment is made now. These outputs are not human
gold, human-adjudicated labels, or human consensus. Final reference set is NOT
ALLOWED: Sol final adjudication and the final provenance freeze remain outstanding.
Both model judgments and their descriptive panel/human comparisons are complete.
This diagnostic is not product evaluation.

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
- finish_comparison.py: existing seal/join extended for the completed Luna artifact;
  refuses an existing seal/comparison and appends progress only after validation.
- panel_comparison.py: post-lock pairwise/model-panel and R06/R08 sensitivity outputs.
- astra-configuration-transition.json / astra-judgment-provenance.csv: actual configuration segments.
- model-panel-provenance.json: model identity evidence and its limits.
- model-model-*.csv: panel pairs, disagreement rows, matrix, transitions and per-label counts.
- model-human-pairwise-summary.csv / auxiliary-sensitivity-summary.csv: separate comparators.
- verify.py: verification of this workflow's outputs; no old human audit rerun.

Next step: Sol reviews the completed panel and frozen human evidence for separately
authorized final adjudication/provenance freeze. No final resolution or automatic
follow-up was started here.
'''
    (OUT / 'README.md').write_text(readme)
    from verify import validate
    validation = validate(OUT, require_progress=False)
    assert validation['validation'] == 'PASS'
    assert progress.read_bytes() == current, 'Concurrent ML_PROGRESS edit: stop before append'
    delta = '''

## Human Review 221 — Transition to Model Adjudication

Date: 2026-09-15. Artifact: `v4/stage1-model-adjudication-v1/`.

- **No further human review = true.** Previous targeted human re-review/calibration/completion plan = **SUPERSEDED**. Human Stage 1 NO / PLAUSIBLE / CLEAR judgments are **FROZEN HUMAN OBSERVATIONAL EVIDENCE**. Stage 2/3 are **DEPRECATED**; `evidence / rank_order / tie_group` remain legacy unused fields.
- Core/Auxiliary hierarchy is unchanged: Core1/Core2 are frozen anchors; Auxiliary is frozen supporting evidence. Reviewer 1's four missing cells remain `CORE1_HUMAN_MISSING`; Reviewer 2 R3-184..R3-221 remains `CORE2_INVALID_PLACEHOLDER`, permanently excluded and never restored or imputed.
- Reused the existing **1,818-cell queue** without rebuilding or repeating the old audit. The **2,160 CORE_HUMAN_AGREEMENT** cells remain outside it and cannot be automatically overridden.
- **Astra: COMPLETE, 1,818/1,818; validation PASS.** Latest cross-account recovery found **918 valid rows**, then added **900 missing IDs** only. Earlier recovery began at 585; the explicit **Extremely High / xhigh** transition occurred after **667 completed rows**, and xhigh supplied 1,151 rows across interruptions. The original **186** and all 585/667/918 checkpoint prefixes were preserved. Runtime agent dispatch exposed **gpt-6-astra** with `reasoning_effort=xhigh`; earlier reasoning levels were not independently instrumented and are not retroactively relabeled. Account change is operational only: this remains one Astra run and one panel vote. See `account-continuation-checkpoint.json`, `astra-configuration-transition.json`, and `astra-judgment-provenance.csv`.
- Blind source: unchanged `model-judge-blind-input.csv` and `model-stage1-guidance-v1.md`; Luna's semantic input remains byte-identical. Astra was fully validated and hash-locked before revealing Human/Luna answers for comparison. The existing **Luna 1,818/1,818** artifact was validated and preserved; Luna was not rerun. Model-model matrix, per-label agreement, transitions and disagreement rows are in `model-model-*.csv`; separate Core/Auxiliary comparisons are in `model-human-comparison.csv` and `model-human-pairwise-summary.csv`.
- Auxiliary evidence remains supporting evidence, with Core1/Core2 as anchors. Per the latest user instruction, **AUX-R06 and AUX-R08 are separately identified sensitivity evidence**; current primary support excludes both. R06's earlier audit flag was INCOMPLETE_COVERAGE; no new quality/distribution audit was performed. R06 missing values remain missing. The original R01..R07 master counts are preserved and marked legacy sensitivity-only; `auxiliary-sensitivity-summary.csv` reports the inclusion variants. No all-human vote or Core override was applied.
- All judge outputs remain model-generated evidence. No new human adjudication or final/reference/gold labels were created. Future `MODEL_ADJUDICATED_*` categories are reserved, not assigned. **Final reference set = NOT ALLOWED YET**: Sol final adjudication and final provenance freeze remain outstanding. This is a supervision diagnostic, not product final evaluation.
- Next step: **Sol review of the completed panel for final adjudication/provenance freeze**; no automatic follow-up or final resolution was started.
'''
    with progress.open('ab') as f:
        f.write(delta.encode())
    after = progress.read_bytes()
    assert after[:len(current)] == current
    write_json('progress-append-audit.json', {'path': str(progress), 'previous_bytes': len(current),
        'previous_sha256': before['sha256'], 'appended_bytes': len(delta.encode()),
        'after_sha256': hashlib.sha256(after).hexdigest(), 'previous_bytes_preserved': True,
        'section': 'Human Review 221 — Transition to Model Adjudication'})
    write_json('validation.json', validate(OUT, require_progress=True))
    print(json.dumps({'astra_completed': len(judgments), 'comparison_rows': len(compared), 'ml_progress_appended': True, 'final_reference_set_allowed': False}))

if __name__ == '__main__':
    main()
