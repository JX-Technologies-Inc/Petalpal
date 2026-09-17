"""Validate completed Stage 1 outputs only; never rerun the earlier human audit."""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parent
VALUES = {'NO','PLAUSIBLE','CLEAR'}

def validate(out=OUT, require_progress=True):
    def js(name):
        return json.loads((out/name).read_text())
    def rows(name):
        with (out/name).open(newline='',encoding='utf-8-sig') as f:
            r=csv.DictReader(f)
            return r.fieldnames,list(r)
    def sha(path):
        return hashlib.sha256(path.read_bytes()).hexdigest()
    checks={}
    def check(name, condition):
        checks[name]=bool(condition)
        assert condition, name
    protocol=js('protocol.json')
    recovery=js('resume-state.json')
    transition=js('astra-configuration-transition.json')
    account=js('account-continuation-checkpoint.json')
    f,blind=rows('model-judge-blind-input.csv')
    expected={r['adjudication_id'] for r in blind}
    check('blind_schema_exact', f==['adjudication_id','sample_id','text','label','label_definition','semantic_guidance_if_any'])
    check('expected_unique_1818', len(expected)==len(blind)==1818)
    for name,digest in js('blind-input-lock.json')['sha256'].items():
        check('semantic_hash_'+name,sha(out/name)==digest)
    check('blind_csv_byte_identity',(out/'model-judge-blind-input.csv').read_bytes()==(out/'luna-judge-input.csv').read_bytes())
    check('luna_output_preserved',sha(out/'luna-judgments.csv')==recovery['luna_judgments_sha256'])
    if (out/'input-preservation.json').exists():
        for name,digest in js('input-preservation.json')['sha256'].items():
            check('immutable_'+name,sha(out/name)==digest)
    judges={}
    invalid_count=0
    for name in ['astra','luna']:
        fields,data=rows(name+'-judgments.csv')
        check(name+'_schema',fields==['adjudication_id','applicability','confidence','reason_code','short_rationale'])
        ids=[r['adjudication_id'] for r in data]
        check(name+'_unique_complete_no_extra',len(data)==len(set(ids))==1818 and set(ids)==expected)
        invalid=[r for r in data if r['applicability'] not in VALUES or r['confidence'] not in protocol['confidence']
                 or not r['reason_code'].strip() or not r['short_rationale'].strip()]
        if name == 'astra':
            invalid=[r for r in data if r['applicability'] not in VALUES or r['confidence'] not in protocol['confidence']
                     or r['reason_code'] not in protocol['reason_codes'] or not r['short_rationale'].strip()]
        check(name+'_valid_metadata',not invalid)
        if name=='astra':
            invalid_count=len(invalid)
            check('astra_rationale_short',all(len(r['short_rationale'])<=protocol['short_rationale_max_chars']
                and len(r['short_rationale'].split())<=protocol['short_rationale_max_words']
                and '\n' not in r['short_rationale'] for r in data))
        judges[name]={r['adjudication_id']:r for r in data}
    b=(out/'astra-judgments.csv').read_bytes()
    for state,byte_key,hash_key,name in [
        (recovery,'judgment_prefix_bytes','judgment_prefix_sha256','recovery_585'),
        (transition,'preserved_prefix_bytes','preserved_prefix_sha256','xhigh_transition_667'),
        (account,'starting_prefix_bytes','starting_prefix_sha256','account_checkpoint_918')]:
        check(name+'_preserved',hashlib.sha256(b[:state[byte_key]]).hexdigest()==state[hash_key])
    check('original_186_prefix_preserved',b.startswith((out/'astra-work/original.csv').read_bytes()))
    seal=js('astra-judgments-lock.json')
    check('astra_final_seal',seal['sha256']==sha(out/'astra-judgments.csv') and seal['judgment_n']==1818)
    completion=js('astra-work/completion.json')
    check('xhigh_completion_attestation',completion['reasoning_effort']=='xhigh' and completion['completed_cells']==1818
        and completion['no_human_or_other_model_answers_read'] is True and completion['final_labels_created'] is False)
    _,master=rows('model-adjudication-input.csv')
    master={r['adjudication_id']:r for r in master}
    check('master_queue_complete',master.keys()==expected)
    for r in blind:
        check_key=master[r['adjudication_id']]
        assert all(r[k]==check_key[k] for k in ['sample_id','text','label','label_definition'])
    checks['semantic_projection_preserved']=True
    _,comp=rows('model-human-comparison.csv')
    check('comparison_complete',len(comp)==1818 and {r['adjudication_id'] for r in comp}==expected)
    _,aux=rows('auxiliary-frozen-evidence.csv')
    aux={r['adjudication_id']:r for r in aux}
    missing_expected={('R3-087','fear'),('R3-163','surprise'),('R3-168','admiration'),('R3-168','amusement')}
    check('core1_missing_keys_frozen',{(r['sample_id'],r['label']) for r in comp if r['core1_status']=='CORE1_HUMAN_MISSING'}==missing_expected)
    primary=['AUX-R01','AUX-R02','AUX-R03','AUX-R04','AUX-R05','AUX-R07']
    def vote(values):
        c=Counter(v for v in values if v in VALUES);n=sum(c.values())
        w=[v for v in VALUES if c[v]*2>n]
        return c,n,w[0] if w else ''
    for r in comp:
        aid=r['adjudication_id']; a=judges['astra'][aid];l=judges['luna'][aid]
        assert all(r[k]==v for k,v in master[aid].items()), 'Frozen master fields changed'
        assert r['astra_applicability']==a['applicability'] and r['luna_applicability']==l['applicability']
        for judge,d in [('astra',a),('luna',l)]:
            assert r[judge+'_confidence']==d['confidence'] and r[judge+'_short_rationale']==d['short_rationale']
            assert r[judge+'_reason_code']==d['reason_code']
        if r['core1_status']=='CORE1_HUMAN_MISSING':
            assert r['core1_applicability']==r['astra_matches_core1']==r['luna_matches_core1']==''
        if int(r['sample_id'].split('-')[1])>=184:
            assert r['core2_status']=='CORE2_INVALID_PLACEHOLDER' and r['core2_applicability']==''
            assert r['astra_matches_core2_valid']==r['luna_matches_core2_valid']==r['astra_matches_valid_core2']==''
        c,n,w=vote([aux[aid][rev] for rev in primary])
        assert int(r['aux_primary_valid_n'])==n and r['aux_primary_consensus']==w
        assert all(int(r[f'aux_primary_{v}_count'])==c[v] for v in VALUES)
        strong=bool(w and n>=5 and c[w]/n>=.8)
        assert r['aux_primary_strong_support']==str(strong).lower()
        assert r['aux_r06_applicability']==aux[aid]['AUX-R06'] and r['aux_r08_applicability']==aux[aid]['AUX-R08']
        assert r['final_reference_set_allowed']=='false'
    checks.update(frozen_master_fields_preserved=True,core1_missing_not_imputed=True,core2_tail_never_used=True,
        auxiliary_primary_excludes_r06_r08=True,individual_auxiliary_preserved=True,model_values_not_revised_after_join=True)
    _,registry=rows('core-human-agreement-registry.csv')
    check('agreement_registry_preserved_excluded',len(registry)==2160 and all(r['status']=='CORE_HUMAN_AGREEMENT'
        and r['automatic_model_override_allowed']=='false' for r in registry)
        and not {(r['sample_id'],r['label']) for r in registry}&{(r['sample_id'],r['label']) for r in comp})
    _,provenance=rows('astra-judgment-provenance.csv')
    check('provenance_complete',len(provenance)==1818 and {r['adjudication_id'] for r in provenance}==expected)
    switched=set(transition['preserved_ids'])
    check('configuration_boundary_honest',all(r['judge_run']=='Astra' and
        r['reasoning_effort']==('NOT_INSTRUMENTED' if r['adjudication_id'] in switched else 'xhigh') for r in provenance))
    check('two_model_panel_only',js('model-panel-provenance.json')['independent_panel_judges']==['Astra','Luna'])
    _,pairs=rows('model-model-comparison.csv')
    expected_matrix=Counter((r['astra_applicability'],r['luna_applicability']) for r in pairs)
    _,matrix=rows('model-model-confusion-matrix.csv')
    check('model_matrix_reconciles',len(pairs)==1818 and all(int(r[v])==expected_matrix[r['astra_applicability'],v] for r in matrix for v in VALUES))
    _,dis=rows('model-model-disagreements.csv')
    check('model_disagreement_keys',{r['adjudication_id'] for r in dis}=={r['adjudication_id'] for r in pairs if r['astra_applicability']!=r['luna_applicability']})
    _,label_rows=rows('model-model-label-agreement.csv')
    check('model_label_counts_reconcile',sum(int(r['cells_n']) for r in label_rows)==1818
        and sum(int(r['disagreement_n']) for r in label_rows)==len(dis))
    _,pairwise=rows('model-human-pairwise-summary.csv')
    for judge in ['Astra','Luna']:
        for src,field,status in [('CORE1','core1_applicability','core1_status'),('CORE2_VALID','core2_applicability','core2_status')]:
            row=next(r for r in pairwise if r['judge']==judge and r['comparator']==src)
            valid=[r for r in comp if r[status]=='VALID_HUMAN' and r[field] in VALUES]
            assert int(row['comparable_n'])==len(valid)
            assert int(row['match_n'])==sum(r[judge.lower()+'_applicability']==r[field] for r in valid)
    checks['pairwise_core_denominators_valid_only']=True
    check('comparison_after_lock',js('model-panel-summary.json')['created_utc']>=seal['sealed_utc'])
    check('no_final_reference',protocol['final_reference_set_allowed'] is False and protocol['final_labels_created'] is False
        and js('model-panel-summary.json')['final_reference_set_allowed'] is False)
    for name in ['README.md','model-model-transition-counts.csv','model-human-pairwise-summary.csv','auxiliary-sensitivity-summary.csv']:
        check('required_'+name,(out/name).is_file())
    if require_progress:
        audit=js('progress-append-audit.json')
        p=Path(audit['path']);content=p.read_bytes()
        check('ml_progress_append_only',hashlib.sha256(content[:audit['previous_bytes']]).hexdigest()==audit['previous_sha256']
            and sha(p)==audit['after_sha256'])
        delta=content[audit['previous_bytes']:].decode()
        check('delta_correct_heading_once',delta.count('## Human Review 221 — Transition to Model Adjudication')==1)
    return {'validation':'PASS','checks':checks,'astra_completed_n':1818,'duplicate_n':0,'missing_n':0,'extra_n':0,
        'invalid_judgment_n':invalid_count,'luna_output_preserved':True,'auxiliary_evidence_preserved':True,
        'final_reference_set_allowed':False,'ml_progress_updated':require_progress,
        'validation_scope':'Workflow integrity and output reconciliation; no repeat of old Core agreement/kappa audit; blind execution based on isolated-agent history/attestations and hashes.'}

if __name__=='__main__':
    print(json.dumps(validate(),indent=2))
