import numpy as np
from sklearn.metrics import precision_recall_fscore_support
LABELS=["admiration","amusement","anger","annoyance","caring","confusion","curiosity","disappointment","disgust","excitement","fear","gratitude","joy","love","optimism","remorse","sadness","surprise"]
THRESHOLD=.35
def select(probabilities, model_labels):
    eligible=[(float(probabilities[label]),i,label) for i,label in enumerate(LABELS) if float(probabilities[label])>=THRESHOLD]
    return [x[2] for x in sorted(eligible,key=lambda x:(-x[0],x[1]))[:2]]
def metric_report(y_true,y_pred):
    p,r,f,s=precision_recall_fscore_support(y_true,y_pred,average=None,zero_division=0,labels=list(range(len(LABELS))))
    return {'macro':{'precision':float(p.mean()),'recall':float(r.mean()),'f1':float(f.mean())},'micro':dict(zip(('precision','recall','f1'),map(float,precision_recall_fscore_support(y_true,y_pred,average='micro',zero_division=0)[:3])))}
