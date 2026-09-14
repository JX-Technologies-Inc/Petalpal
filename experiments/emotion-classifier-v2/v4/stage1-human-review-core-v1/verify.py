"""Independent verification of saved descriptive outputs and append-only finalization."""
import csv
import hashlib
import json
import math
import os
import sys
from collections import Counter
from fractions import Fraction
from pathlib import Path

OUT = Path(__file__).resolve().parent
VALUES = ('NO', 'PLAUSIBLE', 'CLEAR')
R2_IDS = {f'R3-{i:03d}' for i in range(1, 184)}
AUX = [f'AUX-R{i:02d}' for i in range(1, 9)]
REQUIRED = ['protocol.json', 'input-audit.json', 'core-data-audit.json',
            'core-agreement-summary.json', 'core-confusion-matrix.csv',
            'core-label-agreement.csv', 'core-sample-agreement.csv',
            'core-disagreements.csv', 'core-disagreement-aux-support.csv',
            'auxiliary-reviewer-qc.csv', 'auxiliary-core-agreement.csv', 'README.md']


def sha(blob):
    return hashlib.sha256(blob).hexdigest()


def rows(name):
    with (OUT/name).open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))


def source_ratings(name, reviewer2=False):
    result = {}
    for r in rows(name):
        # The invalid range is rejected BEFORE inspecting applicability.
        if reviewer2 and r['sample_id'] not in R2_IDS:
            continue
        if r['applicability'] == '':
            continue
        assert r['applicability'] in VALUES
        key = (r['sample_id'], r['label'])
        assert key not in result
        result[key] = r['applicability']
    return result


def independent_stats(a, b, keys=None):
    ks = a.keys() & b.keys()
    if keys is not None:
        ks &= set(keys)
    pairs = Counter((a[k], b[k]) for k in ks)
    n = sum(pairs.values())
    exact = sum(pairs[c, c] for c in VALUES)
    ca = Counter(a[k] for k in ks)
    cb = Counter(b[k] for k in ks)
    expected = sum(Fraction(ca[c], n)*Fraction(cb[c], n) for c in VALUES) if n else None
    kap = float((Fraction(exact, n)-expected)/(1-expected)) if n and expected != 1 else None
    severe = pairs['NO', 'CLEAR'] + pairs['CLEAR', 'NO']
    np = pairs['NO', 'PLAUSIBLE'] + pairs['PLAUSIBLE', 'NO']
    pc = pairs['PLAUSIBLE', 'CLEAR'] + pairs['CLEAR', 'PLAUSIBLE']
    return {'valid_overlap_n': n, 'exact_agreement_n': exact,
            'exact_agreement_rate': exact/n if n else None,
            'disagreement_n': n-exact, 'disagreement_rate': (n-exact)/n if n else None,
            'severe_disagreement_n': severe, 'severe_disagreement_rate': severe/n if n else None,
            'adjacent_disagreement_n': np+pc, 'NO_vs_PLAUSIBLE_n': np,
            'PLAUSIBLE_vs_CLEAR_n': pc, 'NO_vs_CLEAR_n': severe,
            'cohens_kappa': kap}, pairs


def equal_numbers(saved, computed):
    for k, v in computed.items():
        if v is None:
            assert saved[k] in ('', None), (k, saved[k], v)
        elif isinstance(v, int):
            assert int(saved[k]) == v, (k, saved[k], v)
        else:
            assert math.isclose(float(saved[k]), v, rel_tol=1e-12, abs_tol=1e-12), (k, saved[k], v)


def verify():
    assert all((OUT/p).is_file() for p in REQUIRED)
    protocol = json.loads((OUT/'protocol.json').read_text())
    assert protocol['human_review_protocol'] == 'STAGE1_ONLY'
    assert protocol['stage2_status'] == protocol['stage3_status'] == 'DEPRECATED'
    assert protocol['stage1_values'] == list(VALUES)
    assert protocol['reviewer2_valid_range'] == 'R3-001..R3-183'
    assert protocol['reviewer2_invalid_range'] == 'R3-184..R3-221'
    for flag in ['gold_labels_created', 'majority_vote_used', 'adjudication_performed',
                 'automatic_core_override', 'reviewer_weighting_used', 'ratings_imputed',
                 'reviewers_automatically_removed', 'training_performed', 'protected_data_accessed']:
        assert protocol[flag] is False
    input_audit = json.loads((OUT/'input-audit.json').read_text())
    assert input_audit['validation'] == 'PASS'
    for item in input_audit['inputs']:
        assert sha(Path(item['original_path']).read_bytes()) == item['sha256']
        assert sha(Path(item['snapshot_path']).read_bytes()) == item['sha256']
    a = source_ratings('input/core/reviewer-1-stage1-clean-standard.csv')
    b = source_ratings('input/core/reviewer-2-stage1-clean-standard.csv', True)
    aux = {rid: source_ratings('input/auxiliary/'+rid.lower()+'.csv') for rid in AUX}
    assert len(a) == 3974 and len(b) == 3294
    assert all(k[0] in R2_IDS for k in b)
    allkeys = {(f'R3-{i:03d}', l) for i in range(1,222) for l in protocol['labels']}
    expected_missing = {('R3-087','fear'), ('R3-163','surprise'),
                        ('R3-168','admiration'), ('R3-168','amusement')}
    assert allkeys-a.keys() == expected_missing
    assert len([k for k in allkeys if k[0] not in R2_IDS]) == 684
    stats, pairs = independent_stats(a, b)
    assert stats['valid_overlap_n'] == 3290
    summary = json.loads((OUT/'core-agreement-summary.json').read_text())
    equal_numbers(summary, stats)
    for rid, raw in [('reviewer-1', a), ('reviewer-2', b)]:
        counts = Counter(raw.values())
        assert summary['core_valid_marginal_distributions'][rid] == {v: counts[v] for v in VALUES}
    for row in rows('core-confusion-matrix.csv'):
        for v in VALUES:
            assert int(row[v]) == pairs[row['reviewer1_applicability'], v]
    labels = rows('core-label-agreement.csv')
    assert {r['label'] for r in labels} == set(protocol['labels']) and len(labels) == 18
    for r in labels:
        expected, _ = independent_stats(a, b, {k for k in a if k[1] == r['label']})
        equal_numbers(r, expected)
    for field in ['valid_overlap_n', 'exact_agreement_n', 'disagreement_n', 'severe_disagreement_n', 'adjacent_disagreement_n']:
        assert sum(int(r[field]) for r in labels) == stats[field]
    samples = rows('core-sample-agreement.csv')
    assert {r['sample_id'] for r in samples} == R2_IDS and len(samples) == 183
    for r in samples:
        expected, _ = independent_stats(a, b, {k for k in a if k[0] == r['sample_id']})
        assert int(r['comparable_label_n']) == expected['valid_overlap_n']
        equal_numbers(r, {k: expected[k] for k in ('disagreement_n','severe_disagreement_n','disagreement_rate')})
    assert sum(int(r['comparable_label_n']) for r in samples) == stats['valid_overlap_n']
    drows = rows('core-disagreements.csv')
    dkeys = {(r['sample_id'],r['label']) for r in drows}
    assert dkeys == {k for k in a.keys() & b.keys() if a[k] != b[k]}
    assert len(drows) == len(dkeys) == stats['disagreement_n']
    for r in drows:
        k = (r['sample_id'], r['label'])
        assert k[0] in R2_IDS
        assert r['reviewer1_applicability'] == a[k] and r['reviewer2_applicability'] == b[k]
        assert (r['disagreement_type']=='SEVERE') == ({a[k], b[k]} == {'NO','CLEAR'})
    qc = {r['reviewer_id']: r for r in rows('auxiliary-reviewer-qc.csv')}
    assert set(qc) == set(AUX)
    for rid in AUX:
        c, q = Counter(aux[rid].values()), qc[rid]
        assert q['role'] == 'AUXILIARY'
        assert int(q['valid_judgment_n']) == len(aux[rid])
        assert int(q['missing_n']) == 3978-len(aux[rid])
        assert math.isclose(float(q['coverage_rate']),len(aux[rid])/3978)
        for v in VALUES:
            assert int(q[v+'_n']) == c[v]
            assert math.isclose(float(q[v+'_rate']),c[v]/len(aux[rid]))
        assert q['included_in_descriptive_comparisons']=='True'
        assert q['reviewer_weight_assigned']=='False'
    assert qc['AUX-R06']['missing_n']=='36' and qc['AUX-R06']['qc_flag']=='INCOMPLETE_COVERAGE'
    assert qc['AUX-R08']['NO_n']=='1' and qc['AUX-R08']['qc_flag']=='EXTREME_DISTRIBUTION'
    # Known counts are checked only after independently recomputing the actual QC.
    comparisons = rows('auxiliary-core-agreement.csv')
    assert len(comparisons)==16
    assert {(r['auxiliary_reviewer_id'],r['core_reviewer_id']) for r in comparisons} == {(rid,cr) for rid in AUX for cr in ('reviewer-1','reviewer-2')}
    for r in comparisons:
        core = a if r['core_reviewer_id']=='reviewer-1' else b
        expected, _ = independent_stats(aux[r['auxiliary_reviewer_id']], core)
        equal_numbers(r, expected)
        assert int(r['overlap_n']) == expected['valid_overlap_n']
        if r['core_reviewer_id']=='reviewer-2':
            assert all(k[0] in R2_IDS for k in aux[r['auxiliary_reviewer_id']].keys() & core.keys())
    support = rows('core-disagreement-aux-support.csv')
    assert len(support)==len(dkeys)
    assert {(r['sample_id'],r['label']) for r in support}==dkeys
    for r in support:
        key = r['sample_id'],r['label']
        c=Counter(aux[rid][key] for rid in AUX if key in aux[rid])
        assert int(r['aux_valid_n'])==sum(c.values())
        for v in VALUES:
            assert int(r['aux_'+v+'_count'])==c[v]
        assert int(r['aux_flagged_valid_n'])+int(r['aux_unflagged_valid_n'])==int(r['aux_valid_n'])
        flagged_valid = [rid for rid in AUX if qc[rid]['qc_flag']!='NONE' and key in aux[rid]]
        assert r['aux_flagged_reviewer_ids']=='|'.join(flagged_valid)
        assert int(r['aux_flagged_valid_n'])==len(flagged_valid)
        for rid in AUX:
            assert r[rid]==aux[rid].get(key,'')
    for filename in REQUIRED:
        if filename.endswith('.csv'):
            columns = set(rows(filename)[0])
            assert not columns & {'evidence','rank_order','tie_group','gold_label','final_label','adjudicated_label','consensus','majority_label'}
    checks = {
        'required_artifacts_present': True,
        'source_and_snapshot_sha256_equal': True,
        'core_actual_overlap_3290': True,
        'r2_684_invalid_positions_excluded_from_all_judgment_statistics': True,
        'r1_four_exact_missing_keys_preserved': True,
        'core_metrics_independently_verified_with_fraction_kappa': True,
        'label_and_sample_denominators_reconcile': True,
        'all_16_auxiliary_core_comparisons_independently_verified': True,
        'all_auxiliary_support_counts_match_individual_nonblank_ratings': True,
        'aux_r06_r08_flagged_and_retained': True,
        'stage2_stage3_unused_and_deprecated': True,
        'no_gold_consensus_adjudication_or_weighting': True,
    }
    return {'validation': 'PASS', 'checks': checks, 'core': stats,
            'other_flagged_auxiliary': [rid for rid in AUX if qc[rid]['qc_flag']!='NONE' and rid not in ('AUX-R06','AUX-R08')]}


def finalize(result):
    state = json.loads((OUT/'execution-state.json').read_text())
    if state['status']=='COMPLETE':
        assert state['ml_progress_updated']
        return
    progress = OUT.parent.parent/'ML_PROGRESS.md'
    entry = (OUT/'progress-entry.md').read_bytes()
    previous = progress.read_bytes()
    heading = b'## Human Review 221 '
    assert heading not in previous, 'A prior audit heading exists; inspect before appending'
    # Re-check immediately before the only permitted mutation of canonical history.
    assert progress.read_bytes()==previous
    with progress.open('ab') as f:
        f.write(entry)
        f.flush()
        os.fsync(f.fileno())
    after=progress.read_bytes()
    assert after==previous+entry, 'Append-only history verification failed'
    progress_audit={'path':str(progress), 'append_only_verified':True,
        'previous_bytes':len(previous), 'previous_sha256':sha(previous),
        'entry_bytes':len(entry), 'entry_sha256':sha(entry),
        'final_bytes':len(after), 'final_sha256':sha(after)}
    (OUT/'progress-append-audit.json').write_text(json.dumps(progress_audit,indent=2)+'\n')
    result['checks']['ml_progress_append_only_verified']=True
    result['ml_progress_updated']=True
    state.update({'status':'COMPLETE','validation':'PASS','ml_progress_updated':True,
                  'final_analysis_script_sha256':sha((OUT/'analyze.py').read_bytes()),
                  'verification_script_sha256':sha(Path(__file__).read_bytes())})
    (OUT/'execution-state.json').write_text(json.dumps(state,indent=2)+'\n')
    report=OUT/'README.md'
    report.write_text(report.read_text()+
        '\nCompletion: independent artifact verification PASS. Canonical ML_PROGRESS.md was appended; its previous bytes were preserved exactly. See `validation.json` and `progress-append-audit.json`.\n')


if __name__=='__main__':
    try:
        result=verify()
        if '--finalize' in sys.argv:
            finalize(result)
        (OUT/'validation.json').write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result,indent=2))
    except Exception as exc:
        (OUT/'validation.json').write_text(json.dumps({'validation':'FAIL','blocking_issue':str(exc)},indent=2)+'\n')
        raise
