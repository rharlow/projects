/* Plain-English diagnostic: node check.js  (npm run check) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, ".env");
const shellKey = process.env.ANTHROPIC_API_KEY || "";
const say = (ok, msg) => console.log(`${ok ? "OK  " : "FIX "} ${msg}`);
console.log("\nChecking your setup\n" + "-".repeat(40));

if (!fs.existsSync(envPath)) {
  say(false, "There is no .env file in this folder.");
  console.log("     Run: cp .env.example .env   then put your key in it.\n");
  process.exit(1);
}
say(true, "Found the .env file.");

const raw = fs.readFileSync(envPath, "utf8");
const lines = raw.split(/\r?\n/);
const hits = lines.map((l, i) => [i + 1, l]).filter(([, l]) => /^\s*ANTHROPIC_API_KEY\s*=/.test(l));

if (!hits.length) {
  say(false, "No ANTHROPIC_API_KEY line in .env.");
  console.log("     Add a line that reads:  ANTHROPIC_API_KEY=sk-ant-...\n");
  process.exit(1);
}
if (hits.length > 1) say(false, `There are ${hits.length} ANTHROPIC_API_KEY lines (lines ${hits.map(([n]) => n).join(", ")}). Keep one, delete the rest.`);

let value = hits[hits.length - 1][1].replace(/^\s*ANTHROPIC_API_KEY\s*=/, "");
const hadQuotes = /^\s*["']|["']\s*$/.test(value);
value = value.trim().replace(/^["']|["']$/g, "").trim();

if (hadQuotes) say(false, "The key is wrapped in quotes. Remove the quote marks around it.");
else say(true, "No stray quote marks.");

if (/\s/.test(value)) say(false, "The key has a space or line break inside it. It must be one unbroken string.");
else say(true, "No spaces inside the key.");

if (!value) { say(false, "The key line is empty."); process.exit(1); }
say(true, `Key length is ${value.length} characters, starting "${value.slice(0, 11)}" and ending "${value.slice(-4)}".`);
if (!value.startsWith("sk-ant-")) say(false, 'Anthropic keys start with "sk-ant-". This one does not, so it is probably from somewhere else.');
if (value.length < 40) say(false, "That is far too short for a real key. It was likely cut off when pasted.");

if (shellKey && shellKey !== value) {
  say(false, "Your Terminal already has a DIFFERENT ANTHROPIC_API_KEY set, which was overriding the .env file.");
  console.log("     The app now forces the .env value, so this is handled. Pull the latest code if you have not.");
}

console.log("\nTesting the key against Anthropic ...");
const res = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": value, "anthropic-version": "2023-06-01" },
  body: JSON.stringify({ model: process.env.CLAUDE_MODEL || "claude-opus-5", max_tokens: 8, messages: [{ role: "user", content: "hi" }] }),
}).catch((e) => ({ ok: false, status: 0, text: async () => e.message }));

const bodyText = await res.text().catch(() => "");
if (res.ok) {
  console.log("\nOK   The key works. Start the app with:  npm start\n");
} else if (res.status === 401) {
  console.log("\nFIX  Anthropic rejected the key (401 invalid).");
  console.log("     Most likely the key was mistyped, cut short, or has since been deleted.");
  console.log("     Go to https://console.anthropic.com > API Keys, create a fresh key,");
  console.log("     copy the whole thing, and replace the value in .env.\n");
} else if (res.status === 400 && /credit|balance/i.test(bodyText)) {
  console.log("\nFIX  The key is valid but the account has no credit.");
  console.log("     Add credit at https://console.anthropic.com > Billing.\n");
} else {
  console.log(`\nFIX  Anthropic returned ${res.status}. Full reply below, send it to Claude:\n${bodyText.slice(0, 500)}\n`);
}
