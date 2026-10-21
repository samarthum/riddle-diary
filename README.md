# The Diary · T. M. Riddle

Unofficial fan experience: a real Three.js scene, opening leather cover, aged paper, progressively revealed cursive, disappearing ink, and conversational replies.

Production: https://riddle-diary-ten.vercel.app
Vercel project: `samarthums-projects/riddle-diary` (`prj_qLVMmSkVKPey2l2xdm8s4MdOIzUz`).

## Run

Node 24 is the deployment runtime. Node 26 also exercised locally.

```sh
npm ci
npm run dev
npm test
npm run build
```

For local AI replies, put `AI_GATEWAY_API_KEY` in `.env.local` and restart Vite. Never prefix the key with `VITE_`: credentials belong only in the serverless function. Production has this secret configured in Vercel. Optional `DIARY_MODEL` changes the gateway model; the default is `anthropic/claude-sonnet-5.5`.

Deploy with `npx vercel@64.7.0 --prod --yes --scope samarthums-projects`. The project is linked locally in the ignored `.vercel/` directory.

## Controls and behavior

- Automatic camera approach; click the cover or Open to lift it. Clicking the diary again closes it and pulls the camera back to the desk. Drafts and recent conversation survive closing, including a reply arriving while it is shut.
- Click the lamp itself to extinguish/relight its flame and warm illumination.
- A pale quill rests beside the diary. Click it to lift it over the paper; click it again to put it down. Typing also picks it up automatically so keyboard/touch-field use stays convenient. Its nib follows the writer's ink and it remains visible when idle, including under reduced motion.
- After 4.2 seconds of inactivity, or Enter / send, the writer's ink is absorbed and Tom replies on the right. Closing cancels an unfinished draft's auto-send timer; the draft is kept, and the 4.2-second countdown restarts only on the next keystroke (Enter / send still submits at once).
- Replies remain for at least 22 seconds, longer for more words, then fade. They also soak away immediately when the writer starts typing back. Read last reply reveals them again.
- On narrow screens the closed-table overview fits the lamp, book and quill; opening moves the camera between the writer's page and Tom's page.
- Physical-object raycasting is paired with keyboard-accessible, invisible-until-focused buttons anchored to the rendered objects.
- Sound is optional and generated locally; no microphone access.
- Reload/Begin again clears client memory. No conversation is stored by this app on disk, in localStorage or in a database; messages are sent to the AI gateway/provider to generate responses.
- Reduced-motion preference skips the cover and ink-writing animations.

## Files

- `src/scene.js`: scene, materials, models, book mesh, camera, quill.
- `src/ink.js`: canvas handwriting layout and reveal/dissolve.
- `src/main.js`: conversation flow, controls, animation ownership.
- `api/diary.js`: validation, system prompt, server-side AI call, upstream timeout.
- `test/`: Node unit and boundary tests.
- `scripts/browser-check.mjs`: exercised desktop/mobile production browser flow. Uses a scratch-installed `playwright-core` and a local Chromium executable; update those paths for another machine. Always closes its isolated test browser.
- `scripts/interactions-check.mjs`: physical lamp/book hit tests, resting/lifted/writing quill screenshots, first-keystroke absorption, close/reopen draft retention and closed-book response arrival. Defaults to an explicitly labelled API fixture; set `REAL_AI=1` with `DIARY_URL` to exercise the real backend.
- `scripts/focus-check.mjs`: keyboard-focus regression. Clicks the resting quill, cover or Open, then types with real key events (no field fill) and checks every letter lands while the quill/book stay put. Also covers Tab + Enter/Space object activation, about-dialog focus and the phone no-forced-keyboard path. Defaults to `http://127.0.0.1:5181` and an explicitly labelled API fixture.
- `artifacts/`: ignored verification screenshots.

## Operational boundaries

The in-memory rate limiter is best-effort **per serverless instance**, not a global abuse/spend control. Before public promotion, add durable rate limiting/bot protection and review an appropriate AI budget. The app has input/output length limits and a 25-second upstream timeout; it never logs message content or credentials. Generated replies are fictional, not professional advice.

The renderer requires WebGL2. The shared VPS viewer cannot create a WebGL context, so browser QA used an isolated current Chromium with ANGLE SwiftShader; no shared browser settings were changed. This is browser layout/interaction evidence, not native-device keyboard/IME verification.

## Credits

Poly Haven oil lamp, dark wood and castle stone, CC0. Generated leather, parchment and quill textures. Fonts: Pinyon Script, Cedarville Cursive and IM FELL English, bundled locally. Inspired by the Harry Potter books; not affiliated with or endorsed by their authors, publishers or film rights holders.
