import test from 'node:test';
import assert from 'node:assert/strict';

test('handwriting wraps long words and paragraphs within the page width', async () => {
  const { wrapLines } = await import('../src/ink.js');
  const measure = text => text.length * 10;
  const lines = wrapLines('Hello there\n'+ 'x'.repeat(24), measure, 100);
  assert.deepEqual(lines, ['Hello', 'there', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxx']);
  assert.ok(lines.every(line => measure(line) <= 100));
});

test('the quill has a resting nib position even when a short typed word reveals in one frame',async()=>{
 const {inkTip}=await import('../src/ink.js');
 const lines=[{x:120,y:335,width:45,start:0},{x:122,y:420,width:80,start:100}];
 assert.deepEqual(inkTip(lines,10),{x:130,y:321});
 assert.deepEqual(inkTip(lines,999),{x:202,y:406});
 assert.equal(inkTip([],0),null);
});
