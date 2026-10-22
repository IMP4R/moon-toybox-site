// Reproducible, explicit allowlist: never copy demo-only teddy fields or models.
import fs from 'node:fs/promises';import path from 'node:path';import{execFileSync}from'node:child_process';
const root=path.dirname(new URL(import.meta.url).pathname),out=path.join(root,'release/moon-toybox');await fs.rm(out,{recursive:true,force:true});await fs.mkdir(out,{recursive:true});
for(const file of ['pearl-material.js','pearl-rays.js','sdf-pearl.js','sdf-worker.js','bake-cli.mjs','bake.html','bake-page.js','BAKING.md'])await fs.copyFile(path.join(root,file),path.join(out,file));
await fs.copyFile(path.join(root,'BAKING.md'),path.join(out,'README.md'));await fs.copyFile(path.join(root,'public/CREDITS.html'),path.join(out,'CREDITS.html'));
await fs.cp(path.join(root,'lib'),path.join(out,'lib'),{recursive:true});
for(const dir of ['fields','icons','animations'])await fs.mkdir(path.join(out,dir),{recursive:true});
for(const shape of ['ico','knot','truck','sphere','torus'])for(const ext of ['json','bin'])await fs.copyFile(path.join(root,'public/fields',shape+'.'+ext),path.join(out,'fields',shape+'.'+ext));
for(const name of await fs.readdir(path.join(root,'public/icons')))if(/^(moon|truck|knot|sphere|ring)(-|\.)/.test(name))await fs.copyFile(path.join(root,'public/icons',name),path.join(out,'icons',name));
for(const shape of ['moon','truck','knot'])for(const size of [192,384])await fs.cp(path.join(root,'public/animations',shape+'-'+size),path.join(out,'animations',shape+'-'+size),{recursive:true});
await fs.writeFile(path.join(out,'package.json'),JSON.stringify({name:'moon-toybox',version:'0.2.1',type:'module',description:'Pearl icons, transparent baked animations and browser/CLI authoring',exports:{'.':'./lib/icons.js','./webgl':'./lib/webgl.js','./progressive':'./lib/progressive.js','./baked':'./lib/baked.js','./bake':'./lib/bake.js'},bin:{'moon-bake':'./bake-cli.mjs'},peerDependencies:{three:'^0.180.0','three-mesh-bvh':'^0.9.1',playwright:'^1.50.0'},peerDependenciesMeta:{three:{optional:true},'three-mesh-bvh':{optional:true},playwright:{optional:true}}},null,2)+'\n');
execFileSync('npm',['pack','--pack-destination',path.join(root,'public')],{cwd:out,stdio:'inherit'});
