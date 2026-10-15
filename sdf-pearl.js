import * as THREE from 'three';
import {createPearlMaterial,fragmentShader} from './pearl-material.js';
export function collectMeshPositions(root){
 root.updateWorldMatrix(true,true);const bounds=new THREE.Box3().setFromObject(root),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),scale=2/Math.max(size.x,size.y,size.z);
 if(!Number.isFinite(scale))throw new Error('Empty or degenerate mesh');
 const chunks=[];let count=0;const p=new THREE.Vector3();
 root.traverse(o=>{if(o.isMesh){if(o.isSkinnedMesh||o.morphTargetInfluences)throw new Error('SDF mode supports static meshes only');const g=o.geometry,a=g.attributes.position,idx=g.index,n=idx?idx.count:a.count;const data=new Float32Array(n*3);for(let i=0;i<n;i++){p.fromBufferAttribute(a,idx?idx.getX(i):i).applyMatrix4(o.matrixWorld).sub(center).multiplyScalar(scale);p.toArray(data,i*3);}chunks.push(data);count+=data.length;}});
 if(count/9>20000)throw new Error('SDF demo limit: 20,000 source triangles');const result=new Float32Array(count);let offset=0;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
}
const bakeCache=new Map();
export function bakeMesh(root,onProgress=()=>{}){
 const positions=collectMeshPositions(root);const bits=new Uint32Array(positions.buffer);let hash=2166136261;for(const v of bits)hash=Math.imul(hash^v,16777619);const key=`${positions.length}:${hash>>>0}`;
 const cached=bakeCache.get(key);if(cached&&cached.positions.every((v,i)=>v===positions[i]))return cached.promise;
 const retained=positions.slice();const worker=new Worker(new URL('./sdf-worker.js',import.meta.url),{type:'module'});
 const promise=new Promise((resolve,reject)=>{worker.onerror=e=>{worker.terminate();reject(new Error(e.message));};worker.onmessage=({data})=>{if(data.progress!==undefined){onProgress(data.progress);return;}worker.terminate();if(data.error)reject(new Error(data.error));else resolve(data);};worker.postMessage({positions,resolution:48,levels:2},[positions.buffer]);});
 bakeCache.set(key,{positions:retained,promise});if(bakeCache.size>6)bakeCache.delete(bakeCache.keys().next().value);promise.catch(()=>bakeCache.delete(key));return promise;
}
// Stable anchors sampled from the actual baked surface, not from a screen-space ring.
export function sampleRayAnchors(bake,returnAll=false){
 const n=bake.resolution,E=bake.extent,f=bake.field,items=[];
 for(let z=1;z<n-1;z++)for(let y=1;y<n-1;y++)for(let x=1;x<n-1;x++){
  const k=x+n*(y+n*z);if(Math.abs(f[k])>E/(n-1)*.65)continue;
  const p=new THREE.Vector3((x/(n-1)*2-1)*E,(y/(n-1)*2-1)*E,(z/(n-1)*2-1)*E);
  const normal=new THREE.Vector3(f[k+1]-f[k-1],f[k+n]-f[k-n],f[k+n*n]-f[k-n*n]).normalize();if(normal.lengthSq()<.5)continue;p.addScaledVector(normal,-f[k]);items.push({p,normal});
 }
 if(!items.length)throw new Error('No surface ray anchors found');
 if(returnAll)return items;
 const chosen=[items.reduce((a,b)=>b.p.x>a.p.x?b:a)];
 while(chosen.length<9){let best=items[0],score=-1;for(const c of items){const d=Math.min(...chosen.map(s=>c.p.distanceToSquared(s.p)));if(d>score){best=c;score=d;}}chosen.push(best);}
 return chosen;
}
export function createSDFPearl(bake){
 const base=createPearlMaterial(),uniforms=base.uniforms;base.dispose();
 const candidates=sampleRayAnchors(bake,true);
 for(let i=0;i<12;i++){
  const target=uniforms.uCraters.value[i];let best=null,score=Infinity;
  for(const c of candidates){const cost=c.p.distanceToSquared(new THREE.Vector3(target.x,target.y,target.z))+.18*(1.-c.normal.z);if(cost<score&&c.normal.z>.25){score=cost;best=c;}}
  if(best){const radius=Math.min(target.w,Math.max(.10,(bake.sourceTriangles<=80?.31:.19)*(i===0?1.:.75)));target.set(best.p.x,best.p.y,best.p.z,radius);uniforms.uCraterNormals.value[i].copy(best.normal);}
 }

 const half=new Uint16Array(bake.field.length);for(let i=0;i<half.length;i++)half[i]=THREE.DataUtils.toHalfFloat(bake.field[i]);const texture=new THREE.Data3DTexture(half,bake.resolution,bake.resolution,bake.resolution);texture.format=THREE.RedFormat;texture.type=THREE.HalfFloatType;texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.unpackAlignment=1;texture.needsUpdate=true;
 const rayCandidates=candidates.filter((_,i)=>i%Math.max(1,Math.floor(candidates.length/250))===0);
 uniforms.uBeamShape={value:Array.from({length:7},()=>new THREE.Vector4())};uniforms.uBeamDirection={value:Array.from({length:7},()=>new THREE.Vector2())};uniforms.uBeamGain={value:Array(7).fill(1)};uniforms.uBeamOptics={value:Array.from({length:7},()=>new THREE.Vector4())};
 uniforms.uBeamLife={value:Array.from({length:7},()=>new THREE.Vector4())};
 uniforms.uRayLight={value:new THREE.Vector3()};
 Object.assign(uniforms,{uField:{value:texture},uExtent:{value:bake.extent},uInvModel:{value:new THREE.Matrix4()},uModelView:{value:new THREE.Matrix4()},uNormalMatrix:{value:new THREE.Matrix3()},uRays:{value:.42}});
 const vertex=`varying vec3 vLocal;void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
 // Reuse exactly the same pearl shading with hit-space inputs instead of mesh interpolants.
 const shading=fragmentShader.slice(fragmentShader.indexOf('vec3 rainbow')).replace('void main(){','vec4 shade(vec3 vPearl,vec3 vView,vec3 vNormal){').replace('gl_FragColor=vec4(max(col,vec3(0.)),mix(uOpacity,1.,fres*.8));','return vec4(max(col,vec3(0.)),mix(uOpacity,1.,fres*.8));').replace('if(!gl_FrontFacing)n=-n;','').replace('#include <tonemapping_fragment>','').replace('#include <colorspace_fragment>','');
 const fragment=`out vec4 outColor;\n#define gl_FragColor outColor\nuniform mat4 projectionMatrix;uniform sampler3D uField;uniform float uExtent,uDepth,uIridescence,uRim,uCraterCount,uTime,uOpacity,uRays;uniform vec4 uCraters[12];uniform vec3 uCraterNormals[12];uniform vec3 uRayLight;uniform vec4 uBeamShape[7];uniform vec2 uBeamDirection[7];uniform float uBeamGain[7];uniform vec4 uBeamOptics[7];uniform vec4 uBeamLife[7];uniform mat4 uInvModel,uModelView;uniform mat3 uNormalMatrix,uViewToPearl;varying vec3 vLocal;
 float field(vec3 p){return texture(uField,clamp(p/(2.*uExtent)*(47./48.)+.5,0.,1.)).r;}
 vec3 fieldNormal(vec3 p){float e=.035;return normalize(vec3(field(p+vec3(e,0.,0.))-field(p-vec3(e,0.,0.)),field(p+vec3(0.,e,0.))-field(p-vec3(0.,e,0.)),field(p+vec3(0.,0.,e))-field(p-vec3(0.,0.,e))));}
 ${shading}
 void main(){
 vec3 ro=(uInvModel*vec4(cameraPosition,1.)).xyz,rd=normalize(vLocal-ro);
 vec3 inv=1./rd,t1=(-vec3(uExtent)-ro)*inv,t2=(vec3(uExtent)-ro)*inv;
 vec3 lo=min(t1,t2),hi=max(t1,t2);float start=max(max(lo.x,lo.y),lo.z),end=min(min(hi.x,hi.y),hi.z);float t=max(start,0.);bool hit=false;vec3 p,bestP=ro+rd*t;float nearest=1e6;
 float angularPixel=max(length(dFdx(rd)),length(dFdy(rd)));float pixelWidth=max(.00035,angularPixel*length(ro));
 for(int i=0;i<100;i++){p=ro+rd*t;float d=field(p);if(d<nearest){nearest=d;bestP=p;}if(d<.00015){hit=true;break;}t+=max(abs(d)*.7,.0002);if(t>end||start>end)break;}
 // Projected optical streaks follow the current silhouette, never fixed mesh anchors.
 vec3 centerView=(uModelView*vec4(0.,0.,0.,1.)).xyz;
 vec3 pixelView=(uModelView*vec4(vLocal,1.)).xyz;
 vec2 q=(pixelView.xy/(-pixelView.z)-centerView.xy/(-centerView.z))*abs(centerView.z);
 float energy=0.;vec3 spectrum=vec3(0.);
 for(int j=0;j<7;j++){
  vec4 beam=uBeamShape[j];float id=float(j);
  vec4 optics=uBeamOptics[j];
  float inward=optics.x;vec2 axis=uBeamDirection[j],delta=q-beam.xy;
  vec4 life=uBeamLife[j];float along=dot(delta,axis),signedSide=delta.x*axis.y-delta.y*axis.x,side=abs(signedSide);
  float outward=beam.z;float distanceFromPeak=along<0.?-along/inward:along/outward;
  float envelope=pow(max(1.-distanceFromPeak,0.),1.6);
  float width=max(beam.w*pow(envelope,.65),pixelWidth*.65);
  float core=exp(-pow(side/width,2.));float bloom=exp(-pow(side/(width*optics.z),2.))*.18;
  float forkOffset=width*(1.4+max(along,0.)*2.5);
  float fork=exp(-pow((signedSide-forkOffset)/max(width*.6,pixelWidth),2.))*life.z*.38;
  float spot=exp(-pow(along/(.065+life.y*.07),2.)-pow(side/(width*2.2),2.))*.40;
  float centerAlpha=smoothstep(.18,.95,length(q)/max(length(beam.xy),.25));
  float brightness=((core+bloom+fork)*envelope+spot)*uBeamGain[j]*centerAlpha*optics.w*life.x;
  vec3 fringe=mix(vec3(.75,.88,1.),vec3(1.,.75,.85),smoothstep(-width,width,signedSide));
  vec3 tint=mix(vec3(1.,.98,.94),mix(rainbow(optics.y+along*.5),fringe,.4),.48);
  energy+=brightness;spectrum+=tint*brightness;
 }
 float rayAlpha=1.-exp(-energy*uRays*4.2);vec3 rayColor=spectrum/max(energy,.00001);float rayT=0.;
 float coverage=hit?1.:1.-smoothstep(0.,pixelWidth,nearest);if(!hit)p=bestP;
 vec4 color=vec4(rayColor,rayAlpha);float depth=1.;
 if(hit||coverage>.001){float e=.065;vec3 n=normalize(vec3(field(p+vec3(e,0.,0.))-field(p-vec3(e,0.,0.)),field(p+vec3(0.,e,0.))-field(p-vec3(0.,e,0.)),field(p+vec3(0.,0.,e))-field(p-vec3(0.,0.,e))));vec3 view=(uModelView*vec4(p,1.)).xyz;vec4 surface=shade(p,view,normalize(uNormalMatrix*n));
 // Trace the first exit behind the front hit; retain front depth.
 if(hit&&uOpacity<.999){
  float backT=t+.008,previousT=t;bool entered=false,exited=false;vec3 backP=p;
  for(int k=0;k<64;k++){
   backP=ro+rd*backT;float sd=field(backP);
   if(sd<-.0002)entered=true;
   if(entered&&sd>=0.){float low=previousT,high=backT;for(int b=0;b<5;b++){float mid=(low+high)*.5;if(field(ro+rd*mid)<0.)low=mid;else high=mid;}backT=(low+high)*.5;backP=ro+rd*backT;exited=true;break;}
   previousT=backT;backT+=max(abs(sd)*.75,.008);if(backT>end)break;
  }
  if(exited){vec3 backN=fieldNormal(backP);vec3 backView=(uModelView*vec4(backP,1.)).xyz;vec4 rear=shade(backP,backView,normalize(uNormalMatrix*(-backN)));
   float facing=max(dot(n,normalize(ro-p)),0.);float transmit=min(.42,(1.-uOpacity)*1.2)*exp(-(backT-t)*.25)*smoothstep(.05,.45,facing);
   surface.rgb=mix(surface.rgb,rear.rgb*.9,transmit);surface.a=mix(surface.a,1.,(1.-uOpacity)*.35);
  }
 }
 float angleGlow=pow(1.-max(dot(n,normalize(ro-p)),0.),3.);surface.rgb+=rainbow(dot(n,normalize(uRayLight))*.35+.2)*angleGlow*uRays*.06;float alpha=surface.a*coverage;bool inFront=rayT<t+.025;float combined=alpha+rayAlpha*(1.-alpha);vec3 rgb=inFront?rayColor*rayAlpha+surface.rgb*alpha*(1.-rayAlpha):surface.rgb*alpha+rayColor*rayAlpha*(1.-alpha);color=vec4(rgb/max(combined,.00001),combined);vec4 clip=projectionMatrix*vec4(view,1.);depth=clip.z/clip.w*.5+.5;}
 if(color.a<.001)discard;gl_FragColor=color;gl_FragDepth=depth;
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`;
 const material=new THREE.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,side:THREE.BackSide,transparent:true,depthWrite:true,glslVersion:THREE.GLSL3});
 // Contains the field box and ray support. 80 actual rasterized triangles, no subdivision.
 const mesh=new THREE.Mesh(new THREE.IcosahedronGeometry(3.2,1),material);mesh.userData.bake={...bake,field:undefined};
 mesh.onBeforeRender=(_r,_s,camera)=>{uniforms.uInvModel.value.copy(mesh.matrixWorld).invert();uniforms.uModelView.value.multiplyMatrices(camera.matrixWorldInverse,mesh.matrixWorld);uniforms.uNormalMatrix.value.getNormalMatrix(uniforms.uModelView.value);uniforms.uViewToPearl.value.setFromMatrix4(uniforms.uModelView.value.clone().invert());
  const light=new THREE.Vector3(-.55,.75,1.2).normalize().transformDirection(uniforms.uInvModel.value);uniforms.uRayLight.value.copy(light);
  const center=new THREE.Vector3().applyMatrix4(uniforms.uModelView.value),eye=camera.getWorldPosition(new THREE.Vector3()).applyMatrix4(uniforms.uInvModel.value).normalize();
  const points=rayCandidates.map(c=>{const v=c.p.clone().applyMatrix4(uniforms.uModelView.value);return {p:new THREE.Vector2(v.x/-v.z* Math.abs(center.z),v.y/-v.z*Math.abs(center.z)),n:c.normal};});
  for(let j=0;j<7;j++){
   const basis=uniforms.uInvModel.value.elements;
   const phase=eye.x*(1.7+j*.19)+eye.y*(2.3-j*.11)+eye.z*(1.1+j*.13)+light.x*.7+light.y*.5+basis[0]*.45+basis[1]*.35;
   const wave=(frequency,shift)=>(.5+.5*Math.sin(phase*frequency+j*2.17+shift));
   const angularWindow=.5+.5*Math.cos(phase*1.25+j*2.39996);
   const ramp=Math.max(0,Math.min(1,(angularWindow-.48)/.44));const visibility=ramp*ramp*(3-2*ramp);
   const broad=wave(.65,1.6),fork=wave(.95,3.7);
   const angle=j*2.39996+.3*Math.sin(j*3.1)+.12*Math.sin(phase*.8+j);
   const axis=new THREE.Vector2(Math.cos(angle),Math.sin(angle));let max=-Infinity;for(const c of points)max=Math.max(max,c.p.dot(axis));
   let sum=0,x=0,y=0,gain=0;for(const c of points){const w=Math.exp((c.p.dot(axis)-max)*95);sum+=w;x+=c.p.x*w;y+=c.p.y*w;gain+=w*(.45+.55*Math.pow(Math.max(0,c.n.dot(light)*.5+.5),2));}
   const offset=.015+.12*wave(.85,1.3);
   uniforms.uBeamShape.value[j].set(x/sum-axis.x*offset,y/sum-axis.y*offset,(.32+.82*wave(1.15,.4))*(1.-broad*.35)*(.5+.8*visibility),(.012+.025*wave(.95,2.1))*(1.+broad*1.15));
   uniforms.uBeamLife.value[j].set(visibility,broad,fork,0);
   uniforms.uBeamOptics.value[j].set(.25+.65*wave(.9,3.4),j*.137+phase*.18,1.8+1.2*wave(.7,4.1),.65+.35*wave(1.05,.8));
   uniforms.uBeamDirection.value[j].copy(axis);uniforms.uBeamGain.value[j]=gain/sum*(.55+.45*wave(.8,5.2));
  }
 };
 mesh.userData.dispose=()=>{texture.dispose();mesh.geometry.dispose();material.dispose();};
 return mesh;
}