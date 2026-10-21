import test from 'node:test';
import assert from 'node:assert/strict';

test('phone desk overview fits lamp, closed diary and quill before zooming into a page',async()=>{
 const {overviewDistance}=await import('../src/scene.js');
 const aspect=390/844,dist=overviewDistance(aspect);
 const visibleWidth=2*dist*Math.tan(36*Math.PI/360)*aspect;
 assert.ok(visibleWidth>=6.7);
 assert.equal(overviewDistance(1280/900),6.3,'preserve the accepted desktop approach');
});
