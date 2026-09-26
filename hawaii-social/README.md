# Hawaii Course social builder

A small local web app for producing lead-generation posts for the Foregut Disease Foundation's annual Hawaii course (2027: February 4 to 9, Royal Sonesta Kaua'i). It writes platform-specific copy with Claude, burns a headline and the dates onto your own photos at the right size for each platform, and keeps a library of drafts. Scheduling and posting happen outside the app.

Target reader: surgeons and gastroenterologists who have never attended. Every post ends with a tracked link back to the website or registration page.

## Run it

```bash
cd hawaii-social
cp .env.example .env      # add ANTHROPIC_API_KEY
npm install
npm start                 # http://localhost:3000
```

No key yet? Set `MOCK_AI=1` in `.env` to click through the interface with canned copy.

If the app reports an authentication error, run `npm run check`. It inspects `.env`, reports common mistakes in plain English (quotes around the key, a line break inside it, a duplicate line, a conflicting shell variable), and tests the key against Anthropic. It never prints the key itself.

Values in `.env` take priority over variables already set in your shell.

## What it does

1. **Angle.** Pick a starter angle or ask Claude for eight fresh ones grounded in the brief. Add notes (a faculty name, a session, a deadline).
2. **Copy.** One click writes LinkedIn, Facebook, and Instagram versions with the right length, tone, and hashtag count for each, plus alt text and an overlay headline and subline. Rewrite buttons (shorter, sharper hook, more clinical, warmer) work per platform. The `{LINK}` token is replaced with a UTM-tagged URL per platform in the "Ready to paste" box, and the character counter shows each platform's target range.
3. **Image.** Drag in your own photos, several at once. They stay in a photo library for every future post. The composer overlays the headline, subline, and a footer pill with the website. Top and bottom shades are independent, with their own strength sliders and a shared color. The logo has a size slider and six positions. Long headlines shrink to fit three lines. Export one PNG or all four sizes at once:
   - Square 1080×1080 (Instagram, LinkedIn, Facebook)
   - Portrait 1080×1350 (Instagram feed)
   - Link 1200×628 (LinkedIn and Facebook link cards)
   - Story 1080×1920 (Instagram and Facebook stories)

Save a post to keep it in the library on the left. It reopens with the copy, photo, and composer settings intact.

## The brief

`data/brief.default.json` holds the facts Claude is allowed to use: course name, dates, venue, directors, audience, selling points, URLs, voice rules, and preferred hashtags. Edit it in the sidebar and save; your edits go to `data/brief.json` (gitignored). Paste past posts into the "Past posts" field so new copy matches the established voice.

Claude is instructed to use only facts in the brief and the angle. It will not invent faculty, talks, or statistics. That makes the brief the ceiling on accuracy: a topic missing from it cannot appear in a post, and a topic in it that is not on the 2027 program can.

## Configuration

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for copy, angles, and rewrites. |
| `CLAUDE_MODEL` | Defaults to `claude-opus-5`. |
| `MOCK_AI` | Set to `1` to run without a key. |
| `PORT` | Defaults to 3000. |

## Where files go

Everything is local and gitignored: `data/images/` (your uploaded photos), `data/exports/` (rendered PNGs), `data/posts/` (saved drafts as JSON), `data/brief.json` (your edited brief).

## Layout

- `server.js` Express API and static hosting
- `lib/claude.js` Claude prompts and structured output schemas
- `lib/env.js` loads `.env` ahead of everything else
- `check.js` the plain-English setup checker behind `npm run check`
- `public/` the single-page interface, canvas composer, and favicon
