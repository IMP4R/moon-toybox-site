// Offline, deterministic renderer. Baking is explicit; normal visitors never run this.
export async function bakeAnimation({shape='moon',size=192,frames=96,fps=24,amplitude=30,tilt=-8,base=new URL('../fields/',import.meta.url).href,onProgress=()=>{},signal,mount}={}) {
  if(!['moon','truck','knot','sphere','ring'].includes(shape))throw Error('This shape is not licensed for baking/export');
  if(!Number.isInteger(size)||size<32||size>384||!Number.isInteger(frames)||frames<12||frames>240||!Number.isFinite(fps)||fps<6||fps>60||!Number.isFinite(amplitude)||amplitude<0||amplitude>60||!Number.isFinite(tilt)||Math.abs(tilt)>45)throw RangeError('Invalid bake settings');
  const container=document.createElement('div');container.style.cssText=`position:fixed;left:0;top:0;width:${size}px;height:${size}px;pointer-events:none;z-index:-1`;document.body.append(container);
  let view;try{
    const mountRenderer=mount||(await import('./webgl.js')).mountMoon3D;
    view=await mountRenderer(container,{shape,size,base,rays:.34});
    const columns=Math.min(8,Math.floor(2048/size)),rows=Math.min(8,Math.floor(2048/size)),perSheet=columns*rows,files=[];
    const canvas=document.createElement('canvas');canvas.width=columns*size;canvas.height=rows*size;const ctx=canvas.getContext('2d');
    for(let i=0;i<frames;i++){
      if(signal?.aborted)throw new DOMException('Bake cancelled','AbortError');
      const phase=i/frames*Math.PI*2,rad=amplitude*Math.PI/180;
      view.setRotation(tilt*Math.PI/180+Math.sin(phase*2)*rad*.12,Math.sin(phase)*rad);
      // Copy immediately after render, before the WebGL drawing buffer is cleared.
      const n=i%perSheet;ctx.drawImage(view.element,n%columns*size,Math.floor(n/columns)*size,size,size);
      onProgress({frame:i+1,frames});
      if(n===perSheet-1||i===frames-1){const blob=await new Promise(r=>canvas.toBlob(r,'image/webp',.94));if(!blob)throw Error('WebP encoding failed');files.push({name:`sheet-${files.length}.webp`,blob});ctx.clearRect(0,0,canvas.width,canvas.height);}
      await new Promise(r=>setTimeout(r,0));
    }
    const manifest={version:1,shape,size,frames,fps,columns,perSheet,duration:frames/fps,amplitude,tilt,sheets:files.map(f=>f.name)};
    return{manifest,files};
  }finally{view?.dispose();container.remove();}
}
export function downloadBake(result){for(const file of [...result.files,{name:'manifest.json',blob:new Blob([JSON.stringify(result.manifest,null,2)],{type:'application/json'})}]){const url=URL.createObjectURL(file.blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}}
export async function saveBake(result){if(!globalThis.showDirectoryPicker)return downloadBake(result);const dir=await showDirectoryPicker({mode:'readwrite'});for(const file of [...result.files,{name:'manifest.json',blob:new Blob([JSON.stringify(result.manifest,null,2)],{type:'application/json'})}]){const handle=await dir.getFileHandle(file.name,{create:true}),stream=await handle.createWritable();await stream.write(file.blob);await stream.close();}}
