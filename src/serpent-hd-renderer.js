const ROOT = '/images/serpent-hd';
const vertexSource = `attribute vec2 position;
varying vec2 uv;
void main(){ uv=vec2((position.x+1.)*.5,(1.-position.y)*.5); gl_Position=vec4(position,0.,1.); }`;
const fragmentSource = `precision highp float;
varying vec2 uv;
uniform sampler2D poseA,poseB,flowA,flowB;
uniform float progress;
vec2 decode(vec4 p){return vec2(p.r*65280.+p.g*255.,p.b*65280.+p.a*255.)/65535.-.5;}
void main(){
 float t=progress;
 vec2 a=uv,b=uv;
 // Inverse-map each key pose to the same intermediate geometry.
 for(int i=0;i<3;i++){
  a=uv-t*decode(texture2D(flowA,clamp(a,0.,1.)));
  b=uv-(1.-t)*decode(texture2D(flowB,clamp(b,0.,1.)));
 }
 vec3 ca=texture2D(poseA,clamp(a,0.,1.)).rgb;
 vec3 cb=texture2D(poseB,clamp(b,0.,1.)).rgb;
 vec3 color=mix(ca,cb,smoothstep(0.,1.,t));
 // Broad, rounded falloff removes the image rectangle while the central face stays opaque.
 vec2 d=abs(uv-.5)*2.;
 float radius=pow(pow(d.x,4.)+pow(d.y,4.),.25);
 float alpha=1.-smoothstep(.62,1.,radius);
 gl_FragColor=vec4(color,alpha);
}`;

export async function createSerpentRenderer(canvas, signal) {
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:false,depth:false,stencil:false,preserveDrawingBuffer:false});
 if(!gl)throw new Error('WebGL unavailable');
 const textures=[],shaders=[];let program,buffer,destroyed=false;
 const destroy=()=>{if(destroyed)return;destroyed=true;for(const t of textures)gl.deleteTexture(t);for(const s of shaders)gl.deleteShader(s);if(program)gl.deleteProgram(program);if(buffer)gl.deleteBuffer(buffer);};
 signal.addEventListener('abort',destroy,{once:true});
 try {
  function shader(type,source){const s=gl.createShader(type);shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
  program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertexSource));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragmentSource));gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
  const location=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,2,gl.FLOAT,false,0,0);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  const tasks=[];const poses=[],forward=[],backward=[];
  for(let i=0;i<12;i++)tasks.push({name:`pose-${String(i).padStart(2,'0')}.webp`,target:poses,index:i});
  for(let i=0;i<11;i++)for(const [name,target] of [['forward',forward],['backward',backward]])tasks.push({name:`${name}-${String(i).padStart(2,'0')}.png`,target,index:i});
  async function worker(){while(tasks.length){signal.throwIfAborted();if(destroyed)throw Error('Renderer disposed');const task=tasks.shift();const response=await fetch(`${ROOT}/${task.name}`,{signal});if(!response.ok)throw Error(`Missing ${task.name}`);const bitmap=await createImageBitmap(await response.blob(),{premultiplyAlpha:'none',colorSpaceConversion:'none'});if(signal.aborted||destroyed){bitmap.close();throw Error('Renderer disposed');}
   const texture=gl.createTexture();textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,bitmap);bitmap.close();task.target[task.index]=texture;
  }}
  await Promise.all(Array.from({length:4},worker));signal.throwIfAborted();
  const slots=['poseA','poseB','flowA','flowB'].map(n=>gl.getUniformLocation(program,n));const progress=gl.getUniformLocation(program,'progress');
  return {draw(position){if(destroyed||gl.isContextLost())return;const pair=Math.min(10,Math.floor(position)),t=Math.max(0,Math.min(1,position-pair));gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
   [poses[pair],poses[pair+1],forward[pair],backward[pair]].forEach((texture,i)=>{gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(slots[i],i);});
   gl.uniform1f(progress,t);gl.drawArrays(gl.TRIANGLES,0,6);
  },destroy};
 }catch(error){destroy();throw error;}
}
