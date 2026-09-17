"""Post-lock extension of the existing comparison; no model calls or final labels."""
import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone

VALUES = ['NO', 'PLAUSIBLE', 'CLEAR']
PRIMARY = ['AUX-R01', 'AUX-R02', 'AUX-R03', 'AUX-R04', 'AUX-R05', 'AUX-R07']

def extend_panel(out, protocol, astra, blind, compared, recovery, transition, sealed):
    def load(name):
        with (out / name).open(newline='', encoding='utf-8-sig') as f:
            return list(csv.DictReader(f))
    def digest(name):
        return hashlib.sha256((out / name).read_bytes()).hexdigest()
    def save(name, rows):
        with (out / name).open('w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)
    def save_json(name, value):
        (out / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')
    assert (out / 'astra-judgments-lock.json').exists(), 'No pre-lock model/human answer reads'
    lock = json.loads((out / 'astra-judgments-lock.json').read_text())
    assert digest('astra-judgments.csv') == lock['sha256']
    assert digest('luna-judgments.csv') == recovery['luna_judgments_sha256']
    luna_rows = load('luna-judgments.csv')
    luna = {r['adjudication_id']: r for r in luna_rows}
    assert len(luna) == len(luna_rows) == len(astra)
    assert luna.keys() == astra.keys()
    for r in luna_rows:
        assert r['applicability'] in VALUES
        assert r['confidence'] in protocol['confidence']
        # Luna has its own frozen finite reason-code vocabulary; applicability
        # and confidence are the comparison-required fields. Do not impose
        # Astra's reason-code vocabulary on the immutable Luna artifact.
        assert r['short_rationale'].strip()
    auxiliary = {r['adjudication_id']: r for r in load('auxiliary-frozen-evidence.csv')}
    assert auxiliary.keys() == astra.keys()
    originals = {r['adjudication_id'] for r in load('astra-work/original.csv')}
    recovered = set(recovery['starting_ids'])
    switched = set(transition['preserved_ids'])
    assert originals <= recovered <= switched <= astra.keys()

    # Preserve judgment schema. Per-cell model/configuration provenance lives in a sidecar.
    provenance = []
    for aid in sorted(astra):
        if aid in originals:
            segment, actor, effort = 'ORIGINAL_186', '/root/astra_blind_judge', 'NOT_INSTRUMENTED'
        elif aid in recovered:
            segment, actor, effort = 'RECOVERED_PRIOR_CONTINUATION', '/root/astra_blind_resume', 'NOT_INSTRUMENTED'
        elif aid in switched:
            segment, actor, effort = 'CONTINUATION_BEFORE_EXPLICIT_XHIGH', '/root/astra_blind_resume', 'NOT_INSTRUMENTED'
        else:
            segment, actor, effort = 'EXPLICIT_XHIGH_CONTINUATION', '/root/astra_xhigh_continuation', 'xhigh'
        provenance.append(dict(adjudication_id=aid, judge_run='Astra', model_identity='gpt-6-astra',
            reasoning_effort=effort, execution_segment=segment, execution_task=actor,
            provenance='ASTRA_INDEPENDENT_BLIND_MODEL_JUDGMENT', independent_panel_vote='Astra',
            final_label_created='false'))
    save('astra-judgment-provenance.csv', provenance)

    # Luna identity is attributed to the supplied finished artifact; never invent an exact version.
    luna_meta = {'user_identified_judge': 'Luna', 'exact_model_identity': 'NOT_INDEPENDENTLY_RECORDED',
                 'reasoning_configuration': 'NOT_INDEPENDENTLY_RECORDED'}
    for name in ['luna-work/completion.json', 'luna-completion.json', 'luna-judgments-lock.json']:
        if (out / name).exists():
            data = json.loads((out / name).read_text())
            luna_meta.setdefault('existing_metadata', []).append({'path': name, 'sha256': digest(name), 'metadata': data})
            candidate = data.get('model', data.get('model_identity'))
            if candidate:
                luna_meta['exact_model_identity'] = candidate
            effort = data.get('reasoning_effort', data.get('reasoning_configuration'))
            if effort:
                luna_meta['reasoning_configuration'] = effort
    save_json('model-panel-provenance.json', {
        'created_after_astra_lock_utc': sealed, 'independent_panel_judges': ['Astra', 'Luna'],
        'astra_model_identity': 'gpt-6-astra', 'astra_current_reasoning_effort': 'xhigh',
        'astra_configuration_transition_count': len(switched), 'astra_original_count': len(originals),
        'astra_segments': dict(Counter(r['execution_segment'] for r in provenance)),
        'astra_same_judge_run_across_segments': True, 'luna': luna_meta,
        'luna_sha256': digest('luna-judgments.csv'), 'luna_regenerated_this_task': False,
        'no_ultra_model_judge': True, 'final_reference_set_allowed': False})

    def vote(row, reviewers):
        counts = Counter(row[reviewer] for reviewer in reviewers if row[reviewer] in VALUES)
        n = sum(counts.values())
        winners = [v for v in VALUES if counts[v] * 2 > n]
        category = winners[0] if winners else ''
        return counts, n, category, bool(category and n >= 5 and counts[category] / n >= .8)

    matrix = Counter()
    by_label = defaultdict(Counter)
    pairs, disagreements = [], []
    metrics = defaultdict(Counter)
    sensitivity = defaultdict(Counter)
    for row in compared:
        aid, label = row['adjudication_id'], row['label']
        a, l = astra[aid]['applicability'], luna[aid]['applicability']
        pair = dict(adjudication_id=aid, sample_id=row['sample_id'], label=label,
            astra_applicability=a, luna_applicability=l, exact_match=str(a == l).lower(),
            transition=f'{a}->{l}', severe_no_clear=str({a,l} == {'NO','CLEAR'}).lower())
        pairs.append(pair)
        if a != l:
            disagreements.append(pair)
        matrix[a,l] += 1
        by_label[label]['n'] += 1
        by_label[label]['matches'] += a == l
        by_label[label]['severe'] += {a,l} == {'NO','CLEAR'}
        aux = auxiliary[aid]
        counts, n, consensus, strong = vote(aux, PRIMARY)
        row.update(luna_applicability=l, luna_confidence=luna[aid]['confidence'],
            luna_reason_code=luna[aid]['reason_code'], luna_short_rationale=luna[aid]['short_rationale'],
            luna_provenance='EXISTING_LUNA_MODEL_JUDGMENT',
            aux_primary_reviewers='AUX-R01..R05;AUX-R07',
            aux_primary_valid_n=n, aux_primary_consensus=consensus,
            aux_primary_consensus_status='STRICT_MAJORITY' if consensus else 'MIXED',
            aux_primary_strong_support=str(strong).lower(),
            aux_normal_columns_role='LEGACY_R01_R07_INCLUDING_R06_SENSITIVITY_ONLY',
            aux_r06_role='SENSITIVITY_ONLY', aux_r08_role='SENSITIVITY_ONLY',
            astra_matches_luna=str(a == l).lower())
        for value in VALUES:
            row[f'aux_primary_{value}_count'] = counts[value]
        # Confirm existing master values rather than modifying frozen human evidence.
        legacy_counts, legacy_n, legacy_consensus, _ = vote(aux, PRIMARY + ['AUX-R06'])
        assert all(int(row[f'aux_{v}_count_normal']) == legacy_counts[v] for v in VALUES)
        assert int(row['aux_valid_n_normal']) == legacy_n
        assert row['aux_r06_applicability'] == aux['AUX-R06']
        assert row['aux_r08_applicability'] == aux['AUX-R08']
        sources = {
            'CORE1': row['core1_applicability'] if row['core1_status'] == 'VALID_HUMAN' else '',
            'CORE2_VALID': row['core2_applicability'] if row['core2_status'] == 'VALID_HUMAN' else '',
            'AUX_PRIMARY_SUPPORT': consensus,
            **{reviewer: aux[reviewer] for reviewer in [f'AUX-R{i:02d}' for i in range(1,9)]}}
        if row['core1_status'] == 'CORE1_HUMAN_MISSING':
            assert row['core1_applicability'] == ''
        if int(row['sample_id'].split('-')[1]) >= 184:
            assert row['core2_status'] == 'CORE2_INVALID_PLACEHOLDER' and row['core2_applicability'] == ''
        for judge, value in [('Astra', a), ('Luna', l)]:
            for source, ref in sources.items():
                metric = metrics[judge, source]
                metric['unavailable_n'] += not bool(ref)
                if ref:
                    metric['comparable_n'] += 1
                    metric['match_n'] += value == ref
                    metric['severe_n'] += {value, ref} == {'NO', 'CLEAR'}
                row[f'{judge.lower()}_matches_{source.lower()}'] = '' if not ref else str(value == ref).lower()
        for name, reviewers in [
            ('PRIMARY_PLUS_R06', PRIMARY+['AUX-R06']),
            ('PRIMARY_PLUS_R08', PRIMARY+['AUX-R08']),
            ('PRIMARY_PLUS_R06_R08', PRIMARY+['AUX-R06','AUX-R08'])]:
            _, variant_n, variant, variant_strong = vote(aux, reviewers)
            row[f'aux_sensitivity_{name.lower()}'] = variant
            acc = sensitivity[name]
            acc['cells_n'] += 1
            acc['consensus_changed_including_mixed_n'] += variant != consensus
            acc['both_defined_n'] += bool(variant and consensus)
            acc['defined_category_changed_n'] += bool(variant and consensus and variant != consensus)
            acc['strong_support_n'] += variant_strong
            for judge, value in [('Astra',a),('Luna',l)]:
                if variant:
                    acc[f'{judge}_comparable_n'] += 1
                    acc[f'{judge}_matches_n'] += value == variant
    save('model-human-comparison.csv', compared)
    save('model-model-comparison.csv', pairs)
    # Keep header even if models exactly agree on every cell.
    with (out/'model-model-disagreements.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(pairs[0]));w.writeheader();w.writerows(disagreements)
    save('model-model-confusion-matrix.csv', [dict(astra_applicability=a, **{l:matrix[a,l] for l in VALUES}) for a in VALUES])
    save('model-model-transition-counts.csv', [dict(astra_applicability=a,luna_applicability=l,rows=matrix[a,l]) for a in VALUES for l in VALUES])
    save('model-model-label-agreement.csv', [dict(label=label, cells_n=values['n'], exact_match_n=values['matches'],
        exact_match_rate=values['matches']/values['n'], disagreement_n=values['n']-values['matches'],
        severe_no_clear_n=values['severe']) for label,values in sorted(by_label.items())])
    metric_rows = []
    for (judge, source), values in sorted(metrics.items()):
        n=values['comparable_n']
        role='CORE_ANCHOR' if source.startswith('CORE') else ('AUXILIARY_SENSITIVITY' if source in ['AUX-R06','AUX-R08'] else 'AUXILIARY_SUPPORT')
        metric_rows.append(dict(judge=judge, comparator=source, comparator_role=role,
            comparable_n=n, unavailable_n=values['unavailable_n'], match_n=values['match_n'],
            match_rate=values['match_n']/n if n else '', severe_no_clear_n=values['severe_n']))
    save('model-human-pairwise-summary.csv', metric_rows)
    save('auxiliary-sensitivity-summary.csv', [dict(sensitivity_variant=name,**{key:counts[key] for key in [
        'cells_n','consensus_changed_including_mixed_n','both_defined_n','defined_category_changed_n','strong_support_n',
        'Astra_comparable_n','Astra_matches_n','Luna_comparable_n','Luna_matches_n']}) for name,counts in sensitivity.items()])
    result = {'created_utc':datetime.now(timezone.utc).isoformat(),'astra_sealed_utc':sealed,
        'astra_judgments_n':len(astra),'luna_judgments_n':len(luna),'luna_file_unchanged':True,
        'model_model_exact_match_n':sum(matrix[v,v] for v in VALUES),'model_model_disagreement_n':len(disagreements),
        'model_model_exact_match_rate':sum(matrix[v,v] for v in VALUES)/len(astra),
        'primary_auxiliary_reviewers':PRIMARY,'separate_sensitivity_reviewers':['AUX-R06','AUX-R08'],
        'aux_r06_scope':'user-designated sensitivity; prior audit incomplete coverage; no new reviewer quality inference',
        'no_all_human_pool':True,'no_automatic_core_override':True,'final_labels_created':False,'final_reference_set_allowed':False,
        'interpretation':'Descriptive agreement on selected queue only, not accuracy or final product evaluation. Missing/invalid human values are never imputed.'}
    save_json('model-panel-summary.json',result)
    comparison_summary=json.loads((out/'comparison-summary.json').read_text())
    comparison_summary.update(primary_auxiliary_reviewers=PRIMARY,separate_sensitivity_reviewers=['AUX-R06','AUX-R08'],
        pairwise_summary_file='model-human-pairwise-summary.csv',panel_summary_file='model-panel-summary.json',
        legacy_comparisons_scope='Original R01..R07 counts remain for sensitivity only; current primary excludes R06/R08')
    save_json('comparison-summary.json',comparison_summary)
    assert digest('astra-judgments.csv') == lock['sha256']
    assert digest('luna-judgments.csv') == recovery['luna_judgments_sha256']
    return result
