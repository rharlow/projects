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

1. **Pick a topic.** Choose one of the topics drawn from the 2027 agenda and faculty bios, or describe one, and add anything specific to include. Pick a length: Short (about 500 characters), Good (about 750, recommended), or Long (about 1,000). Length counts everything, including the link and hashtags. **Write the posts** produces LinkedIn, Facebook, and Instagram versions in about 20 seconds.
2. **Check the wording.** Each platform has one text box holding exactly what gets posted, link and hashtags included. Edit freely, or use Shorter, Stronger opening, More clinical, or Warmer. **Copy LinkedIn post** (or Facebook, or Instagram) copies it, and a check on the tab shows which ones you have copied. "Link goes to" switches all three posts between the Home page, the Course page, and the Registration page. The picture description has its own copy button for the platform's alt text box.
3. **Make the picture.** The picture sits on the left and stays in view; the tools sit on the right. Choose a shape (Square for all three platforms, Tall for the Instagram feed, Wide for link previews, or Story), then use the Photo, Text, and Look tabs. Drag the photo in the picture to reposition it. The Foundation logo is already in place. **Download picture** is at the top of the step.
4. **Preview the posts.** An approximation of each post in the LinkedIn, Facebook, and Instagram feeds, using the current wording and picture. Text is cut where each feed cuts it, so you can check the first lines carry the post.

Work saves automatically. A green bar under the top bar confirms each save with the time, then slides away. If a save fails, the bar turns red, stays up, and the app tries again on its own. Saved posts are listed on the left with the date and time each was created and last updated.

The gear at the top right opens the two settings pages:

- **Course facts**, the facts every post is written from.
- **Logo image**, where you upload the logo placed on every picture and see it on a shaded photo and on its own. The upload is stored on this computer, so it applies to every post and every browser. Until you upload one, the app uses the Foundation's white logo file.

## Course facts

`data/brief.default.json` holds the facts Claude is allowed to use: course name, dates, venue, directors, audience, reasons to attend, addresses, voice, and hashtags. Edit them under the gear, in **Course facts**; your edits go to `data/brief.json` (gitignored). Changing a web address updates the links in the post you have open. If you saved Course facts before a new field was added, such as the course page address, the app fills it in from the defaults. Paste past posts into the "Past posts" field so new copy matches the established voice.

Claude is instructed to use only facts in the brief and the angle. It will not invent faculty, talks, or statistics. That makes the brief the ceiling on accuracy: a topic missing from it cannot appear in a post, and a topic in it that is not on the 2027 program can.

## Configuration

| Variable | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Required for copy, angles, and rewrites. |
| `CLAUDE_MODEL` | Defaults to `claude-opus-5`. |
| `MOCK_AI` | Set to `1` to run without a key. |
| `PORT` | Defaults to 3000. |

## Where files go

Everything is local and gitignored: `data/images/` (your uploaded photos), `data/posts/` (saved posts as JSON), `data/brief.json` (your edited course facts), and `data/logo.*` with `data/logo.json` (your uploaded logo). Downloaded pictures go to your browser's Downloads folder.

## Layout

- `server.js` Express API and static hosting
- `lib/claude.js` Claude prompts and structured output schemas
- `lib/env.js` loads `.env` ahead of everything else
- `check.js` the plain-English setup checker behind `npm run check`
- `public/` the single-page interface, picture composer, favicon, and the built-in logo (`logo-default.png`)
