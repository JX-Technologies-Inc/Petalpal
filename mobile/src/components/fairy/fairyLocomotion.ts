/** Source-space rigid transforms only. No deformation, recoloring or new pixels. */
export function fairyGait(phase:number,weight:number) {
  'worklet';
  const w=Math.max(0,Math.min(1,weight));
  return {
    leg:Math.sin(phase)*.025*w,
    kneeLeft:Math.max(0,Math.sin(phase))*.035*w,
    kneeRight:Math.max(0,-Math.sin(phase))*.035*w,
    bodyY:-1.8*(1-Math.cos(phase*2))*.5*w,
    wing:Math.sin(phase*.5)*.006*w,
    petal:Math.sin(phase-.5)*.004*w,
  };
}
export function smoothTravel(t:number) {
  const p=Math.max(0,Math.min(1,t));
  return p*p*p*(p*(p*6-15)+10);
}
