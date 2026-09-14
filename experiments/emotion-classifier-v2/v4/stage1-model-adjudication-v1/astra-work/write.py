import csv,sys
A={'N':'NO','P':'PLAUSIBLE','C':'CLEAR'}; C={'H':'HIGH','M':'MEDIUM','L':'LOW'}; R={'F':'FEATURE_ABSENT','E':'EXPLICIT','B':'BORDERLINE','I':'INTENSITY','O':'OTHER_EMOTION','V':'EVENT_ONLY','N':'NEGATED','A':'ATTRIBUTION','T':'CONTEXT_ENTAILED'}
p='astra-judgments.csv'
with open(p,'a') as f:
 w=csv.writer(f)
 if f.tell()==0:w.writerow(['adjudication_id','applicability','confidence','reason_code','short_rationale'])
 for l in sys.stdin:
  if not l.strip():continue
  n,c,s=l.rstrip().split('|',2);assert len(s.split())<=20 and len(s)<=180
  w.writerow([f'MAJ-{int(n):04}',A[c[0]],C[c[1]],R[c[2]],s])
