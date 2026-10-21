import test from 'node:test';
import assert from 'node:assert/strict';

test('reduced-motion camera snaps to the active page instead of clipping a reply mid-pan',async()=>{
 const {cameraBlend}=await import('../src/scene.js');
 assert.equal(cameraBlend(true,.016),1);
 assert.ok(cameraBlend(false,.016)>0 && cameraBlend(false,.016)<1);
});
