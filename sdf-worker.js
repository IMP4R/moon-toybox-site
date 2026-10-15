import * as THREE from 'three';
import {MeshBVH} from 'three-mesh-bvh';
// Weld triangle soup, then Loop subdivision: preprocessing only, never rendered.
export function smoothMesh(positions,levels=2){
 let vertices=[],faces=[],map=new Map();
 for(let i=0;i<positions.length;i+=9){let f=[];for(let j=0;j<9;j+=3){const p=Array.from(positions.slice(i+j,i+j+3)),key=p.map(v=>Math.round(v*1e5)).join(',');if(!map.has(key)){map.set(key,vertices.length);vertices.push(p);}f.push(map.get(key));}if(new Set(f).size===3)faces.push(f);}
 let boundaryEdges=0;
 for(let level=0;level<levels;level++){
  const edges=new Map(),neighbors=vertices.map(()=>new Set()),boundary=vertices.map(()=>[]);
  for(const [a,b,c]of faces)for(const [u,v,w]of [[a,b,c],[b,c,a],[c,a,b]]){const key=[Math.min(u,v),Math.max(u,v)].join(',');if(!edges.has(key))edges.set(key,{a:u,b:v,op:[]});edges.get(key).op.push(w);neighbors[u].add(v);neighbors[v].add(u);}
  boundaryEdges=0;for(const e of edges.values()){if(e.op.length>2)throw new Error('Non-manifold edge: preprocess mesh before SDF');if(e.op.length===1){boundary[e.a].push(e.b);boundary[e.b].push(e.a);boundaryEdges++;}}
  const next=vertices.map((p,i)=>{const ns=[...neighbors[i]],bn=boundary[i];if(bn.length===2)return p.map((v,k)=>.75*v+.125*(vertices[bn[0]][k]+vertices[bn[1]][k]));const beta=ns.length===3?3/16:3/(8*Math.max(ns.length,1));return p.map((v,k)=>(1-ns.length*beta)*v+beta*ns.reduce((s,n)=>s+vertices[n][k],0));});
  for(const e of edges.values()){e.index=next.length;next.push(vertices[e.a].map((v,k)=>e.op.length===2?.375*(v+vertices[e.b][k])+.125*(vertices[e.op[0]][k]+vertices[e.op[1]][k]):.5*(v+vertices[e.b][k])));}
  const edge=(a,b)=>edges.get([Math.min(a,b),Math.max(a,b)].join(',')).index;
  const nf=[];for(const[a,b,c]of faces){const ab=edge(a,b),bc=edge(b,c),ca=edge(c,a);nf.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}vertices=next;faces=nf;
 }
 const data=new Float32Array(faces.length*9);faces.forEach((f,i)=>f.forEach((v,j)=>data.set(vertices[v],i*9+j*3)));
 return {data,boundaryEdges,triangles:faces.length};
}
self.onmessage=({data:{positions,resolution=48,levels=2}})=>{try{
 const start=performance.now(),smooth=smoothMesh(positions,levels),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(smooth.data,3));g.computeBoundingBox();
 const original=new THREE.Box3();for(let i=0;i<positions.length;i+=3)original.expandByPoint(new THREE.Vector3().fromArray(positions,i));
 // Rescale after subdivision to preserve overall size, while retaining the smoothed shape.
 const s0=original.getSize(new THREE.Vector3()),s1=g.boundingBox.getSize(new THREE.Vector3()),scale=Math.max(s0.x,s0.y,s0.z)/Math.max(s1.x,s1.y,s1.z);g.scale(scale,scale,scale);
 const bvh=new MeshBVH(g),n=resolution,field=new Float32Array(n*n*n),p=new THREE.Vector3(),target={point:new THREE.Vector3()},tri=new THREE.Triangle(),normal=new THREE.Vector3(),delta=new THREE.Vector3();
 const a=g.attributes.position,idx=g.index,extent=1.25;
 for(let z=0;z<n;z++){for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  p.set((x/(n-1)*2-1)*extent,(y/(n-1)*2-1)*extent,(z/(n-1)*2-1)*extent);
  bvh.closestPointToPoint(p,target);const f=target.faceIndex;tri.a.fromBufferAttribute(a,idx.getX(f*3));tri.b.fromBufferAttribute(a,idx.getX(f*3+1));tri.c.fromBufferAttribute(a,idx.getX(f*3+2));tri.getNormal(normal);delta.subVectors(p,target.point);field[x+n*(y+n*z)]=target.distance*(delta.dot(normal)<0?-1:1);
 }if(z%8===0)self.postMessage({progress:z/n});}
 self.postMessage({field,resolution:n,extent,bakeMs:performance.now()-start,sourceTriangles:positions.length/9,bakedTriangles:smooth.triangles,boundaryEdges:smooth.boundaryEdges},[field.buffer]);
 }catch(e){self.postMessage({error:e.message});}};
