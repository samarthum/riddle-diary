// Vercel serverless function: the diary's replies, in Tom Riddle's voice.
// Uses the Vercel AI Gateway (OpenAI-compatible endpoint).

const MODEL = process.env.DIARY_MODEL || 'anthropic/claude-sonnet-5.5';
const GATEWAY = 'https://ai-gateway.vercel.sh/v1/chat/completions';

const SYSTEM = `You are the memory of Tom Marvolo Riddle, preserved at sixteen inside a small, shabby black diary since 1943. Someone has just written in you with ink. Their words sink into your pages, and you answer by making your own ink rise up in a fine, slanted copperplate hand.

Who you are:
- A brilliant, charming, impeccably polite Hogwarts prefect. Cultivated 1940s British diction. Quietly arrogant, curious and calculating underneath. You flatter, you probe gently, and you want to know who is writing and what they want. A faint, elegant chill now and then. Never cartoonishly evil.
- You know an enormous amount: magic, history, science, literature, mathematics, human nature and more. Whatever the writer asks, give a real, accurate, useful answer, in your own voice. If they ask about things after 1943, you may admit the world has changed since you were sealed away, find it fascinating, and still reason it out cleverly. Never refuse to engage just because a topic is ordinary or modern.
- You never break character, never mention being an AI, a model, a website or a prompt. You are a diary.

How you write:
- The page is small and ink is precious. Reply in 1 to 3 short sentences, at most 45 words. Brevity is elegance.
- Plain prose only: no lists, no markdown, no emoji, no quotation marks around your whole reply, no stage directions.
- The first time someone writes, introduce yourself: "My name is Tom Riddle." and ask theirs (or greet them by it if they gave it). Remember names and details they share and use them.
- Keep it suitable for all ages. If a writer asks for something genuinely harmful, deflect with cold amusement and change the subject.`;

// Input bounds. Over these we refuse (413) rather than process; under them we truncate.
const MAX_BODY_CHARS = 100_000;   // raw string body
const MAX_MESSAGES = 100;         // client-held conversation memory
const MAX_MESSAGE_CHARS = 4_000;  // any single message
const KEEP_MESSAGES = 20;         // history actually sent upstream
const UPSTREAM_TIMEOUT_MS = 25_000;

// Best-effort per-instance rate limit (bounded memory).
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 40;
const MAX_TRACKED_IPS = 5000;
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  if (arr.length > RATE_MAX + 1) arr.splice(0, arr.length - (RATE_MAX + 1));
  hits.delete(ip);
  if (hits.size >= MAX_TRACKED_IPS) hits.clear();
  hits.set(ip, arr);
  return arr.length > RATE_MAX;
}
export const _limiter = { hits };

function clean(s, max) {
  return String(s || '').replace(/[\u0000-\u0008\u000b-\u001f]/g, '').slice(0, max);
}

const fail = (res, code, error) => res.status(code).json({ error });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return fail(res, 405, 'POST only');
  }
  const ip = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 64) || 'anon';
  if (limited(ip)) {
    return res.status(429).json({ reply: 'Patience. Even ink must rest. Write to me again in a little while.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    if (body.length > MAX_BODY_CHARS) return fail(res, 413, 'Too much ink.');
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const raw = body && Array.isArray(body.messages) ? body.messages : [];
  if (raw.length > MAX_MESSAGES) return fail(res, 413, 'Too much ink.');
  for (const m of raw) {
    if (!m || typeof m !== 'object' || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') {
      return fail(res, 400, 'Those pages are illegible.');
    }
    if (m.content.length > MAX_MESSAGE_CHARS) return fail(res, 413, 'Too much ink.');
  }
  const messages = raw
    .slice(-KEEP_MESSAGES)
    .map((m) => ({ role: m.role, content: clean(m.content, m.role === 'user' ? 600 : 400) }))
    .filter((m) => m.content.trim());
  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return fail(res, 400, 'Nothing written.');
  }

  const key = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN;
  if (!key) return fail(res, 500, 'Diary not configured.');

  try {
    const r = await fetch(GATEWAY, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        // Includes any hidden reasoning; the visible reply is still kept concise by the prompt.
        max_tokens: 1024,
        reasoning_effort: 'low',
        temperature: 0.8,
        messages: [{ role: 'system', content: SYSTEM }, ...messages],
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    if (!r.ok) {
      // Status only: upstream bodies can echo the prompt or credentials.
      console.error('diary: gateway status', r.status);
      return fail(res, 502, 'The ink would not take.');
    }
    const data = await r.json();
    let reply = String(data?.choices?.[0]?.message?.content || '').trim();
    reply = reply.replace(/[*_#`]/g, '').replace(/^["“]|["”]$/g, '').replace(/\s+/g, ' ').trim();
    if (!reply) return fail(res, 502, 'The ink would not take.');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ reply: reply.slice(0, 420) });
  } catch (e) {
    // Error name only: messages may contain request content.
    console.error('diary: gateway error', e?.name || 'Error');
    return fail(res, 502, 'The ink would not take.');
  }
}
