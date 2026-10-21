import test from 'node:test';
import assert from 'node:assert/strict';

test('replaying ink cancels a fade already running on that page',async()=>{
  const { cancelPageJobs }=await import('../src/animation.js');
  let cancelled=0,untouched=0,result;
  const jobs=[{side:'right',type:'fade',resolve:value=>{cancelled++;result=value;}},{side:'left',type:'write',resolve:()=>untouched++}];
  const remaining=cancelPageJobs(jobs,'right');
  assert.equal(cancelled,1);assert.equal(untouched,0);assert.equal(result,false);
  assert.equal(remaining.length,1);assert.equal(remaining[0].side,'left');
});
