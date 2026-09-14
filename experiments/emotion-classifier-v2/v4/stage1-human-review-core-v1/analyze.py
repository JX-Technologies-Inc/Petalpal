"""Reproducible Stage 1-only human review audit. No rating edits or adjudication."""
from __future__ import annotations

import csv
import hashlib
import io
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parent
DESKTOP = Path('/Users/xingranma/Desktop')
BUNDLE = DESKTOP / 'auxiliary_reviewers_stage1_final_bundle'
PROGRESS = OUT.parent.parent / 'ML_PROGRESS.md'
VALUES = ['NO', 'PLAUSIBLE', 'CLEAR']
LABELS = ['admiration', 'amusement', 'anger', 'annoyance', 'caring', 'confusion',
          'curiosity', 'disappointment', 'disgust', 'excitement', 'fear', 'gratitude',
          'joy', 'love', 'optimism', 'remorse', 'sadness', 'surprise']
COLUMNS = ['sample_id', 'text', 'label', 'label_definition', 'applicability',
           'evidence', 'rank_order', 'tie_group']
SAMPLES = [f'R3-{n:03d}' for n in range(1, 222)]
R2_VALID = frozenset(SAMPLES[:183])
KEYS = frozenset((s, l) for s in SAMPLES for l in LABELS)
EXPECTED_R1_MISSING = {('R3-087', 'fear'), ('R3-163', 'surprise'),
                       ('R3-168', 'admiration'), ('R3-168', 'amusement')}
AUX_IDS = [f'AUX-R{n:02d}' for n in range(1, 9)]


def digest(blob):
    return hashlib.sha256(blob).hexdigest()


def write_json(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False,
                                      allow_nan=False) + '\n', encoding='utf-8')


def write_csv(name, rows, columns=None):
    if columns is None:
        columns = list(rows[0])
    with (OUT / name).open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=columns)
        w.writeheader()
        w.writerows(rows)


def read_input(path, destination, audit):
    blob = path.read_bytes()
    target = OUT / 'input' / destination
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and target.read_bytes() != blob:
        raise ValueError(f'Input changed from existing snapshot: {path}')
    if not target.exists():
        target.write_bytes(blob)
    audit.append({'original_path': str(path), 'snapshot_path': str(target),
                  'sha256': digest(blob), 'size_bytes': len(blob)})
    return blob


def load_reviewer(reviewer_id, blob):
    reader = csv.DictReader(io.StringIO(blob.decode('utf-8-sig'), newline=''))
    errors, rows, ratings, metadata = [], [], {}, {}
    if reader.fieldnames != COLUMNS:
        errors.append('Schema/order differs from required eight-column schema')
    if not reader.fieldnames or not set(COLUMNS).issubset(reader.fieldnames):
        return None, None, {'reviewer_id': reviewer_id, 'errors': errors}
    for r in reader:
        if None in r or any(r.get(c) is None for c in COLUMNS):
            errors.append(f'Malformed CSV record at line {reader.line_num}')
            continue
        # Never copy, validate, inspect or infer values of legacy fields.
        s, l = r['sample_id'], r['label']
        k = (s, l)
        valid = reviewer_id != 'reviewer-2' or s in R2_VALID
        # Permanently mask R2 placeholders before any judgment validation/QC.
        value = r['applicability'] if valid else None
        rows.append((k, r['text'], r['label_definition'], value, valid))
    counts = Counter(k for k, *_ in rows)
    duplicate_keys = [list(k) for k, n in counts.items() if n > 1]
    unknown = sorted(set(counts) - KEYS)
    absent = sorted(KEYS - set(counts))
    if duplicate_keys:
        errors.append('Duplicate sample_id/label keys')
    if unknown:
        errors.append('Unexpected sample IDs or labels')
    within_text, within_def = defaultdict(set), defaultdict(set)
    illegal, missing, excluded, valid_slots = [], [], 0, 0
    for k, txt, definition, value, valid in rows:
        s, l = k
        within_text[s].add(txt)
        within_def[l].add(definition)
        metadata[k] = {'text': txt, 'label_definition': definition}
        if not valid:
            excluded += 1
            continue
        valid_slots += 1
        if value not in VALUES + ['']:
            illegal.append({'sample_id': s, 'label': l, 'value': value})
        elif value == '':
            missing.append(k)
        else:
            ratings[k] = value
    text_inconsistent = sorted(s for s, vals in within_text.items() if len(vals) != 1)
    def_inconsistent = sorted(l for l, vals in within_def.items() if len(vals) != 1)
    if illegal:
        errors.append('Illegal applicability values in valid range')
    if text_inconsistent or def_inconsistent:
        errors.append('Within-file text or label-definition inconsistency')
    if any(not t for ts in within_text.values() for t in ts):
        errors.append('Empty sample text')
    if any(not t for ds in within_def.values() for t in ds):
        errors.append('Empty label definition')
    is_core = reviewer_id.startswith('reviewer-')
    if is_core and (len(rows) != 3978 or absent):
        errors.append('Core grid must contain exactly 221 x 18 keys')
    if reviewer_id == 'reviewer-1' and set(missing) != EXPECTED_R1_MISSING:
        errors.append('Reviewer 1 missing keys differ from supplied four-key boundary')
    if reviewer_id == 'reviewer-2' and (valid_slots != 3294 or excluded != 684):
        errors.append('Reviewer 2 validity mask counts inconsistent with required grid')
    seq = [k[0] for k, *_ in rows]
    label_orders = {s: [k[1] for k, *_ in rows if k[0] == s] for s in set(seq)}
    distribution = Counter(ratings.values())
    report = {
        'reviewer_id': reviewer_id, 'role': 'CORE' if is_core else 'AUXILIARY',
        'columns': reader.fieldnames, 'schema_exact': reader.fieldnames == COLUMNS,
        'total_rows': len(rows), 'unique_sample_n': len(set(seq)),
        'expected_sample_n': 221, 'expected_label_n': 18,
        'labels': sorted(within_def), 'duplicate_keys': duplicate_keys,
        'unexpected_keys': [list(k) for k in unknown],
        'missing_grid_keys': [list(k) for k in absent],
        'missing_samples': sorted(set(SAMPLES) - set(seq)),
        'sample_row_counts': dict(sorted(Counter(seq).items())),
        'sample_order_ascending': seq == sorted(seq),
        'sample_blocks_contiguous': len([s for i, s in enumerate(seq)
                                         if i == 0 or s != seq[i-1]]) == len(set(seq)),
        'uniform_label_order': len({tuple(ls) for ls in label_orders.values()}) == 1,
        'valid_potential_rows_present': valid_slots,
        'invalid_rows_excluded_before_judgment_qc': excluded,
        'valid_nonblank_judgment_n': len(ratings),
        'missing_applicability_n': len(missing),
        'missing_applicability_keys': [list(k) for k in sorted(missing)],
        'illegal_values': illegal,
        'distribution_valid_nonblank_only': {v: distribution[v] for v in VALUES},
        'within_sample_text_mismatches': text_inconsistent,
        'within_label_definition_mismatches': def_inconsistent,
        'legacy_field_values_used': False,
        'errors': errors,
    }
    return ratings, metadata, report


def comparison(left, right, keys=None):
    overlap = sorted(left.keys() & right.keys() if keys is None
                     else set(keys) & left.keys() & right.keys())
    m = [[0 for _ in VALUES] for _ in VALUES]
    for k in overlap:
        m[VALUES.index(left[k])][VALUES.index(right[k])] += 1
    n = len(overlap)
    eq = sum(m[i][i] for i in range(3))
    severe = m[0][2] + m[2][0]
    no_plausible = m[0][1] + m[1][0]
    plausible_clear = m[1][2] + m[2][1]
    margins_a = [sum(row) for row in m]
    margins_b = [sum(m[i][j] for i in range(3)) for j in range(3)]
    dot = sum(a*b for a, b in zip(margins_a, margins_b))
    den = n*n - dot
    kappa = (eq*n - dot) / den if n and den else None
    return {
        'valid_overlap_n': n, 'exact_agreement_n': eq,
        'exact_agreement_rate': eq/n if n else None,
        'disagreement_n': n-eq, 'disagreement_rate': (n-eq)/n if n else None,
        'severe_disagreement_n': severe, 'severe_disagreement_rate': severe/n if n else None,
        'adjacent_disagreement_n': no_plausible+plausible_clear,
        'NO_vs_PLAUSIBLE_n': no_plausible, 'PLAUSIBLE_vs_CLEAR_n': plausible_clear,
        'NO_vs_CLEAR_n': severe, 'cohens_kappa': kappa,
        'kappa_status': 'DEFINED' if kappa is not None else 'UNDEFINED_NO_OVERLAP_OR_EXPECTED_AGREEMENT_ONE',
        'expected_agreement_rate': dot/(n*n) if n else None,
        'left_marginal_counts': dict(zip(VALUES, margins_a)),
        'right_marginal_counts': dict(zip(VALUES, margins_b)),
        'confusion_matrix': m,
    }


def qc_report(rid, ratings, audit):
    c = Counter(ratings.values())
    valid = len(ratings)
    missing = len(KEYS) - valid
    flags = []
    if missing:
        flags.append('INCOMPLETE_COVERAGE')
    # Descriptive screen specified before calculating auxiliary distributions.
    if valid and (c['NO']/valid < .01 or max(c.values())/valid >= .99):
        flags.append('EXTREME_DISTRIBUTION')
    if audit['errors']:
        flags.append('STRUCTURAL_ERROR')
    return {'reviewer_id': rid, 'role': 'AUXILIARY', 'total_expected_n': len(KEYS),
            'total_rows': audit['total_rows'], 'valid_judgment_n': valid,
            'missing_n': missing, 'blank_applicability_n': audit['missing_applicability_n'],
            'missing_key_n': len(audit['missing_grid_keys']),
            'coverage_rate': valid/len(KEYS),
            **{f'{v}_n': c[v] for v in VALUES},
            **{f'{v}_rate': c[v]/valid if valid else None for v in VALUES},
            'illegal_value_n': len(audit['illegal_values']),
            'duplicated_key_n': len(audit['duplicate_keys']),
            'missing_sample_n': len(audit['missing_samples']),
            'qc_flag': '|'.join(flags) if flags else 'NONE',
            'included_in_descriptive_comparisons': True,
            'reviewer_weight_assigned': False}


def main():
    state_path = OUT / 'execution-state.json'
    if state_path.exists() and json.loads(state_path.read_text())['status'] == 'COMPLETE':
        raise RuntimeError('Completed artifact exists; refusing to overwrite')
    old_protocol = OUT / 'protocol.json'
    if old_protocol.exists() and json.loads(old_protocol.read_text()).get('execution_status') == 'BLOCKED_INPUT_ACCESS':
        history = OUT / 'access-history' / 'initial-blocked-attempt'
        history.mkdir(parents=True, exist_ok=True)
        for name in ['protocol.json', 'input-audit.json', 'core-data-audit.json', 'README.md']:
            src = OUT / name
            if src.exists() and not (history / name).exists():
                src.rename(history / name)
    protocol = {
        'protocol_id': 'stage1-human-review-core-v1', 'human_review_protocol': 'STAGE1_ONLY',
        'stage1_values': VALUES, 'stage2_status': 'DEPRECATED', 'stage3_status': 'DEPRECATED',
        'legacy_unused_fields': ['evidence', 'rank_order', 'tie_group'],
        'core_reviewers': ['reviewer-1', 'reviewer-2'], 'auxiliary_reviewers': AUX_IDS,
        'reviewer2_valid_range': 'R3-001..R3-183', 'reviewer2_invalid_range': 'R3-184..R3-221',
        'reviewer2_invalid_reason': 'export placeholders; not genuine human judgments',
        'reviewer2_validity_rule': 'Reviewer 2 valid iff sample_id is one of the 183 exact IDs R3-001 through R3-183; apply before judging any applicability value, regardless of blankness.',
        'reviewer2_invalid_potential_judgments': 684,
        'core_overlap_rule': 'Intersection of valid keys with nonblank applicability from both Core reviewers; calculate N from CSV then assert expected 3290.',
        'expected_core_overlap_for_validation_only': 3290,
        'labels': LABELS, 'expected_samples': SAMPLES,
        'expected_reviewer1_missing_keys': [list(k) for k in sorted(EXPECTED_R1_MISSING)],
        'kappa': {'type': 'unweighted Cohen kappa', 'categories': VALUES,
                  'formula': '(observed_agreement - expected_marginal_agreement) / (1 - expected_marginal_agreement)',
                  'undefined_handling': 'JSON null / blank CSV plus explicit status when N=0 or expected agreement=1'},
        'primary_analysis': 'Three categories; PLAUSIBLE is never binarized',
        'severe': ['NO/CLEAR', 'CLEAR/NO'],
        'adjacent': ['NO/PLAUSIBLE', 'PLAUSIBLE/NO', 'PLAUSIBLE/CLEAR', 'CLEAR/PLAUSIBLE'],
        'auxiliary_qc_screen': {'INCOMPLETE_COVERAGE': 'valid nonblank judgments < 3978',
                                'EXTREME_DISTRIBUTION': 'NO rate < 0.01 OR largest category rate >= 0.99 among valid nonblank judgments',
                                'interpretation': 'Descriptive warning only, not a validated reviewer-quality test or exclusion rule; applied to every Auxiliary reviewer'},
        'auxiliary_distribution_denominator': 'valid nonblank judgments; coverage denominator is 3978',
        'auxiliary_support': 'Counts separately by NO/PLAUSIBLE/CLEAR over actual nonblank Auxiliary overlap; all eight retained, flags reported, no winner or consensus',
        'pairwise_scope': 'Aux-vs-R1 uses all valid R1 rows; Aux-vs-R2 always uses R3-001..183. Different comparison denominators are not reviewer rankings.',
        'bootstrap_performed': False, 'reason_no_bootstrap': 'Descriptive Stage 1 task requests point estimates only; no inferred sourceGroup mapping or independent-label assumption.',
        'input_bundle_type': 'directory explicitly supplied by user instead of originally specified ZIP',
        'input_policy': 'Only specified desktop Core clean CSVs and eight aux-rXX.csv files; copy bytes unchanged into input snapshots; README/manifest are metadata only.',
        'bundle_instructions_superseded': ['README/manifest AUX-R08 default exclusion', 'README future Stage 2/3 completion'],
        'gold_labels_created': False, 'majority_vote_used': False, 'adjudication_performed': False,
        'automatic_core_override': False, 'reviewer_weighting_used': False,
        'ratings_imputed': False, 'reviewers_automatically_removed': False,
        'training_performed': False, 'protected_data_accessed': False,
        'original_files_modified': False,
    }
    write_json('protocol.json', protocol)
    input_entries, data, metadata, audits = [], {}, {}, {}
    for rid in ['reviewer-1', 'reviewer-2'] + AUX_IDS:
        filename = f'{rid}-stage1-clean-standard.csv' if rid.startswith('reviewer-') else rid.lower()+'.csv'
        path = DESKTOP/filename if rid.startswith('reviewer-') else BUNDLE/filename
        blob = read_input(path, ('core/' if rid.startswith('reviewer-') else 'auxiliary/')+filename, input_entries)
        data[rid], metadata[rid], audits[rid] = load_reviewer(rid, blob)
    metadata_entries = []
    for path in sorted(BUNDLE.iterdir()):
        if path.is_file() and ('readme' in path.name.lower() or 'manifest' in path.name.lower()):
            blob = read_input(path, 'auxiliary/'+path.name, input_entries)
            metadata_entries.append({'filename': path.name, 'read_as': 'UTF-8 text; not used as ratings or exclusion authority',
                                     'text': blob.decode('utf-8-sig')})
    write_json('bundle-metadata.json', {'entries': metadata_entries,
                                      'superseded_rules': protocol['bundle_instructions_superseded']})
    cross = {}
    for rid in ['reviewer-2'] + AUX_IDS:
        shared = metadata['reviewer-1'].keys() & metadata[rid].keys()
        text_bad = sorted(k for k in shared if metadata['reviewer-1'][k]['text'] != metadata[rid][k]['text'])
        def_bad = sorted(k for k in shared if metadata['reviewer-1'][k]['label_definition'] != metadata[rid][k]['label_definition'])
        cross[rid] = {'reference': 'reviewer-1', 'shared_keys_n': len(shared),
                      'text_mismatched_keys': [list(k) for k in text_bad],
                      'definition_mismatched_keys': [list(k) for k in def_bad]}
        if text_bad or def_bad:
            audits[rid]['errors'].append('Cross-reviewer text/definition mismatch against Core Reviewer 1')
    core_keys = sorted(data['reviewer-1'].keys() & data['reviewer-2'].keys())
    if len(core_keys) != 3290:
        audits['reviewer-2']['errors'].append(f'Actual Core overlap is {len(core_keys)}, expected validation value 3290')
    errors = {rid: a['errors'] for rid, a in audits.items() if a['errors']}
    input_audit = {'validation': 'FAIL' if errors else 'PASS', 'inputs': input_entries,
                   'bundle_directory': str(BUNDLE), 'combined_long_csv_used': False,
                   'original_inputs_modified': False, 'previous_access_issue_resolved': True,
                   'cross_reviewer_metadata': cross, 'errors': errors}
    write_json('input-audit.json', input_audit)
    write_json('core-data-audit.json', {'validation': 'FAIL' if any(k.startswith('reviewer-') for k in errors) else 'PASS',
               'reviewers': {k: audits[k] for k in ['reviewer-1', 'reviewer-2']},
               'cross_core_metadata': cross['reviewer-2'], 'actual_core_overlap_n': len(core_keys),
               'all_common_samples_text_equal': not cross['reviewer-2']['text_mismatched_keys'],
               'clean_files_only': True, 'missing_values_imputed': False})
    write_json('auxiliary-data-audit.json', {'reviewers': {k: audits[k] for k in AUX_IDS},
                                          'cross_metadata': {k: cross[k] for k in AUX_IDS}})
    if errors:
        write_json('execution-state.json', {'status': 'VALIDATION_FAILED', 'errors': errors, 'ml_progress_updated': False})
        print(json.dumps({'validation': 'FAIL', 'errors': errors}, indent=2))
        return
    summary = comparison(data['reviewer-1'], data['reviewer-2'])
    summary.update({'primary_categories': VALUES, 'kappa_weighting': 'none',
                    'reviewer2_invalid_judgments_excluded': 684,
                    'missing_reviewer1_judgments_preserved': 4,
                    'comparable_sample_n': len({k[0] for k in core_keys}),
                    'core_population': 'Actual nonblank overlap within R3-001..183 only',
                    'labels_are_human_ratings_not_gold': True})
    write_csv('core-confusion-matrix.csv', [dict(zip(['reviewer1_applicability']+VALUES,
               [v]+summary['confusion_matrix'][i])) for i, v in enumerate(VALUES)])
    scalar_keys = ['valid_overlap_n', 'exact_agreement_n', 'exact_agreement_rate',
                   'disagreement_n', 'disagreement_rate', 'severe_disagreement_n',
                   'severe_disagreement_rate', 'adjacent_disagreement_n', 'NO_vs_PLAUSIBLE_n',
                   'PLAUSIBLE_vs_CLEAR_n', 'NO_vs_CLEAR_n', 'cohens_kappa', 'kappa_status']
    per_label = []
    for label in LABELS:
        stats = comparison(data['reviewer-1'], data['reviewer-2'], [k for k in core_keys if k[1] == label])
        per_label.append({'label': label, **{k: stats[k] for k in scalar_keys}})
    write_csv('core-label-agreement.csv', per_label)
    per_sample = []
    for s in SAMPLES[:183]:
        stats = comparison(data['reviewer-1'], data['reviewer-2'], [k for k in core_keys if k[0] == s])
        per_sample.append({'sample_id': s, 'comparable_label_n': stats['valid_overlap_n'],
                           'disagreement_n': stats['disagreement_n'],
                           'severe_disagreement_n': stats['severe_disagreement_n'],
                           'disagreement_rate': stats['disagreement_rate']})
    write_csv('core-sample-agreement.csv', per_sample)
    disagreements = []
    for s, label in core_keys:
        a, b = data['reviewer-1'][s, label], data['reviewer-2'][s, label]
        if a == b:
            continue
        pair = sorted([a, b], key=VALUES.index)
        disagreements.append({'sample_id': s, 'label': label, 'reviewer1_applicability': a,
                              'reviewer2_applicability': b,
                              'disagreement_type': 'SEVERE' if pair == ['NO', 'CLEAR'] else 'ADJACENT',
                              'disagreement_pair': '_vs_'.join(pair)})
    write_csv('core-disagreements.csv', disagreements)
    qc = [qc_report(rid, data[rid], audits[rid]) for rid in AUX_IDS]
    write_csv('auxiliary-reviewer-qc.csv', qc)
    flagged = {r['reviewer_id'] for r in qc if r['qc_flag'] != 'NONE'}
    aux_comparisons = []
    for rid in AUX_IDS:
        for core in ['reviewer-1', 'reviewer-2']:
            stats = comparison(data[rid], data[core])
            aux_comparisons.append({'auxiliary_reviewer_id': rid, 'core_reviewer_id': core,
                'role': 'AUXILIARY', 'overlap_n': stats['valid_overlap_n'],
                **{k: stats[k] for k in scalar_keys},
                'aux_qc_flag': next(r['qc_flag'] for r in qc if r['reviewer_id'] == rid),
                'reviewer2_validity_mask_applied': core == 'reviewer-2'})
    write_csv('auxiliary-core-agreement.csv', aux_comparisons)
    support = []
    for row in disagreements:
        k = row['sample_id'], row['label']
        actual = {rid: data[rid][k] for rid in AUX_IDS if k in data[rid]}
        c = Counter(actual.values())
        support.append({**row, **{f'aux_{v}_count': c[v] for v in VALUES},
                        'aux_valid_n': len(actual),
                        'aux_unflagged_valid_n': sum(rid not in flagged for rid in actual),
                        'aux_flagged_valid_n': sum(rid in flagged for rid in actual),
                        'aux_flagged_reviewer_ids': '|'.join(rid for rid in actual if rid in flagged),
                        **{rid: actual.get(rid, '') for rid in AUX_IDS}})
    write_csv('core-disagreement-aux-support.csv', support)
    summary['top_disagreement_labels'] = sorted(per_label, key=lambda r: (-r['disagreement_rate'], -r['valid_overlap_n'], r['label']))[:5]
    summary['top_severe_labels'] = sorted(per_label, key=lambda r: (-r['severe_disagreement_n'], -r['severe_disagreement_rate'], r['label']))[:5]
    summary['highest_disagreement_samples'] = sorted(per_sample, key=lambda r: (-r['disagreement_rate'], -r['disagreement_n'], r['sample_id']))[:10]
    summary['core_valid_marginal_distributions'] = {rid: audits[rid]['distribution_valid_nonblank_only'] for rid in ['reviewer-1', 'reviewer-2']}
    write_json('core-agreement-summary.json', summary)
    for entry in input_entries:
        assert digest(Path(entry['original_path']).read_bytes()) == entry['sha256'], 'Original input changed during analysis'
        assert digest(Path(entry['snapshot_path']).read_bytes()) == entry['sha256'], 'Snapshot mismatch'
    input_audit['original_and_snapshot_hashes_reverified'] = True
    write_json('input-audit.json', input_audit)
    top_labels = ', '.join(f"{r['label']} {r['disagreement_n']}/{r['valid_overlap_n']} ({r['disagreement_rate']:.2%})" for r in summary['top_disagreement_labels'])
    top_samples = ', '.join(f"{r['sample_id']} {r['disagreement_n']}/{r['comparable_label_n']}" for r in summary['highest_disagreement_samples'])
    qc_lines = '\n'.join(f"| {r['reviewer_id']} | {r['valid_judgment_n']}/3978 | {r['missing_n']} | {r['NO_n']} | {r['PLAUSIBLE_n']} | {r['CLEAR_n']} | {r['qc_flag']} |" for r in qc)
    report = f'''# Human Review 221 — Stage 1 Core/Auxiliary Audit

Stage 1 applicability only. Categories: NO, PLAUSIBLE, CLEAR. Stage 2 and Stage 3 are DEPRECATED; evidence, rank_order and tie_group are legacy unused fields. The current user protocol supersedes the old bundle instructions about future stages and AUX-R08 exclusion.

## Inputs and validity

Only the two explicitly supplied desktop clean Core CSVs and eight independent Auxiliary CSVs were read as ratings. The user supplied an unpacked directory instead of the initially named ZIP. Exact byte snapshots and SHA-256 hashes are in `input/` and `input-audit.json`. The redundant combined long CSV was not used. The initial operating-system access failure is preserved in `access-history/`; access is now resolved.

Both Core files contain 221 samples, 18 labels/sample, 3,978 rows, no duplicate keys or illegal valid-range applicability values. All ten files have matching sample texts and label definitions on shared keys. This checks the supplied clean exports, not historical UI rendering or canonical raw-text provenance; the earlier quote-rendering issue is not declared resolved by this check.

Reviewer 1 has four unchanged missing judgments: R3-087/fear; R3-163/surprise; R3-168/admiration; R3-168/amusement. Reviewer 2 is valid ONLY for R3-001..R3-183. All 684 positions in R3-184..R3-221 are permanently INVALID/EXCLUDED export placeholders, regardless of whether their CSV value is blank. Their applicability values never enter judgment QA, marginals, comparisons, support counts, or conclusions. Structural sample/text checks do not treat these positions as ratings.

## Core descriptive results

Effective overlap: **{summary['valid_overlap_n']}** judgments from {summary['comparable_sample_n']} samples. Exact agreement: **{summary['exact_agreement_n']}/{summary['valid_overlap_n']} ({summary['exact_agreement_rate']:.6%})**. Unweighted three-category Cohen's kappa: **{summary['cohens_kappa']:.9f}**. Total disagreements: **{summary['disagreement_n']}**, comprising **{summary['severe_disagreement_n']} severe** NO/CLEAR and **{summary['adjacent_disagreement_n']} adjacent** disagreements. PLAUSIBLE remains a separate category.

Highest disagreement rates: {top_labels}.

Highest-disagreement samples, ordered by rate then count: {top_samples}. These are diagnostic cases, not deletion or adjudication targets.

## Auxiliary QC

| Reviewer | Valid coverage | Missing | NO | PLAUSIBLE | CLEAR | QC flag |
|---|---:|---:|---:|---:|---:|---|
{qc_lines}

Coverage uses 3,978 expected keys; category rates use each reviewer's valid nonblank judgments. INCOMPLETE_COVERAGE means any missing judgment. EXTREME_DISTRIBUTION is a descriptive screen (NO rate below 1% or one category at least 99%), not proof of reviewer invalidity. No Auxiliary reviewer was removed or weighted. All eight receive separate Core comparisons. Per-opportunity support counts include all available valid Auxiliary ratings and identify flagged contributions separately without choosing a winning category.

Auxiliary vs Reviewer 1 uses its actual nonblank overlap across all 221 samples; vs Reviewer 2 always uses only R3-001..183. Different populations and class prevalence prevent direct ranking of reviewers from these raw agreement/kappa values. Cohen's kappa is sensitive to class marginals; high raw agreement is not evidence of gold accuracy. Uncertainty intervals and inferential group comparisons were not requested or computed.

## Boundaries and artifacts

NO GOLD LABELS CREATED. NO MAJORITY-VOTE ADJUDICATION. NO AUTOMATIC CORE OVERRIDE. STAGE 2 / STAGE 3 DEPRECATED. ADJUDICATION NOT PERFORMED IN THIS TASK.

The sample is disagreement-enriched and Reviewer 2 coverage is partial, so these descriptive statistics are not an unbiased estimate for the full 841-row Train, a population reliability claim, or model evaluation. Reviewer QC flags neither authorize exclusion/downweighting nor identify correctness. Missing values remain missing. No protected cohort, model predictions, training, taxonomy edit, commit, or push was used.

`core-confusion-matrix.csv` has Reviewer 1 rows and Reviewer 2 columns. `core-label-agreement.csv`, `core-sample-agreement.csv`, and `core-disagreements.csv` expose exact denominators and cases. `auxiliary-reviewer-qc.csv`, `auxiliary-core-agreement.csv`, and `core-disagreement-aux-support.csv` preserve reviewer hierarchy. The latter includes individual Auxiliary values to make counts auditable; no consensus field is created. JSON null / blank metric means undefined, never zero imputation.

Reproduction: run `analyze.py` with the bundled Python runtime on these exact input snapshots/originals; it refuses to overwrite a completed artifact. `verify.py` independently verifies source masks, metrics and saved outputs before completion. No original rating file is modified. ML Lead / Sol decides Stage 1 adjudication methodology next; this task does not start it.
'''
    (OUT / 'README.md').write_text(report, encoding='utf-8')
    progress_entry = f'''\n\n## Human Review 221 — Stage 1 Core/Auxiliary Audit

Date: 2026-09-14. Artifact: `v4/stage1-human-review-core-v1/`.

### Protocol

- Human Review is now formally **Stage 1 only**, using applicability NO / PLAUSIBLE / CLEAR. Stage 2 deprecated. Stage 3 deprecated. `evidence / rank_order / tie_group` are legacy unused fields and are not missing work. This current protocol supersedes earlier log entries and bundle metadata describing later stages.

### Reviewer hierarchy

- Core anchor reviewers: Reviewer 1 and Reviewer 2 only. Auxiliary: AUX-R01 through AUX-R08, each a distinct human reviewer. No equal-status ten-reviewer pool or reviewer weighting.

### Core validity

- Reviewer 1: 221 samples, 3,978 potential judgments, four missing: R3-087/fear; R3-163/surprise; R3-168/admiration; R3-168/amusement. All four remain missing.
- Reviewer 2: valid only R3-001..R3-183, 3,294 valid judgments. R3-184..R3-221 permanently excluded: all 684 invalid export-placeholder judgments are barred from every judgment statistic, QC distribution, comparison and downstream reference construction regardless of blankness.
- Both supplied desktop clean Core CSVs passed schema, keys, label-set, legal-value and cross-Core exact-text/definition checks. Actual nonblank Core overlap = {summary['valid_overlap_n']}; derived from the files, not an assumed denominator. No raw exports or historical reviewer files were substituted.

### Core agreement

- Exact/raw agreement: {summary['exact_agreement_n']}/{summary['valid_overlap_n']} = {summary['exact_agreement_rate']:.9f} ({summary['exact_agreement_rate']:.4%}). Unweighted three-class Cohen's kappa = {summary['cohens_kappa']:.9f}. Total disagreement {summary['disagreement_n']}; severe NO/CLEAR {summary['severe_disagreement_n']}; adjacent {summary['adjacent_disagreement_n']}. PLAUSIBLE remains a third category.
- Highest label disagreement rates: {top_labels}.
- Highest-disagreement samples (rate then count): {top_samples}. Diagnostic only; no examples removed or adjudicated.

### Auxiliary QC

{qc_lines}

- Table order: reviewer | valid/3978 | missing | NO | PLAUSIBLE | CLEAR | flag. These counts were recomputed from the eight individual CSVs. All eight are retained for descriptive comparisons and support counts. Missing ratings stay missing. Flags are not exclusion/downweighting decisions.
- AUX-R06: {next(r for r in qc if r['reviewer_id']=='AUX-R06')['qc_flag']}; {next(r for r in qc if r['reviewer_id']=='AUX-R06')['missing_n']} missing. AUX-R08: {next(r for r in qc if r['reviewer_id']=='AUX-R08')['qc_flag']}; distribution reported explicitly above, including its separately computed Core comparisons in the artifact.
- All Auxiliary comparisons with Reviewer 2 apply the same permanent 183-sample boundary. Per-Core-disagreement Auxiliary counts do not select a final category. Bundle suggestions to exclude AUX-R08 by default or later complete deprecated stages were not followed because the latest user protocol overrides them.

### Methodology boundary

- **NO GOLD LABELS CREATED**
- **NO MAJORITY-VOTE ADJUDICATION**
- **NO AUTOMATIC CORE OVERRIDE**
- **STAGE 2 / STAGE 3 DEPRECATED**
- **ADJUDICATION NOT PERFORMED IN THIS TASK**
- Point estimates describe the observed valid overlap; kappa depends on class prevalence. Partial Core coverage and the enriched sample preclude full-Train population reliability or model-quality claims. Clean-export text consistency does not independently resolve the historical UI quote-rendering concern. No legal149, Blog360, protected holdout, training, model inference, taxonomy modification, commit or push.
- Next: ML Lead / Sol decides Stage 1 adjudication methodology from these artifacts. No follow-up experiment or adjudication is automatically started.
'''
    # Add a real header so the appended auxiliary table is valid Markdown.
    progress_entry = progress_entry.replace('### Auxiliary QC\n\n'+qc_lines,
        '### Auxiliary QC\n\n| Reviewer | Valid coverage | Missing | NO | PLAUSIBLE | CLEAR | QC flag |\n|---|---:|---:|---:|---:|---:|---|\n'+qc_lines)
    (OUT/'progress-entry.md').write_text(progress_entry, encoding='utf-8')
    write_json('execution-state.json', {'status': 'ANALYZED_PENDING_VERIFICATION',
        'timestamp_utc': datetime.now(timezone.utc).isoformat(), 'ml_progress_updated': False,
        'analysis_script_sha256': digest(Path(__file__).read_bytes())})
    print(json.dumps({'status': 'ANALYZED_PENDING_VERIFICATION', 'core': summary,
                      'auxiliary_qc': qc}, indent=2))


if __name__ == '__main__':
    main()
