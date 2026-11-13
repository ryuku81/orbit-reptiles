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
  const rest = [], strike = [], positions = [], indices = [];
  const count = 13;
  for (const [x, openX, closed, opened] of columns) {
    const from = rows(closed), to = rows(opened);
    for (let row = 0; row < count; row++) {
      const moves = row >= 2 && row <= 8;
      const u = x / 1536, v = 1 - from[row] / 1024;
      rest.push(u, v);
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
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(rest, 2));
  geometry.setAttribute('strikeUv', new THREE.Float32BufferAttribute(strike, 2));
  geometry.setIndex(indices);
  return geometry;
}

export const serpentPortraitVertex = `
attribute vec2 strikeUv;
uniform float opening;
varying vec2 vRest;
varying vec2 vStrike;
varying vec2 vScreen;
void main(){
  vRest=uv;
  vStrike=strikeUv;
  vScreen=mix(uv,strikeUv,opening);
  gl_Position=vec4(vScreen*2.-1.,0.,1.);
}`;

export const serpentPortraitFragment = `
uniform sampler2D artwork;
uniform sampler2D strikeArtwork;
uniform float opening;
varying vec2 vRest;
varying vec2 vStrike;
varying vec2 vScreen;
void main(){
  // The original body, planet and background never pass through the head warp.
  vec3 background=texture2D(artwork,vScreen).rgb;
  vec3 closed=texture2D(artwork,vRest).rgb;
  vec3 opened=texture2D(strikeArtwork,vStrike).rgb;
  vec2 px=vec2(vScreen.x,1.-vScreen.y)*vec2(1536.,1024.);
  float head=smoothstep(285.,335.,px.x)*(1.-smoothstep(600.,690.,px.x));
  head*=smoothstep(115.,146.,px.y)*(1.-smoothstep(445.,478.,px.y));
  // Reveal the mouth texture while it is still narrow. Subsequent movement is
  // geometry articulation, so there are no two overlapping eyes or jaws.
  float textureBlend=smoothstep(0.,.075,opening);
  vec3 portrait=mix(closed,opened,textureBlend);
  vec3 color=mix(background,portrait,head);
  vec2 edge=min(vScreen,1.-vScreen);
  float nebulaEdge=smoothstep(0.,.24,edge.x)*smoothstep(0.,.24,edge.y);
  float scaleEdge=smoothstep(0.,.02,edge.x)*smoothstep(0.,.02,edge.y);
  float luminosity=dot(color,vec3(.2126,.7152,.0722));
  float alpha=mix(nebulaEdge,scaleEdge,smoothstep(.16,.46,luminosity));
  gl_FragColor=vec4(color*alpha,alpha);
}`;
