import test from 'node:test';import assert from 'node:assert/strict';import{validateAnimation}from'../lib/baked.js';import{bakeAnimation}from'../lib/bake.js';
const valid={version:1,size:192,frames:96,fps:24,columns:8,perSheet:64,sheets:['sheet-0.webp','sheet-1.webp']};
test('validateAnimation accepts complete atlas and rejects unsafe paths',()=>{assert.equal(validateAnimation(valid),valid);for(const m of[{...valid,fps:0},{...valid,frames:0},{...valid,sheets:['../../x','sheet-1.webp']},{...valid,sheets:[]}])assert.throws(()=>validateAnimation(m));});
test('bakeAnimation refuses unlicensed teddy and invalid budgets before rendering',async()=>{await assert.rejects(bakeAnimation({shape:'teddy'}),/licensed/);await assert.rejects(bakeAnimation({size:2000}),/Invalid/);});
