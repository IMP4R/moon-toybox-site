export function mountFinale(){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const video=document.querySelector('#ambient-video');let loaded=false;
 function sync(){if(reduced.matches||navigator.connection?.saveData||document.documentElement.dataset.moonSoftware==='true'){video.pause();video.removeAttribute('src');video.load();loaded=false;return;}
  if(!loaded){video.src=innerWidth<700?'/moon-toybox-site/ambient-mobile.mp4':'/moon-toybox-site/ambient-loop.mp4';video.load();loaded=true;}
  if(document.hidden)video.pause();else video.play().catch(()=>{});
 }
 document.addEventListener('moon-software-renderer',sync);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);sync();
 return()=>{video.pause();};
}
