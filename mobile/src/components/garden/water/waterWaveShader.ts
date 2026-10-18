// World-space sampling deformation shared by the mineral floor and submerged
// stones. Callers keep bank masks and all opaque geometry at their original p.
// These functions return sampling offsets, never object-position changes.
export const WATER_WAVE_SKSL = `
float wwHash(float2 p) {
  float3 q=fract(float3(p.x,p.y,p.x)*0.1031);
  q+=dot(q,q.yzx+33.33);
  return fract((q.x+q.y)*q.z);
}
float wwNoise(float2 p) {
  float2 i=floor(p),f=fract(p);
  f=f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(wwHash(i),wwHash(i+float2(1,0)),f.x),
    mix(wwHash(i+float2(0,1)),wwHash(i+float2(1,1)),f.x),f.y);
}
float4 wwPhases(float2 p,float t) {
  // Bounded domain breathing prevents either field from scrolling as a sheet.
  // The two coarse fields bend wave fronts without exposing their noise cells.
  float a=wwNoise(p/390.0+float2(4.1,7.2)+
    float2(sin(t*0.19),cos(t*0.17))*0.18)-0.5;
  float b=wwNoise(p/275.0+float2(13.7,3.8)+
    float2(cos(t*0.23),sin(t*0.21))*0.16)-0.5;
  return float4(
    dot(p,float2(0.014,0.006))+a*4.5+b*0.7-t*0.67,
    dot(p,float2(-0.008,0.018))+b*4.0-a*0.6+t*0.83+2.3,
    dot(p,float2(0.049,-0.041))+a*5.0+b*2.0+t*1.19+4.7,
    dot(p,float2(0.031,0.057))+b*5.5-a*1.8-t*1.61+1.1
  );
}
float2 waterRefraction(float2 p,float t) {
  float4 phase=wwPhases(p,t);
  // Three displacement scales, without changing the approved light field.
  // Large: very soft 11/13-second breathing, roughly 430-530 screen px wide.
  float2 broadPhase=float2((phase.x+t*0.67)*0.32-t*0.483,
                           (phase.y-t*0.83-2.3)*0.30+t*0.571+1.4);
  float2 broad=float2(0.919145,0.393919)*sin(broadPhase.x)*1.0+
    float2(-0.406138,0.913812)*sin(broadPhase.y)*0.7;
  // Medium: the original readable 130-170 px shapes now evolve in 6.3/7 s.
  // Bounded local phase breathing avoids unbounded time-dependent UV shear.
  float2 mediumPhase=phase.xy+float2(-t*0.33,t*0.067)+
    float2(sin(t*0.31+phase.y-t*0.83),sin(t*0.27+phase.x+t*0.67))*0.16;
  // Favor the existing lotus, entrance and right-side pools, without changing
  // their floor visibility. Gain is 20-30%, centered on the requested 25%.
  float2 a=(p-float2(400,1500))/float2(600,300);
  float2 b=(p-float2(1530,1660))/float2(440,290);
  float2 c=(p-float2(2390,1120))/float2(420,590);
  float2 d=(p-float2(2140,220))/float2(440,300);
  float priority=1.0-smoothstep(0.10,1.0,min(min(dot(a,a),dot(b,b)),min(dot(c,c),dot(d,d))));
  float mediumGain=mix(1.20,1.30,priority);
  float2 medium=(float2(0.919145,0.393919)*sin(mediumPhase.x)*3.2+
    float2(-0.406138,0.913812)*sin(mediumPhase.y)*2.6)*mediumGain;
  // Small: faint 2.7/3.3-second irregularity, never the dominant motion.
  float2 fine=float2(0.766973,-0.641753)*sin(phase.z+t*0.70)*0.45+
    float2(0.477747,0.878497)*sin(phase.w-t*0.74)*0.30;
  float2 offset=broad+medium+fine;
  // Only receiving water near the existing waterfall gains extra undulation.
  // The actual waterfall structure, opacity and object placement stay outside.
  float2 impact=p-float2(1060.0,185.0);
  float2 ellipse=impact/float2(165.0,190.0);
  float influence=exp(-dot(ellipse,ellipse)*1.6);
  float2 radial=impact/max(length(impact),1.0);
  float ripple=sin(length(impact*float2(1.0,1.18))*0.064-
    t*1.73+sin(phase.z)*0.7);
  offset+=(radial*ripple*1.9+
    float2(sin(phase.w+0.8),cos(phase.z-1.2))*0.65)*influence;
  // Strict maximum includes the impact contribution: 9.4 world px corresponds
  // to 3.84 px at the normal 0.4089 Garden fit. No discontinuous phase resets.
  return offset*min(1.0,9.4/max(length(offset),0.001));
}
float waterWaveLight(float2 p,float t) {
  float4 phase=wwPhases(p,t);
  // Signed, bounded normal response of the same surface. Use at low gain;
  // do not threshold this into crests or add white contour/caustic lines.
  // Broad waves move the floor, but contribute little direct illumination.
  // The secondary normal response is softly interrupted by the broad field,
  // so visible wavelets have quiet gaps rather than continuous bright crests.
  float exposure=smoothstep(0.40,0.73,wwNoise(p/180.0+float2(22.9,8.1)));
  return cos(phase.x)*0.025+cos(phase.y)*0.020+
    (cos(phase.z)*0.52+cos(phase.w)*0.38)*exposure;
}
`;
