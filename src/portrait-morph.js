import * as THREE from 'three';

// Each column follows the same anatomical bands in both keyframes: crown,
// eyelids, upper lip, lower lip and chin. A connected grid keeps the mouth
// interior separate from the skin and background throughout the opening.
// [rest x, open x, rest crown/eye/upper lip/lower lip, open equivalents]
const columns = [
  [0,0], [230,230], [340,310],
  [380,350,[180,250,317,326],[152,199,220,406]],
  [413,400,[165,253,328,338],[150,201,237,431]],
  [456,451,[155,255,311,321],[150,202,251,421]],
  [490,490,[151,257,298,308],[150,201,259,380]],
  [535,535,[153,239,272,282],[153,215,257,310]],
  [578,578,[168,215,238,248],[168,215,238,248]],
  [640,640,[180,220,263,273],[180,220,263,273]],
  [750,750], [1100,1100], [1536,1536],
];

export function createPortraitMorphGeometry() {
  const rest=[],open=[],indices=[];
  const rows = profile => {
    const [crown,eye,upper,lower]=profile ?? [150,250,318,330];
    return [0,95,crown,eye-Math.min(15,(eye-crown)*.4),eye,
      eye+Math.min(15,(upper-eye)*.35),upper,lower,lower+8,465,520,768,1024];
  };
  const rowCount=13;
  for(const [x,ox,closed,opened] of columns){
    const a=rows(closed),b=rows(opened);
    for(let row=0;row<rowCount;row++){
      // Only the head moves sideways. Body, orb and nebula remain registered.
      const weight=row>=2&&row<=8?1:0;
      rest.push(x/1536,1-a[row]/1024);
      open.push((x+(ox-x)*weight)/1536,1-b[row]/1024);
    }
  }
  for(let col=0;col<columns.length-1;col++)for(let row=0;row<rowCount-1;row++){
    const a=col*rowCount+row,b=a+rowCount;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(rest.flatMap((_,i)=>i%2?[]:[rest[i]*2-1,rest[i+1]*2-1,0]),3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(rest,2));
  geometry.setAttribute('strikeUv',new THREE.Float32BufferAttribute(open,2));
  geometry.setIndex(indices);
  return geometry;
}

export const portraitVertexShader=`
attribute vec2 strikeUv;
uniform float voyage;
uniform float strikeReady;
varying vec2 vUv;
varying vec2 vStrikeUv;
void main(){
  vUv=uv;vStrikeUv=strikeUv;
  float opening=smoothstep(.12,.48,voyage)*strikeReady;
  vec2 pose=mix(uv,strikeUv,opening);
  gl_Position=vec4(pose*2.-1.,0.,1.);
}`;
