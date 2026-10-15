import * as THREE from 'three';
// Camera-facing additive quad. Stylized diffraction rays, not simulated caustics.
export function createPearlRays(){
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,uniforms:{uTime:{value:0},uStrength:{value:.28}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`
 varying vec2 vUv;uniform float uTime,uStrength;
 void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);
 float beams=pow(abs(cos(a*3.+.14*sin(uTime*.35))),20.);
 beams+=.35*pow(abs(cos(a*5.-uTime*.025)),38.);
 float envelope=smoothstep(.30,.44,r)*(1.-smoothstep(.46,.99,r));
 float glow=exp(-pow((r-.39)*11.,2.))*.15;
 vec3 color=mix(vec3(.87,.91,1.),.55+.45*cos(6.283185*(r*1.7+a*.15+vec3(0.,.33,.67)+.035*sin(uTime*.4))),.65);
 gl_FragColor=vec4(color,(beams*envelope+glow)*uStrength);
 }`});
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(5.2,5.2),material);mesh.renderOrder=-1;
 return mesh;
}
