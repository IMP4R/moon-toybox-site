// Transparent WebP atlases, Canvas2D playback. Never imports Three or creates WebGL.
export function validateAnimation(m) {
  if(m?.version!==1||!Number.isInteger(m.size)||m.size<16||m.size>768||!Number.isInteger(m.frames)||m.frames<2||m.frames>240||!Number.isFinite(m.fps)||m.fps<1||m.fps>60||!Number.isInteger(m.columns)||m.columns<1||m.columns>16||!Number.isInteger(m.perSheet)||m.perSheet<1||m.perSheet>256||!Array.isArray(m.sheets)||m.sheets.length!==Math.ceil(m.frames/m.perSheet)||m.sheets.some(s=>typeof s!=='string'||!/^sheet-\d+\.webp$/.test(s)))throw new Error('Invalid Moon baked animation manifest');
  return m;
}
export function upgradeBaked(root=document,{base=new URL('../animations/',import.meta.url).href}={}) {
  let disposed=false;const records=[],reduced=matchMedia('(prefers-reduced-motion: reduce)'),cache=new Map();
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{const r=records.find(r=>r.img===e.target);if(!r)return;r.visible=e.isIntersecting;sync(r);}),{rootMargin:'0px'});
  async function load(r){if(r.loading||r.manifest||disposed)return;r.loading=true;try{
    const folder=new URL(r.img.dataset.bakedSize==='large'?r.id+'-384/':r.id+'-192/',new URL(base,document.baseURI));
    let shared=cache.get(folder.href);if(!shared){shared=(async()=>{const response=await fetch(new URL('manifest.json',folder));if(!response.ok)throw Error('Animation unavailable');const manifest=validateAnimation(await response.json());const sheets=await Promise.all(manifest.sheets.map(async name=>{const image=new Image();image.src=new URL(name,folder).href;await image.decode();return image;}));return{manifest,sheets};})();cache.set(folder.href,shared);}
    const{manifest,sheets}=await shared;if(disposed)return;r.manifest=manifest;r.sheets=sheets;
    r.canvas=document.createElement('canvas');r.canvas.width=r.canvas.height=manifest.size;r.canvas.setAttribute('aria-hidden','true');r.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    r.host=document.createElement('span');r.host.className='moon-live moon-baked ready';const rect=r.img.getBoundingClientRect();r.host.style.cssText='position:relative;display:inline-block;width:'+(rect.width||r.img.width)+'px;height:'+(rect.height||r.img.height)+'px';r.img.replaceWith(r.host);r.host.append(r.img,r.canvas);r.ctx=r.canvas.getContext('2d');r.img.style.opacity='0';draw(r,0);sync(r);
  }catch{r.failed=true;}finally{r.loading=false;}}
  function draw(r,frame){const m=r.manifest,index=frame%m.perSheet,sheet=r.sheets[Math.floor(frame/m.perSheet)];r.ctx.clearRect(0,0,m.size,m.size);r.ctx.drawImage(sheet,index%m.columns*m.size,Math.floor(index/m.columns)*m.size,m.size,m.size,0,0,m.size,m.size);}
  function stop(r){clearTimeout(r.timer);r.timer=0;r.last=0;}
  function tick(r){r.timer=0;if(disposed||!r.visible||document.hidden||reduced.matches)return;const now=performance.now();if(!r.start)r.start=now;const frame=Math.floor((now-r.start)/1000*r.manifest.fps)%r.manifest.frames;if(frame!==r.last){draw(r,frame);r.last=frame;}r.timer=setTimeout(()=>tick(r),1000/r.manifest.fps);}
  function sync(r){stop(r);if(r.canvas){r.canvas.style.setProperty('display',reduced.matches?'none':'block','important');r.img.style.setProperty('opacity',reduced.matches?'1':'0','important');}if(disposed||!r.visible||document.hidden||reduced.matches)return;if(!r.manifest){if(!r.failed)load(r);return;}tick(r);}
  function changed(){records.forEach(sync);}
  root.querySelectorAll('img[data-moon-icon]').forEach(img=>{const id=img.dataset.moonIcon;if(!['moon','truck','knot'].includes(id)||img.closest('.moon-live,.moon-baked'))return;const r={img,id,visible:false,last:-1};records.push(r);observer.observe(img);});
  document.addEventListener('visibilitychange',changed);reduced.addEventListener('change',changed);
  return()=>{disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',changed);reduced.removeEventListener('change',changed);records.forEach(r=>{stop(r);if(r.host?.isConnected){r.img.style.opacity='';r.host.replaceWith(r.img);}});cache.clear();};
}
