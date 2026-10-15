import * as THREE from 'three';
export const MAX_CRATERS = 12;
const vertexShader = `
uniform mat4 uWorldToPearl;
varying vec3 vPearl, vView, vNormal;
void main(){
 vec4 mv=modelViewMatrix*vec4(position,1.0);
 vPearl=(uWorldToPearl*modelMatrix*vec4(position,1.0)).xyz;
 vView=mv.xyz; vNormal=normalize(normalMatrix*normal);
 gl_Position=projectionMatrix*mv;
}`;
export const fragmentShader = `
uniform vec4 uCraters[12];uniform vec3 uCraterNormals[12];
uniform float uDepth,uIridescence,uRim,uCraterCount,uTime,uOpacity;
uniform mat3 uViewToPearl;
varying vec3 vPearl,vView,vNormal;
vec3 rainbow(float t){return .5+.5*cos(6.2831853*(t+vec3(0.,.33,.67)));}
float relief(vec3 p){
 float h=0.;
 for(int i=0;i<12;i++){
  if(float(i)>=uCraterCount) break;
  vec4 c=uCraters[i];
  vec3 axis=normalize(uCraterNormals[i]),tangent=normalize(cross(abs(axis.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.),axis));
  vec3 bitangent=cross(axis,tangent),offset=p-c.xyz;
  vec2 q=vec2(dot(offset,tangent),dot(offset,bitangent))/c.w;
  float radial=length(q),a=atan(q.y,q.x),seed=float(i)*1.73;
  // Limit a crater to its local surface; tangent projection alone repeats on the far side.
  float cap=1.-smoothstep(c.w*.35,c.w*.85,abs(dot(offset,axis)));
  float d=radial;
  float rim=exp(-pow((d-.94)*7.5,2.));
  float bowl=1.-smoothstep(.42,.92,d);
  h+=cap*c.w*(.045*rim-.24*bowl);
 }
 return h*uDepth;
}
void main(){
 vec3 n=length(vNormal)>.001?normalize(vNormal):normalize(cross(dFdx(vView),dFdy(vView))); if(!gl_FrontFacing)n=-n;
 float h=relief(vPearl);
 // Screen-space surface gradient: works without UVs on arbitrary surfaces.
 vec3 px=dFdx(vView),py=dFdy(vView);
 vec3 r1=cross(py,n),r2=cross(n,px);
 float det=dot(px,r1);
 vec3 grad=(r1*dFdx(h)+r2*dFdy(h));
 n=normalize(abs(det)*n-sign(det)*grad*.65);
 vec3 V=normalize(-vView);
 float facing=max(dot(n,V),0.);
 float fres=pow(1.-facing,2.7);
 vec3 L=normalize(vec3(-.55,.75,1.2));
 float diffuse=max(dot(n,L),0.);
 vec3 localV=normalize(uViewToPearl*V);
 float film=(1.-facing)*1.55+dot(normalize(uViewToPearl*n),vec3(.16,.25,.12))+.12*dot(localV,vec3(.5,.3,.2));
 vec3 spectral=rainbow(film);
 float aa=max(fwidth(diffuse)*1.5,.065);
 float mid=smoothstep(.28-aa,.28+aa,diffuse),lit=smoothstep(.72-aa,.72+aa,diffuse);
 vec3 col=mix(vec3(.44,.49,.57),vec3(.72,.76,.75),mid);
 col=mix(col,vec3(.91,.92,.84),lit);
 float reflection=pow(max(dot(n,normalize(L+V)),0.),10.);float filmMask=(.32*reflection+.55*fres);col+=(spectral-.5)*uIridescence*filmMask;
 // Two broad studio reflections, no environment texture or transmission pass.
 vec3 H=normalize(L+V);
 float highlight=dot(n,H);
 float ha=max(fwidth(highlight)*1.5,.009);
 col+=vec3(1.,.98,.91)*smoothstep(.97-ha,.97+ha,highlight)*.14;
 col+=mix(vec3(.93,.97,1.),spectral,.40)*pow(1.-facing,3.)*uRim*.50;
 // Clean graphic bowl fill and a single rim, independent of toon band thresholds.
 for(int i=0;i<12;i++){if(float(i)>=uCraterCount)break;vec4 c=uCraters[i];vec3 axis=normalize(uCraterNormals[i]),offset=vPearl-c.xyz;float axial=dot(offset,axis);float d=length(offset-axis*axial)/c.w;float cap=1.-smoothstep(c.w*.35,c.w*.85,abs(axial));float edge=max(fwidth(d)*1.5,.025);float bowl=(1.-smoothstep(.77-edge,.77+edge,d))*cap;float ring=(smoothstep(.79-edge,.79+edge,d)-smoothstep(1.02-edge,1.02+edge,d))*cap;col=mix(col,col*vec3(.75,.80,.85),bowl*min(uDepth,1.));col+=vec3(.08,.08,.065)*ring*min(uDepth,1.);}
 col+=h*.25;
 gl_FragColor=vec4(max(col,vec3(0.)),mix(uOpacity,1.,fres*.8));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function createPearlMaterial(options={}){
 const craters=Array.from({length:MAX_CRATERS},()=>new THREE.Vector4(0,0,0,.1));
 const presets=[[-.36,.38,.851,.31],[.43,.02,.902,.205],[-.08,-.83,.54,.115],[-.72,-.18,.66,.075],[.62,.61,.48,.07],[-.42,.30,-.85,.19],[.55,-.45,-.70,.23],[.2,.86,-.43,.13],[-.9,-.2,-.38,.10],[.91,.08,-.41,.08],[-.1,-.65,-.76,.11],[.6,.2,.78,.065]];
 presets.forEach((p,i)=>craters[i].set(...p));
 const material=new THREE.ShaderMaterial({vertexShader,fragmentShader,side:THREE.FrontSide,transparent:true,forceSinglePass:true,depthWrite:false,uniforms:{uWorldToPearl:{value:new THREE.Matrix4()},uCraters:{value:craters},uCraterNormals:{value:craters.map(c=>new THREE.Vector3(c.x,c.y,c.z).normalize())},uViewToPearl:{value:new THREE.Matrix3()},uTime:{value:0},uOpacity:{value:options.opacity??.82},uDepth:{value:options.depth??.60},uIridescence:{value:options.iridescence??1.43},uRim:{value:options.rim??.7},uCraterCount:{value:options.craterCount??2}}});
 return material;
}
// Bounds are measured once. Update the root inverse when its transform changes.
// No modification of vertices, indices or UVs; shares one material across meshes.
export function applyPearl(root,material=createPearlMaterial()){
 root.updateWorldMatrix(true,true);
 const box=new THREE.Box3().setFromObject(root);
 if(box.isEmpty())throw new Error('Model has no mesh bounds');
 const center=box.getCenter(new THREE.Vector3());
 const size=box.getSize(new THREE.Vector3());
 const radius=Math.max(size.x,size.y,size.z)/2;
 if(!Number.isFinite(radius)||radius<1e-8)throw new Error('Model bounds are degenerate');
 const localCenter=root.worldToLocal(center.clone());
 const scale=root.getWorldScale(new THREE.Vector3());
 const normalize=new THREE.Matrix4().makeScale(scale.x/radius,scale.y/radius,scale.z/radius).multiply(new THREE.Matrix4().makeTranslation(-localCenter.x,-localCenter.y,-localCenter.z));
 const inverse=new THREE.Matrix4();
 const previous=[];
 root.traverse(o=>{if(o.isMesh){previous.push([o,o.material]);o.material=material;}});
 if(!previous.length)throw new Error('No meshes in model');
 function update(){root.updateWorldMatrix(true,false);inverse.copy(root.matrixWorld).invert();material.uniforms.uWorldToPearl.value.copy(normalize).multiply(inverse);}
 update();
 return {material,update,restore(){previous.forEach(([o,m])=>o.material=m);}};
}
