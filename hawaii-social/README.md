# Hawaii Course social builder

A small local web app for producing lead-generation posts for the Foregut Disease Foundation's annual Hawaii course (2027: February 4 to 9, Royal Sonesta Kaua'i). It writes platform-specific copy with Claude, lets you upload a photo or generate one, burns a headline and the dates onto the image at the right size for each platform, and keeps a library of drafts so you can plan a run of posts.

Target reader: surgeons and gastroenterologists who have never attended. Every post ends with a tracked link back to the website or registration page.

## Run it

```bash
cd hawaii-social
cp .env.example .env      # add ANTHROPIC_API_KEY, optionally OPENAI_API_KEY
npm install
npm start                 # http://localhost:3000
```

No keys yet? Set `MOCK_AI=1` in `.env` to click through the interface with canned copy.

If the app reports an authentication error, run `npm run check`. It inspects `.env`, reports common mistakes in plain English (quotes around the key, a line break inside it, a duplicate line, a conflicting shell variable), and tests the key against Anthropic. It never prints the key itself.

Values in `.env` take priority over variables already set in your shell.

## What it does

1. **Angle.** Pick a starter angle or ask Claude for eight fresh ones grounded in the brief. Add notes (a faculty name, a session, a deadline).
2. **Copy.** One click writes LinkedIn, Facebook, and Instagram versions with the right length, tone, and hashtag count for each, plus alt text, an overlay headline and subline, and an image prompt. Rewrite buttons (shorter, sharper hook, more clinical, warmer) work per platform. The `{LINK}` token is replaced with a UTM-tagged URL per platform in the "Ready to paste" box.
3. **Image.** Upload a photo (PNG, JPEG, WebP) or generate one from the prompt. The composer overlays headline, subline, and a footer pill with the website, with a bottom gradient, solid band, top gradient, or text-only layout. Adjust focal point, colors, text size, and add a logo. Export a single PNG or all four sizes at once:
   - Square 1080×1080 (Instagram, LinkedIn, Facebook)
   - Portrait 1080×1350 (Instagram feed)
   - Link 1200×628 (LinkedIn and Facebook link cards)
   - Story 1080×1920 (Instagram and Facebook stories)
4. **Schedule.** Title, status (draft, ready, scheduled, posted), date, and platforms. Saved posts appear in the library and reopen with everything intact.

## The brief

`data/brief.default.json` holds the facts Claude is allowed to use: course name, dates, venue, directors, audience, selling points, URLs, voice rules, and preferred hashtags. Edit it in the sidebar and save; your edits go to `data/brief.json` (gitignored). Paste past posts into the "Past posts" field so new copy matches the established voice.

Claude is instructed to use only facts in the brief and the angle. It will not invent faculty, talks, or statistics.

## Configuration

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for copy, angles, and rewrites. |
| `CLAUDE_MODEL` | Defaults to `claude-opus-5`. |
| `GEMINI_API_KEY` | Optional. Enables image generation with Gemini, the default provider. Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Without it, uploads still work. |
| `OPENAI_API_KEY` | Optional alternative provider. Pair with `IMAGE_PROVIDER=openai`. |
| `IMAGE_PROVIDER` | `gemini`, `openai`, or `none`. Use `none` to work only from uploaded photos regardless of which keys are present. Leave blank to auto-detect. |
| `GEMINI_IMAGE_MODEL` | Comma-separated model ids tried in order. Defaults to `gemini-3.1-flash-image,gemini-2.5-flash-image`. |
| `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY` | Override the OpenAI model or quality. |
| `MOCK_AI` | Set to `1` to run without keys. |
| `PORT` | Defaults to 3000. |

Claude does not generate images, so that feature needs a separate account. The app rejects an Anthropic key in either image slot with an explanation rather than forwarding it.

**Image generation turns itself off if it cannot run.** A key that looks valid says nothing about whether the account can bill for images, so the first plan-blocked request latches generation off and records it in `data/imagegen-off.json`. The header and the controls update immediately. Setting `IMAGE_PROVIDER` explicitly clears the latch, which is how you re-enable it after turning on billing.

**Gemini image generation requires billing.** Google's free tier grants zero quota for every image model, so a free key returns a 429 reading `limit: 0` no matter how long you wait. Enable billing on the key's Google project. Images cost roughly four cents each. Uploading photos needs no image key at all.

`lib/imagegen.js` holds both providers behind `generateImage({ prompt, orientation })` and `imageGenStatus()`. Gemini model ids are tried in order, so a renamed model falls through to the next rather than hard-failing.

## Where files go

Everything is local and gitignored: `data/images/` (uploads and generations), `data/exports/` (rendered PNGs), `data/posts/` (saved drafts as JSON), `data/brief.json` (your edited brief).

## Layout

- `server.js` Express API and static hosting
- `lib/claude.js` Claude prompts and structured output schemas
- `lib/imagegen.js` image generation adapter
- `public/` the single-page interface and canvas composer
