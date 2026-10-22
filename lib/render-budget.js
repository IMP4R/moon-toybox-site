// Decorative rendering must never silently fall back to CPU raymarching.
export function isSoftwareRenderer(name='') {
  return /swiftshader|llvmpipe|softpipe|software|basic render|warp\b/i.test(name);
}
export function resolutionBudget(width,height,dpr=1,zoom=1) {
  const density=Math.min(2,Math.max(1,dpr))*Math.min(1.5,Math.max(1,zoom));
  return Math.min(density,768/Math.max(1,width,height));
}
export function inspectRenderer(gl) {
  const ext=gl.getExtension('WEBGL_debug_renderer_info');
  return ext?String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)||''):String(gl.getParameter(gl.RENDERER)||'');
}
