import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
import {createPearlMaterial,applyPearl} from './pearl-material.js';
import {createPearlRays} from './pearl-rays.js';
import {bakeMesh,createSDFPearl} from './sdf-pearl.js';
const $=id=>document.getElementById(id);
const stage=$('stage'),scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(35,1,.05,50);camera.position.set(0,0,8.5);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
stage.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=false;controls.minDistance=2;controls.maxDistance=10;controls.enablePan=false;
let pearl=createPearlMaterial();let sdfMesh=null;
const rays=createPearlRays();scene.add(rays);let lastTime=0,effectTime=0;
let root,binding,frame=0,paused=false,loadVersion=0;
const geometries={sphere:()=>new THREE.SphereGeometry(1,48,24),ico:()=>new THREE.IcosahedronGeometry(1,1),torus:()=>new THREE.TorusGeometry(.72,.28,8,24),knot:()=>new THREE.TorusKnotGeometry(.62,.22,48,8)};
function disposeRoot(object){const geometries=new Set(),materials=new Set(),textures=new Set();object?.traverse(o=>{if(o.isMesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m&&m!==pearl){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
const preparedFields=new Map();
function preparedField(shape){if(!preparedFields.has(shape))preparedFields.set(shape,Promise.all([fetch(`${import.meta.env.BASE_URL}fields/${shape}.json`).then(r=>{if(!r.ok)throw new Error('Field metadata unavailable');return r.json();}),fetch(`${import.meta.env.BASE_URL}fields/${shape}.bin`).then(r=>{if(!r.ok)throw new Error('Field data unavailable');return r.arrayBuffer();})]).then(([meta,buffer])=>({...meta,field:new Float32Array(buffer)})));return preparedFields.get(shape);}
async function setModel(model,shape=null){
 if($('mode').value==='sdf'){const version=loadVersion;$('status').textContent='Запекание сглаженной поверхности…';const bake=shape?await preparedField(shape):await bakeMesh(model,p=>{if(version===loadVersion)$('status').textContent=`Запекание ${Math.round(p*100)}%`;});if(version!==loadVersion)return;const next=createSDFPearl(bake);if(root){binding?.restore();scene.remove(root);if(sdfMesh)sdfMesh.userData.dispose();else disposeRoot(root);}sdfMesh=next;root=next;binding=null;pearl=next.material;for(const[id,u]of [['depth','uDepth'],['film','uIridescence'],['rim','uRim'],['count','uCraterCount'],['opacity','uOpacity']])pearl.uniforms[u].value=Number($(id).value);scene.add(root);camera.position.set(0,0,8.5);controls.target.set(0,0,0);controls.update();$('status').textContent=`Источник ${bake.sourceTriangles} граней → 80 на GPU · поле 48³ · ${Math.round(bake.bakeMs)} мс. ${bake.boundaryEdges?'Открытая поверхность: результат может быть некорректен.':''}`;invalidate();return;}
 if(sdfMesh){scene.remove(sdfMesh);sdfMesh.userData.dispose();sdfMesh=null;root=null;binding=null;pearl=createPearlMaterial();}
 model.updateWorldMatrix(true,true);const box=new THREE.Box3().setFromObject(model);
 if(box.isEmpty())throw new Error('Файл не содержит мешей');
 const size=box.getSize(new THREE.Vector3()),s=2/Math.max(size.x,size.y,size.z);
 if(!Number.isFinite(s))throw new Error('Нулевой размер меша');
 const center=box.getCenter(new THREE.Vector3());
 const wrapper=new THREE.Group();wrapper.add(model);model.position.sub(center);wrapper.scale.setScalar(s);wrapper.updateWorldMatrix(true,true);
 const next=applyPearl(wrapper,pearl);
 if(root){binding.restore();scene.remove(root);disposeRoot(root);}
 root=wrapper;binding=next;scene.add(root);camera.position.set(0,0,8.5);controls.target.set(0,0,0);controls.update();invalidate();
}
async function selectShape(){++loadVersion;$('error').textContent='';const model=new THREE.Mesh(geometries[$('shape').value](),new THREE.MeshBasicMaterial());try{await setModel(model,$('shape').value);}catch(e){$('error').textContent=e.message;}finally{if(sdfMesh)disposeRoot(model);}}
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setPixelRatio(Number($('quality').value));renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();invalidate();}
function render(timestamp){frame=0;if(paused)return;const dt=lastTime?Math.min((timestamp-lastTime)/1000,.05):0;lastTime=timestamp;if($('motion').checked)effectTime+=dt;pearl.uniforms.uTime.value=effectTime;rays.material.uniforms.uTime.value=effectTime;rays.material.uniforms.uStrength.value=Number($('rays').value);rays.visible=!sdfMesh&&Number($('rays').value)>0;if(sdfMesh)pearl.uniforms.uRays.value=Number($('rays').value);rays.quaternion.copy(camera.quaternion);rays.position.copy(controls.target).addScaledVector(camera.position.clone().sub(controls.target).normalize(),-1.2);binding?.update();if(!sdfMesh&&root){root.updateWorldMatrix(true,false);camera.updateWorldMatrix(true,false);pearl.uniforms.uViewToPearl.value.setFromMatrix4(root.matrixWorld.clone().invert().multiply(camera.matrixWorld));}renderer.render(scene,camera);const info=renderer.info.render;$('stats').textContent=`${info.triangles.toLocaleString()} triangles / ${info.calls} draw calls · ${renderer.domElement.width} × ${renderer.domElement.height}`;if($('spin').checked)root.rotation.y+=dt*.24;if($('spin').checked||$('motion').checked)invalidate();}
function invalidate(){if(!frame&&!paused)frame=requestAnimationFrame(render);}
controls.addEventListener('change',invalidate);
$('shape').addEventListener('change',selectShape);$('mode').addEventListener('change',selectShape);
for(const [id,uniform] of [['depth','uDepth'],['film','uIridescence'],['rim','uRim'],['count','uCraterCount'],['opacity','uOpacity']])$(id).addEventListener('input',()=>{pearl.uniforms[uniform].value=Number($(id).value);$('countValue').textContent=$('count').value;invalidate();});
$('motion').addEventListener('change',invalidate);$('rays').addEventListener('input',invalidate);$('spin').addEventListener('change',invalidate);$('quality').addEventListener('change',resize);
$('reset').addEventListener('click',()=>{$('shape').value='ico';selectShape();});
export async function parseModel(file){
 const ext=file.name.toLowerCase().split('.').pop();
 if(ext==='obj')return new OBJLoader().parse(await file.text());
 if(ext==='stl'){const g=new STLLoader().parse(await file.arrayBuffer());g.computeVertexNormals();return new THREE.Mesh(g,new THREE.MeshBasicMaterial());}
 if(ext==='glb'||ext==='gltf'){
  const data=ext==='glb'?await file.arrayBuffer():await file.text();
  if(ext==='gltf'){const json=JSON.parse(data);const refs=[...(json.buffers??[]),...(json.images??[])];if(refs.some(r=>r.uri&&!r.uri.startsWith('data:')))throw new Error('Нужен GLB или glTF со встроенными ресурсами');}
  const loader=new GLTFLoader();loader.manager.setURLModifier(url=>{if(!url.startsWith('data:')&&!url.startsWith('blob:'))throw new Error('Внешние ресурсы не поддерживаются — используйте GLB');return url;});
  return (await loader.parseAsync(data,'')).scene;
 }
 throw new Error('Поддерживаются GLB, встроенный glTF, OBJ и STL');
}
async function loadFile(event){const file=event.target.files[0];if(!file)return;const version=++loadVersion;$('error').textContent='';$('status').textContent='Загрузка…';try{if(file.size>50*1024*1024)throw new Error('Лимит демо: 50 МБ');const model=await parseModel(file);if(version!==loadVersion){disposeRoot(model);return;}await setModel(model);if(version===loadVersion)$('status').textContent=`${file.name} · ${sdfMesh?'SDF / 80 треугольников':'исходная геометрия'}`;if(sdfMesh)disposeRoot(model);}catch(e){if(version===loadVersion){$('error').textContent=e.message;$('status').textContent='Загрузка не удалась; предыдущий меш сохранён.';}}finally{event.target.value='';}}
$('file').addEventListener('change',loadFile);
document.addEventListener('visibilitychange',()=>{paused=document.hidden;lastTime=0;if(paused){cancelAnimationFrame(frame);frame=0;}else invalidate();});
renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();paused=true;$('error').textContent='WebGL-контекст потерян. Перезагрузите страницу.';});
new ResizeObserver(resize).observe(stage);
selectShape();resize();
// Read-only diagnostics for integration/acceptance tests.
window.pearlLab={renderer,scene,camera,get material(){return pearl;},rays,get sdf(){return sdfMesh;},get root(){return root;},invalidate};
