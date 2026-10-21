import test from 'node:test';
import assert from 'node:assert/strict';

test('curved paper never intersects the top of the page block at the gutter', async()=>{
  const { pageRelief }=await import('../src/scene.js');
  assert.equal(typeof pageRelief,'function');
  for(const side of ['left','right']) for(let x=0;x<=100;x++) for(const y of [-1,0,1]){
    assert.ok(pageRelief(side,x/100,y)>=0,`${side} ${x} is below the book block`);
  }
});
