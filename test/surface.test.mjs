import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('scene supplies a keyboard-accessible writing surface and honest privacy note', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8').catch(() => '');
  assert.match(html, /id="inscription"/, 'a real textarea receives mobile and keyboard text');
  assert.match(html, /id="send"/, 'writers can submit without waiting');
  assert.match(html, /id="status"[^>]*role="status"/, 'state changes are accessible');
  assert.match(html, /AI-generated/);
});
