import test from 'node:test';
import assert from 'node:assert/strict';

test('the lamp toggles without opening the diary or picking up the quill',async()=>{
 const {DeskInteractions}=await import('../src/interactions.js');
 const desk=new DeskInteractions();
 assert.equal(desk.lampOn,true);
 desk.toggleLamp();assert.equal(desk.lampOn,false);
 assert.equal(desk.bookTarget,0);assert.equal(desk.quillHeld,false);
 desk.toggleLamp();assert.equal(desk.lampOn,true);
});

test('the cover opens, closes and reverses without jumping or discarding interaction state',async()=>{
 const {DeskInteractions}=await import('../src/interactions.js');
 const desk=new DeskInteractions();
 desk.setBookOpen(true);desk.advance(.9);
 assert.ok(desk.bookProgress>0 && desk.bookProgress<1);
 const progress=desk.bookProgress;
 desk.setBookOpen(false);assert.equal(desk.bookProgress,progress);
 desk.advance(.1);assert.ok(desk.bookProgress<progress);
 desk.advance(3);assert.equal(desk.bookProgress,0);
 desk.setBookOpen(true);desk.advance(0,true);assert.equal(desk.bookProgress,1);
 desk.toggleBook();desk.advance(0,true);assert.equal(desk.bookProgress,0);
});

test('a resting quill can be picked up, set down, and is returned when the diary closes',async()=>{
 const {DeskInteractions}=await import('../src/interactions.js');
 const desk=new DeskInteractions();
 desk.pickQuill();assert.equal(desk.quillHeld,true);assert.equal(desk.bookTarget,1);
 desk.putQuillDown();assert.equal(desk.quillHeld,false);assert.equal(desk.bookTarget,1);
 desk.pickQuill();desk.setBookOpen(false);assert.equal(desk.quillHeld,false);
 assert.equal(desk.lampOn,true);
});
