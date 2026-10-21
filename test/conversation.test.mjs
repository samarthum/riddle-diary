import test from 'node:test';
import assert from 'node:assert/strict';

test('diary absorbs one user message, remembers reply, and forgets on reset', async () => {
  const { Conversation } = await import('../src/conversation.js');
  const conversation = new Conversation();
  assert.equal(conversation.state, 'idle');
  assert.equal(conversation.begin('  Hello, I am Samarth.  '), true);
  assert.equal(conversation.state, 'absorbing');
  assert.equal(conversation.begin('second message'), false);
  assert.deepEqual(conversation.messages, [{ role:'user', content:'Hello, I am Samarth.' }]);
  conversation.reply('My name is Tom Riddle.');
  assert.equal(conversation.state, 'writing');
  assert.equal(conversation.messages.length, 2);
  conversation.finish();
  assert.equal(conversation.state, 'idle');
  conversation.reset();
  assert.deepEqual(conversation.messages, []);
  assert.equal(conversation.state, 'idle');
});
