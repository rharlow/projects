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

The screen follows the order the work happens in, with plain labels, for course staff rather than designers.

1. **Pick a topic.** Choose a suggested topic or describe one, and add anything specific to include. **Write the posts** produces LinkedIn, Facebook, and Instagram versions in about 20 seconds.
2. **Check the wording.** Each platform has one text box holding exactly what gets posted: the link and hashtags are already in place. Edit freely, use the Shorter, Stronger opening, More clinical, or Warmer buttons, then press **Copy LinkedIn post** (or Facebook, or Instagram). A check mark on the tab shows which ones you have copied. "Link goes to" switches all three posts between the course website and the registration page. The picture description has its own copy button for the platform's alt text box.
3. **Make the picture.** Add photos by dragging them in, several at once. They stay for future posts. Click one, drag it in the preview to reposition, and edit the headline and second line. The Foundation logo is already in place. **Download picture** saves the current shape: Square for all three platforms, Tall for the Instagram feed, Wide for link previews, or Story. Everything else lives under **Adjust the look**, with a one-click return to the standard look.

Work saves automatically, and saved posts are listed on the left. **Course facts** in the top bar opens the facts every post is written from.

## Course facts

`data/brief.default.json` holds the facts Claude is allowed to use: course name, dates, venue, directors, audience, reasons to attend, addresses, voice, and hashtags. Edit them under **Course facts** in the top bar; your edits go to `data/brief.json` (gitignored). Changing a web address updates the links in the post you have open. Paste past posts into the "Past posts" field so new copy matches the established voice.

Claude is instructed to use only facts in the brief and the angle. It will not invent faculty, talks, or statistics. That makes the brief the ceiling on accuracy: a topic missing from it cannot appear in a post, and a topic in it that is not on the 2027 program can.

## Configuration

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for copy, angles, and rewrites. |
| `CLAUDE_MODEL` | Defaults to `claude-opus-5`. |
| `MOCK_AI` | Set to `1` to run without a key. |
| `PORT` | Defaults to 3000. |

## Where files go

Everything is local and gitignored: `data/images/` (your uploaded photos), `data/posts/` (saved posts as JSON), `data/brief.json` (your edited course facts). Downloaded pictures go to your browser's Downloads folder.

## Layout

- `server.js` Express API and static hosting
- `lib/claude.js` Claude prompts and structured output schemas
- `lib/env.js` loads `.env` ahead of everything else
- `check.js` the plain-English setup checker behind `npm run check`
- `public/` the single-page interface, picture composer, favicon, and the default logo (`logo-default.png`)
