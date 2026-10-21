// One traveler per object, shared by orbit → shelf → box. Native scroll only.
import {upgradeTo3D} from './lib/progressive.js';
export function mountOrbitShelf(){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const hero=document.querySelector('.hero'),scene=document.querySelector('.still-life'),gallery=document.querySelector('#gallery'),finale=document.querySelector('#box-finale'),box=finale.querySelector('.box-stage');
 const lines=scene.querySelector('.orbital-lines'),caption=scene.querySelector('.scene-caption');
 const ids=['moon','knot'],angles=[-13,12,-18,16];
 const layer=document.createElement('div');layer.className='orbit-transfer';layer.setAttribute('aria-hidden','true');document.body.append(layer);
 const boxLayer=document.createElement('div');boxLayer.className='box-travelers';boxLayer.setAttribute('aria-hidden','true');box.append(boxLayer);
 const entries=ids.map((id,i)=>{const source=scene.querySelector('.scene-'+id),image=document.createElement('div'),render=source.cloneNode();render.removeAttribute('class');render.dataset.moonIcon=id;render.removeAttribute('fetchpriority');image.className='orbit-traveler';image.dataset.object=id;image.append(render);layer.append(image);return{id,source,image,angle:angles[i]};});
 let enabled=true,frame=0,geometry=[],start=0,end=1,packStart=1,packEnd=2,openStart=0,openEnd=1,boxRect;
 const clamp=v=>Math.max(0,Math.min(1,v));const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
 function reset(){document.body.classList.remove('orbit-active','journey-packing','hero-idle');layer.hidden=true;entries.forEach(e=>layer.append(e.image));lines.style.removeProperty('transform');lines.style.removeProperty('opacity');caption?.style.removeProperty('opacity');gallery.style.removeProperty('--shelf-reveal');gallery.querySelectorAll('.asset').forEach(a=>a.style.removeProperty('--icon-reveal'));hero.dataset.orbitProgress='static';finale.dataset.packProgress='static';}
 function measure(){
  geometry=entries.map(e=>{const old=e.source.style.transform;e.source.style.transform='none';const s=e.source.getBoundingClientRect();e.source.style.transform=old;const slot=gallery.querySelector(`[data-asset="${e.id}"]`);const target=slot?.querySelector('.moon-live')||slot?.querySelector('img');const t=target?.getBoundingClientRect();const destination=box.querySelector(`[data-pack="${e.id}"]`).getBoundingClientRect();return t?{...e,slot,sx:s.left+s.width/2,sy:s.top+scrollY+s.height/2,sw:s.width,tx:t.left+t.width/2,ty:t.top+scrollY+t.height/2,tw:t.width,bx:destination.left+destination.width/2,by:destination.top+scrollY+destination.height/2,bw:destination.width}:null;}).filter(Boolean);
  const s=scene.getBoundingClientRect();start=innerWidth<=700?Math.max(0,s.top+scrollY-innerHeight*.28):hero.offsetTop+hero.offsetHeight*.32;
  end=Math.max(start+260,...geometry.map(g=>g.ty-innerHeight*(innerWidth<=700?.72:.58)));
  const shelf=gallery.getBoundingClientRect();boxRect=box.getBoundingClientRect();boxRect={top:boxRect.top+scrollY,height:boxRect.height};
  packStart=Math.max(end+160,shelf.top+scrollY+shelf.height-innerHeight*.35);
  const maxScroll=document.documentElement.scrollHeight-innerHeight;
  packEnd=Math.max(packStart+100,maxScroll-12);
   openStart=innerWidth<=700?Math.max(0,boxRect.top-innerHeight*.76-maxScroll*.12125):Math.max(0,packStart-innerHeight*.38+80);openEnd=innerWidth<=700?Math.min(packEnd-20,openStart+Math.max(180,innerHeight*.45)):packStart+(packEnd-packStart)*.58+80;
  requestUpdate();
 }
 function update(){frame=0;if(reduced.matches||!enabled||geometry.length!==ids.length){reset();return;}
  const p=clamp((scrollY-start)/(end-start)),handoff=smooth((p-.91)/.09),packing=clamp((scrollY-packStart)/(packEnd-packStart));
   document.dispatchEvent(new CustomEvent('moon-box-progress',{detail:{opening:clamp((scrollY-openStart)/(openEnd-openStart)),packing}}));
  hero.dataset.orbitProgress=p.toFixed(4);finale.dataset.packProgress=packing.toFixed(4);
  document.body.classList.add('orbit-active');document.body.classList.toggle('hero-idle',p<.04&&packing===0);document.body.classList.toggle('journey-packing',packing>0);layer.hidden=p>=.999&&packing===0;
  lines.style.transform=`rotate(${p*26}deg) scale(${1+p*.12})`;lines.style.opacity=String(.16*(1-smooth(p/.65)));caption?.style.setProperty('opacity',String(1-smooth(p/.3)));gallery.style.setProperty('--shelf-reveal',String(.3+.7*smooth((p-.45)/.55)));
  geometry.forEach((g,i)=>{
   let x,y,size,rotation,opacity;
   if(packing>0){
    const q=smooth(clamp(packing*1.14-i*.045));
    x=g.tx+(g.bx-g.tx)*q+Math.sin(q*Math.PI)*(i%2?24:-24);
    y=g.ty+(g.by-g.ty)*q-scrollY;size=g.tw+(g.bw-g.tw)*q;rotation=Math.sin(q*Math.PI)*[18,-16,-25,22][i];opacity=1;
    g.slot.style.setProperty('--icon-reveal','0');
   }else{
    const raw=smooth((p-.04-i*.018)/(.92-i*.018)),q=innerWidth<=700?1-Math.pow(1-raw,3):raw;
    x=g.sx+(g.tx-g.sx)*q+Math.sin(q*Math.PI)*(innerWidth<=700?12:55)*(i%2?1:-1);y=g.sy+(g.ty-g.sy)*q;size=g.sw+(g.tw-g.sw)*q;rotation=g.angle*(1-q);opacity=(g.id==='teddy'?.8+.2*q:1)*(1-handoff);g.slot.style.setProperty('--icon-reveal',String(handoff));
   }
   const parent=packing>0?boxLayer:layer;if(g.image.parentElement!==parent)parent.append(g.image);
   if(packing>0){const liveBox=box.getBoundingClientRect();x-=liveBox.left;y-=liveBox.top;}
   g.image.style.width=g.sw+'px';g.image.style.height=g.sw+'px';g.image.style.transform=`translate3d(${x-g.sw/2}px,${y-g.sw/2}px,0) scale(${size/g.sw}) rotate(${rotation}deg)`;g.image.style.opacity=String(opacity);
   // Real box foreground occludes these same nodes; no viewport clip approximation.
   g.image.style.removeProperty('clip-path');
  });
 }
 function requestUpdate(){if(!frame)frame=requestAnimationFrame(update);}
 function onGallery(e){enabled=e.detail.enabled;reset();measure();}
 addEventListener('scroll',requestUpdate,{passive:true});addEventListener('resize',measure);reduced.addEventListener('change',()=>{reset();measure();});document.addEventListener('moon-gallery-change',onGallery);
 const observer=new ResizeObserver(measure);observer.observe(scene);observer.observe(gallery);observer.observe(box);entries.forEach(e=>e.source.addEventListener('load',measure));measure();
 const stopLive=upgradeTo3D(layer,{base:'/moon-toybox-site/fields/'});
 return()=>{stopLive();cancelAnimationFrame(frame);removeEventListener('scroll',requestUpdate);removeEventListener('resize',measure);document.removeEventListener('moon-gallery-change',onGallery);observer.disconnect();reset();layer.remove();};
}
