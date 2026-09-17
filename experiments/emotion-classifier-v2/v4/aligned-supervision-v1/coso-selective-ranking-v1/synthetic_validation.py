import json,torch
from pathlib import Path
P=Path(__file__).resolve().parent
def main():
 torch.manual_seed(44); logits=torch.randn(7,18); y=torch.randint(0,2,(7,18)).float(); w=torch.ones(18); loss=torch.nn.BCEWithLogitsLoss(pos_weight=w); a=loss(logits,y); assert torch.isfinite(a)
 # Mean-of-sample losses equals the protocol's gradient-accumulation normalization.
 parts=[loss(logits[i:i+2],y[i:i+2]) for i in range(0,6,2)]; eq=sum(parts)/3; full=loss(logits[:6],y[:6]); assert torch.allclose(eq,full,atol=1e-6)
 out={'syntheticLossFinite':True,'accumulationWeightEquivalence':True,'optimizerSteps':0};(P/'synthetic-validation.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out))
if __name__=='__main__':main()
