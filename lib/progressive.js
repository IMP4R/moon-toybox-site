// Image first. No animation callbacks when offscreen, hidden or reduced-motion.
export function upgradeTo3D(root=document,{base='/fields/'}={}) {
  let stopped=false,queue=Promise.resolve(),software=false;
  const records=[];
  const observer=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){observer.unobserve(e.target);queue=queue.then(()=>prepare(e.target));}},{rootMargin:'80px'});
  async function prepare(img) {
    if(stopped||software||!img.isConnected||img.dataset.moonIcon==='teddy'||img.src.endsWith('.svg'))return;
    const host=document.createElement('span');host.className='moon-live';
    const rect=img.getBoundingClientRect(),w=Math.round(rect.width)||img.width,h=Math.round(rect.height)||img.height;
    host.style.width=w+'px';host.style.height=h+'px';img.replaceWith(host);host.append(img);
    let view,cleanup=()=>{};
    const record={dispose(){cleanup();view?.dispose();if(host.isConnected)host.replaceWith(img);}};records.push(record);
    try {
      const {mountMoon3D}=await import('./webgl.js');if(stopped)return;
      view=await mountMoon3D(host,{shape:img.dataset.moonIcon,base,size:w,rays:.34});
      if(stopped||!host.isConnected){record.dispose();return;}
      const preset={moon:{speed:.65,tilt:-8},truck:{speed:1.05,tilt:-5},knot:{speed:1.15,tilt:-12}}[img.dataset.moonIcon]||{speed:1,tilt:0};
      const tilt=Number(img.dataset.rotationTilt??preset.tilt)*Math.PI/180,limit=Number(img.dataset.rotationLimit??30)*Math.PI/180,speed=Number(img.dataset.rotationSpeed??preset.speed);
      const reduced=matchMedia('(prefers-reduced-motion: reduce)');
      let timer=0,frame=0,last=0,angle=0,dx=0,dy=0,visible=false,dead=false;
      view.setRotation(tilt,0);host.classList.add('ready');
      function cancel(){clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=0;last=0;}
      function active(){return !dead&&!stopped&&visible&&!document.hidden&&!reduced.matches&&host.isConnected;}
      function schedule(){if(active()&&!timer&&!frame)timer=setTimeout(()=>{timer=0;frame=requestAnimationFrame(tick);},40);}
      function tick(now){frame=0;if(!active()){last=0;return;}const dt=last?Math.min((now-last)/1000,.12):0;last=now;angle+=dt*.18*speed;
        const rx=Math.max(-limit,Math.min(limit,tilt+Math.sin(angle*.65)*limit*.18+dy)),ry=Math.max(-limit,Math.min(limit,Math.sin(angle)*limit+dx));
        view.setRotation(rx,ry);schedule();
      }
      function changed(){cancel();schedule();}
      const visibility=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;changed();});visibility.observe(host);
      function move(e){if(e.pointerType!=='mouse')return;const b=host.getBoundingClientRect();dy=(e.clientY-b.top-b.height/2)/b.height*.45;dx=(e.clientX-b.left-b.width/2)/b.width*.65;if(reduced.matches)view.setRotation(tilt+dy,dx);}
      function leave(){dx=dy=0;}
      function lost(){cancel();host.classList.remove('ready');}
      host.addEventListener('pointermove',move);host.addEventListener('pointerleave',leave);view.element.addEventListener('webglcontextlost',lost);
      document.addEventListener('visibilitychange',changed);reduced.addEventListener('change',changed);
      cleanup=()=>{dead=true;cancel();visibility.disconnect();document.removeEventListener('visibilitychange',changed);reduced.removeEventListener('change',changed);host.removeEventListener('pointermove',move);host.removeEventListener('pointerleave',leave);view.element.removeEventListener('webglcontextlost',lost);};
    } catch(error) {if(/software WebGL|Error creating WebGL context/.test(String(error)))software=true;record.dispose();}
  }
  root.querySelectorAll('img[data-moon-icon]').forEach(img=>{if(!img.closest('.moon-live')&&!img.src.endsWith('.svg'))observer.observe(img);});
  return ()=>{stopped=true;observer.disconnect();records.forEach(r=>r.dispose());};
}
