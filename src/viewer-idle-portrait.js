import * as THREE from 'three';

// Viewer API captures stay in memory. Manual interaction immediately reveals
// the original live 3D viewer; no creator geometry or textures are downloaded.
const profiles={
 lg:{eyes:[[-6.929252,-4.969295,.403906],[-6.366191,-6.012902,.416542]],radius:[.020,.032],body:[.48,.58],extent:[.26,.16]},
 bd:{eyes:[[.598230624,6.863002048,.685937171]],radius:[.010,.014],body:[.57,.57],extent:[.19,.16]},
};
const fragment=`
uniform sampler2D portrait;uniform float time;uniform float blink;
uniform vec2 eyes[2];uniform vec2 radius[2];uniform vec2 body;uniform vec2 extent;
varying vec2 vUv;
vec3 sampleAt(vec2 p){return texture2D(portrait,clamp(p,.001,.999)).rgb;}
void main(){
 vec2 p=vUv;vec2 d=(p-body)/extent;float torso=exp(-dot(d,d)*2.);
 float breath=sin(time*1.45)+.15*sin(time*2.9+.7);
 p.y-=(p.y-body.y)*torso*breath*.045;
 p.x-=(p.x-body.x)*torso*breath*.016;
 vec3 color=sampleAt(p);
 for(int i=0;i<2;i++){
  vec2 e=(p-eyes[i])/radius[i];float shape=1.-smoothstep(.88,1.03,length(e));
  float edge=sqrt(max(0.,1.-e.x*e.x));float aperture=(1.-blink)*edge;
  float covered=smoothstep(aperture-.035,aperture+.035,abs(e.y))*shape*smoothstep(.015,.10,blink);
  vec2 lid=p;lid.y=eyes[i].y+(e.y<0.?-1.:1.)*radius[i].y*(1.12+(abs(e.y)-aperture)*.12);
  color=mix(color,sampleAt(lid)*(.94+.06*abs(e.y)),covered);
  color*=1.-exp(-pow(e.y*42.,2.))*blink*shape*.22;
 }
 gl_FragColor=vec4(color,1.);
}`;
export function supportsIdlePortrait(id){return Boolean(profiles[id]);}
export function createIdlePortrait(api,host,model){
 const profile=profiles[model.id];let renderer=null,material=null,geometry=null,texture=null,scene=null,camera=null;
 let enabled=true,active=false,pending=false,generation=0,lastRender=0;
 const uniforms={portrait:{value:null},time:{value:0},blink:{value:0},eyes:{value:[new THREE.Vector2(-5,-5),new THREE.Vector2(-5,-5)]},radius:{value:[new THREE.Vector2(),new THREE.Vector2()]},body:{value:new THREE.Vector2()},extent:{value:new THREE.Vector2()}};
 const invalidate=(manual=false)=>{generation++;pending=false;active=false;if(manual)enabled=false;if(renderer)renderer.domElement.style.opacity='0';host.dataset.idlePortrait='false';};
 const project=point=>new Promise(resolve=>api.getWorldToScreenCoordinates(point,coords=>resolve(coords.canvasCoord)));
 return {
  get enabled(){return enabled;},get active(){return active;},
  invalidate,reset(){enabled=true;invalidate();},
  async capture(){
   if(!enabled||active||pending)return;pending=true;const token=generation;
   const width=host.clientWidth,height=host.clientHeight,aspect=width/height;
   const pixelRatio=Math.min(devicePixelRatio||1,1.5),fit=Math.max(1,1.35/aspect)*(model.framingScale||1);
   try{
    const locations=await Promise.all(profile.eyes.map(project));
    const data=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Portrait capture timed out')),7000);api.getScreenShot(Math.round(width*pixelRatio),Math.round(height*pixelRatio),'image/png',(error,result)=>{clearTimeout(timer);error?reject(error):resolve(result)})});
    const next=await new THREE.TextureLoader().loadAsync(data);
    if(token!==generation||!enabled){next.dispose();return;}
    if(!renderer){
     renderer=new THREE.WebGLRenderer({alpha:false,antialias:false,powerPreference:'low-power'});renderer.outputColorSpace=THREE.LinearSRGBColorSpace;
     renderer.domElement.className='official-idle-portrait';renderer.domElement.setAttribute('aria-hidden','true');host.appendChild(renderer.domElement);
     material=new THREE.ShaderMaterial({uniforms,fragmentShader:fragment,vertexShader:'varying vec2 vUv;void main(){vUv=position.xy*.5+.5;gl_Position=vec4(position.xy,0.,1.);}',depthTest:false});
     geometry=new THREE.PlaneGeometry(2,2);scene=new THREE.Scene();camera=new THREE.Camera();scene.add(new THREE.Mesh(geometry,material));
    }
    renderer.setSize(width*pixelRatio,height*pixelRatio,false);texture?.dispose();texture=next;uniforms.portrait.value=texture;
    locations.forEach((p,i)=>uniforms.eyes.value[i].set(p[0]/width,1-p[1]/height));
    uniforms.radius.value[0].set(profile.radius[0]*(1400/900)/aspect/fit,profile.radius[1]/fit);
    uniforms.radius.value[1].copy(uniforms.radius.value[0]).multiply(new THREE.Vector2(.45,.75));
    uniforms.body.value.set(.5+(profile.body[0]-.5)*(1400/900)/aspect/fit,1-(.5+(profile.body[1]-.5)/fit));
    uniforms.extent.value.set(profile.extent[0]*(1400/900)/aspect/fit,profile.extent[1]/fit);
    active=true;host.dataset.idlePortrait='true';host.dataset.motion='portrait-blink-breath';renderer.render(scene,camera);renderer.domElement.style.opacity='1';
   }catch{if(token===generation)enabled=false;}finally{if(token===generation)pending=false;}
  },
  render(time,now){
   if(!active||now-lastRender<1000/30)return;lastRender=now;
   const phase=(time+(model.id==='bd'?2.8:0))%7.7;
   const smooth=(a,b,v)=>THREE.MathUtils.smoothstep(v,a,b);
   const blink=smooth(2.0,2.11,phase)*(1-smooth(2.17,2.38,phase));
   uniforms.time.value=time;uniforms.blink.value=blink;renderer.render(scene,camera);host.dataset.blink=blink.toFixed(3);
  },
  dispose(){enabled=false;invalidate();texture?.dispose();material?.dispose();geometry?.dispose();if(renderer){renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();}},
 };
}
