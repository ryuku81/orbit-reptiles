import * as THREE from 'three';

// Pixel correspondences on the two 1536 × 1024 portraits. Each profile follows
// crown → eye → upper lip → lower lip; the mouth interior expands between lips.
// Ordered columns and rows keep the mesh connected throughout the articulation.
const columns = [
  [0, 0], [230, 230], [340, 310],
  [380, 350, [235, 270, 317, 326], [174, 199, 220, 406]],
  [413, 400, [178, 253, 328, 338], [150, 201, 237, 431]],
  [456, 451, [155, 255, 311, 321], [150, 202, 251, 421]],
  [490, 490, [151, 257, 298, 308], [150, 201, 259, 380]],
  [535, 535, [153, 239, 272, 282], [153, 215, 257, 310]],
  [578, 578, [168, 215, 238, 248], [168, 215, 238, 248]],
  [640, 640, [180, 220, 263, 273], [180, 220, 263, 273]],
  [750, 750], [1100, 1100], [1536, 1536],
];

function rows(profile = [150, 250, 318, 330]) {
  const [crown, eye, upper, lower] = profile;
  return [0, 95, crown, eye - Math.min(15, (eye - crown) * .4), eye,
    eye + Math.min(15, (upper - eye) * .35), upper, lower, lower + 8,
    465, 520, 768, 1024];
}

export function createSerpentPortraitGeometry() {
  const rest = [], strike = [], positions = [], bands = [], indices = [];
  const count = 13;
  for (const [x, openX, closed, opened] of columns) {
    const from = rows(closed), to = rows(opened);
    for (let row = 0; row < count; row++) {
      const moves = row >= 2 && row <= 8;
      const u = x / 1536, v = 1 - from[row] / 1024;
      rest.push(u, v); bands.push(row);
      strike.push((moves ? openX : x) / 1536, 1 - to[row] / 1024);
      positions.push(u * 2 - 1, v * 2 - 1, 0);
    }
  }
  for (let col = 0; col < columns.length - 1; col++) {
    for (let row = 0; row < count - 1; row++) {
      const a = col * count + row, b = a + count;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  // Subdivide the existing triangles without changing their UV correspondence.
  // The extra vertices let the body breathe smoothly while retaining the jaw rig.
  const dense = { position: [], uv: [], strikeUv: [], anatomicalBand: [] };
  const attributes = [[positions, 3, dense.position], [rest, 2, dense.uv], [strike, 2, dense.strikeUv], [bands, 1, dense.anatomicalBand]];
  const divisions = 6;
  for (let face = 0; face < indices.length; face += 3) {
    const corners = indices.slice(face, face + 3);
    const vertex = (u, v) => {
      const weights = [1 - u / divisions - v / divisions, u / divisions, v / divisions];
      for (const [source, size, target] of attributes) {
        for (let axis = 0; axis < size; axis++) target.push(corners.reduce((sum, corner, i) => sum + source[corner * size + axis] * weights[i], 0));
      }
    };
    for (let u = 0; u < divisions; u++) for (let v = 0; v < divisions - u; v++) {
      vertex(u, v); vertex(u + 1, v); vertex(u, v + 1);
      if (u + v < divisions - 1) { vertex(u + 1, v); vertex(u + 1, v + 1); vertex(u, v + 1); }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(dense.position, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(dense.uv, 2));
  geometry.setAttribute('strikeUv', new THREE.Float32BufferAttribute(dense.strikeUv, 2));
  geometry.setAttribute('anatomicalBand', new THREE.Float32BufferAttribute(dense.anatomicalBand, 1));
  return geometry;
}

export const serpentPortraitVertex = `
attribute vec2 strikeUv;
attribute float anatomicalBand;
uniform float opening;
uniform float time;
uniform float vitality;
varying vec2 vRest;
varying vec2 vStrike;
varying vec2 vScreen;
varying float vBand;
float influence(vec2 uv,vec2 center,vec2 radius){
  vec2 p=(uv-center)/radius;
  return exp(-dot(p,p)*2.);
}
vec2 livingPose(vec2 uv){
  float alive=vitality*(1.-.78*smoothstep(.05,1.,opening));
  float breath=sin(time*1.25)+.17*sin(time*2.5+.8);
  vec2 movement=vec2(0.);
  vec2 chest=uv-vec2(.57,.65);
  float flank=influence(uv,vec2(.57,.65),vec2(.27,.15));
  movement+=chest*vec2(.035,.060)*breath*flank;
  float crown=influence(uv,vec2(.65,.83),vec2(.18,.16));
  movement+=(uv-vec2(.65,.83))*.040*sin(time*1.25-.38)*crown;
  float lower=influence(uv,vec2(.62,.20),vec2(.27,.19));
  movement.y+=.0065*sin(time*1.25-.9)*lower;
  movement.x+=.0035*sin(time*.77+uv.y*5.)*lower;

  float head=influence(uv,vec2(.32,.755),vec2(.15,.13));
  vec2 neck=uv-vec2(.414,.787);
  float angle=.040*sin(time*.64)+.012*sin(time*1.31);
  mat2 turn=mat2(cos(angle),sin(angle),-sin(angle),cos(angle));
  movement+=(turn*neck-neck)*head;
  movement+=vec2(.0055*sin(time*.81),.0065*sin(time*.67))*head;
  float throat=influence(uv,vec2(.348,.716),vec2(.08,.055));
  movement.y-=.0035*breath*throat;

  float tail=influence(uv,vec2(.23,.22),vec2(.18,.24));
  movement+=vec2(.009*sin(time*.94+uv.y*7.),.004*sin(time*.72+uv.x*6.))*tail;
  // Leave the central planet and its glow fixed in the surrounding space.
  float planet=smoothstep(.9,1.4,length((uv-vec2(.509,.419))/vec2(.105,.145)));
  return uv+movement*alive*planet;
}
void main(){
  vRest=uv;
  vBand=anatomicalBand;
  vStrike=strikeUv;
  vScreen=mix(uv,strikeUv,opening);
  gl_Position=vec4(livingPose(vScreen)*2.-1.,0.,1.);
}`;

export const serpentPortraitFragment = `
uniform sampler2D artwork;
uniform sampler2D strikeArtwork;
uniform float opening;
uniform float time;
uniform float vitality;
varying vec2 vRest;
varying vec2 vStrike;
varying vec2 vScreen;
varying float vBand;
vec2 eyeGaze(vec2 uv,vec2 center,vec2 radius){
  vec2 e=(uv-center)/radius;
  float iris=1.-smoothstep(.45,.90,length(e));
  vec2 look=vec2(sin(time*.45),sin(time*.61+.3))*.14;
  return uv-look*radius*iris*vitality*(1.-.6*opening);
}
void main(){
  // The original body, planet and background never pass through the head warp.
  vec3 background=texture2D(artwork,vScreen).rgb;
  vec3 closed=texture2D(artwork,eyeGaze(vRest,vec2(.319,.750),vec2(.0105,.0183))).rgb;
  vec3 opened=texture2D(strikeArtwork,eyeGaze(vStrike,vec2(.319,.804),vec2(.012,.023))).rgb;
  vec2 px=vec2(vScreen.x,1.-vScreen.y)*vec2(1536.,1024.);
  float head=smoothstep(285.,335.,px.x)*(1.-smoothstep(600.,690.,px.x));
  head*=smoothstep(115.,146.,px.y)*(1.-smoothstep(7.05,8.,vBand));
  // Reveal the mouth first, then change the outer skin over a short interval.
  // The remaining opening is carried by the connected jaw geometry.
  float interior=smoothstep(5.9,6.15,vBand)*(1.-smoothstep(6.85,7.15,vBand));
  vec2 sourcePx=vec2(vStrike.x,1.-vStrike.y)*vec2(1536.,1024.);
  float mouthLeft=340.+55.*smoothstep(230.,290.,sourcePx.y)+8.*smoothstep(290.,330.,sourcePx.y);
  interior*=smoothstep(mouthLeft-4.,mouthLeft+4.,sourcePx.x)*(1.-smoothstep(520.,565.,sourcePx.x));
  float textureBlend=mix(smoothstep(.075,.18,opening),smoothstep(0.,.06,opening),interior);
  vec3 portrait=mix(closed,opened,textureBlend);
  vec3 color=mix(background,portrait,head);
  vec2 edge=min(vScreen,1.-vScreen);
  float nebulaEdge=smoothstep(0.,.24,edge.x)*smoothstep(0.,.24,edge.y);
  float scaleEdge=smoothstep(0.,.02,edge.x)*smoothstep(0.,.02,edge.y);
  float luminosity=dot(color,vec3(.2126,.7152,.0722));
  float alpha=mix(nebulaEdge,scaleEdge,smoothstep(.16,.46,luminosity));
  gl_FragColor=vec4(color*alpha,alpha);
}`;
