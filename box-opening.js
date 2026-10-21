// Native-scroll image-sequence playback. Static original artwork is the exact final frame.
export function mountBoxOpening(){
 const box=document.querySelector('.box-stage'),canvas=box.querySelector('.box-opening'),context=canvas.getContext('2d');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),saveData=navigator.connection?.saveData;
 const images=new Map(),pending=new Map();let progress=1,stopped=false,started=false;
 const count=61;
 function render(){box.dataset.openProgress=progress.toFixed(4);if(stopped||reduced.matches||saveData||!started){box.classList.remove('box-is-opening');return;}
  const index=Math.min(count-1,Math.round(progress*(count-1)));const image=images.get(index);
  if(progress>=.995){box.classList.remove('box-is-opening');return;}
  if(!image){load(index).then(render);return;}
  context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);box.classList.add('box-is-opening');box.dataset.openProgress=progress.toFixed(4);
 }
 function load(index){if(images.has(index))return Promise.resolve();if(pending.has(index))return pending.get(index);const promise=new Promise(resolve=>{const image=new Image();image.onload=()=>{images.set(index,image);resolve();};image.onerror=()=>{stopped=true;box.classList.remove('box-is-opening');resolve();};image.src=`/moon-toybox-site/box-opening/frame-${String(index).padStart(3,'0')}.webp`;});pending.set(index,promise);return promise;}
 async function start(){if(started||reduced.matches||saveData)return;started=true;await load(0);render();await Promise.all(Array.from({length:4},async(_,worker)=>{for(let i=worker+1;i<count&&!stopped;i+=4)await load(i);}));}
 const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))start();},{rootMargin:'1600px'});observer.observe(box);box.querySelectorAll('[data-box-full]').forEach(async img=>{const high=new Image();high.src=img.dataset.boxFull;try{await high.decode();img.src=high.src;}catch{}});
 function update(e){progress=e.detail.opening;render();}
 document.addEventListener('moon-box-progress',update);reduced.addEventListener('change',render);
 return()=>{stopped=true;observer.disconnect();document.removeEventListener('moon-box-progress',update);reduced.removeEventListener('change',render);box.classList.remove('box-is-opening');};
}
