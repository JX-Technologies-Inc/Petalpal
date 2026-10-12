export function teaSipPhase(seconds:number){
 'worklet';
 const t=Math.max(0,seconds)%8.8;
 const ease=(v:number)=>{const c=Math.max(0,Math.min(1,v));return c*c*(3-2*c);};
 return t<2?0:t<3.8?ease((t-2)/1.8):t<5.7?1:t<7.6?1-ease((t-5.7)/1.9):0;
}
