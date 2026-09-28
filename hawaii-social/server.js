import "./lib/env.js";
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { generatePostPackage, rewriteCopy, suggestAngles } from "./lib/claude.js";

const here = path.dirname(fileURLToPath(import.meta.url));
// DATA_DIR points at the host's persistent disk. Locally it defaults to ./data.
const DATA = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(here, "data");
const IMAGES = path.join(DATA, "images");
const POSTS = path.join(DATA, "posts");
const BRIEF = path.join(DATA, "brief.json");
// The default facts ship with the code, outside the data folder, so mounting a
// disk over the data folder cannot hide them.
const BRIEF_DEFAULT = path.join(here, "config", "brief.default.json");

for (const d of [IMAGES, POSTS]) await fs.mkdir(d, { recursive: true });

/* ---------- Team password ----------
   One shared password for the course staff. Signing in sets a cookie that lasts
   30 days. The cookie is derived from the password, so changing TEAM_PASSWORD
   signs everyone out. With no password set, the app is open, which is fine on
   your own computer. On a hosting service it refuses to run open. */
const TEAM_PASSWORD = process.env.TEAM_PASSWORD || "";
const HOSTED = Boolean(process.env.RAILWAY_PROJECT_ID || process.env.RAILWAY_ENVIRONMENT_NAME || process.env.RAILWAY_ENVIRONMENT || process.env.REQUIRE_PASSWORD === "1");
const COOKIE = "hs_session";
const sessionToken = () => crypto.createHmac("sha256", TEAM_PASSWORD).update("hawaii-social-session-v1").digest("hex");
const sameSecret = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};
const readCookie = (req, name) => {
  for (const part of (req.headers.cookie || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return "";
};
const PUBLIC_PATHS = new Set(["/login", "/favicon.ico", "/favicon-32.png", "/apple-touch-icon.png"]);

function page(title, body) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title><link rel="icon" href="/favicon.ico" sizes="any">
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; font: 16px/1.5 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; background: #f4f6f8; color: #15212c; }
  @media (prefers-color-scheme: dark) { body { background: #0f1418; color: #e8edf1; } .card { background: #172027 !important; border-color: #2c3740 !important; } input { background: #0f1418 !important; color: #e8edf1 !important; border-color: #2c3740 !important; } }
  .card { width: min(380px, 90vw); background: #fff; border: 1px solid #d9e0e6; border-radius: 12px; padding: 28px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; font-size: 17px; }
  label { display: block; font-weight: 600; margin: 0 0 6px; }
  input { width: 100%; box-sizing: border-box; font: inherit; padding: 10px 12px; border: 1px solid #d9e0e6; border-radius: 8px; }
  button { margin-top: 16px; width: 100%; font: inherit; font-weight: 600; padding: 11px; border: 0; border-radius: 8px; background: #0f6f8f; color: #fff; cursor: pointer; }
  .err { color: #b3261e; margin: 10px 0 0; font-size: 15px; }
  p { margin: 0 0 12px; }
</style></head><body><main class="card"><div class="brand"><img src="/favicon-32.png" alt="" width="28" height="28"><span><strong>Hawaii Course</strong> social posts</span></div>${body}</main></body></html>`;
}

function teamPassword() {
  return async (req, res, next) => {
    if (!TEAM_PASSWORD) {
      if (!HOSTED) return next();
      return res.status(503).send(page("Needs a password", "<p>This app needs a team password before anyone can use it online.</p><p>In Railway, open this service's Variables and add one named <strong>TEAM_PASSWORD</strong>. The app restarts on its own.</p>"));
    }
    if (req.path === "/logout") {
      res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`);
      return res.redirect("/login");
    }
    if (req.path === "/login" && req.method === "POST") {
      const body = await new Promise((resolve) => { let d = ""; req.on("data", (c) => { d += c; if (d.length > 4096) req.destroy(); }); req.on("end", () => resolve(d)); });
      const given = new URLSearchParams(body).get("password") || "";
      if (!sameSecret(given, TEAM_PASSWORD)) {
        await new Promise((r) => setTimeout(r, 1000)); // slows down guessing
        return res.status(401).send(page("Sign in", loginForm("That password is not right. Check with the course team and try again.")));
      }
      const secure = req.secure ? "; Secure" : "";
      res.setHeader("Set-Cookie", `${COOKIE}=${sessionToken()}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; SameSite=Lax${secure}`);
      return res.redirect("/");
    }
    const signedIn = sameSecret(readCookie(req, COOKIE), sessionToken());
    if (req.path === "/login") return signedIn ? res.redirect("/") : res.send(page("Sign in", loginForm()));
    if (signedIn || PUBLIC_PATHS.has(req.path)) return next();
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Please sign in again." });
    return res.redirect("/login");
  };
}
const loginForm = (error = "") => `<form method="post" action="/login">
  <label for="pw">Team password</label>
  <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
  ${error ? `<p class="err" role="alert">${error}</p>` : ""}
  <button type="submit">Sign in</button></form>`;

const app = express();
app.set("trust proxy", 1);
app.get("/healthz", (_req, res) => res.type("text").send("ok"));
app.use(teamPassword());
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(here, "public")));
app.use("/images", express.static(IMAGES));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpeg|webp)$/.test(file.mimetype)),
});

const id = () => `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || String(err) });
});

// A saved copy of the facts wins, but fields added to the defaults since it was
// saved (a new page address, say) still come through.
async function readBrief() {
  const defaults = JSON.parse(await fs.readFile(BRIEF_DEFAULT, "utf8"));
  try {
    return { ...defaults, ...JSON.parse(await fs.readFile(BRIEF, "utf8")) };
  } catch {
    return defaults;
  }
}

app.get("/api/status", wrap(async (_req, res) => {
  res.json({
    claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    claudeModel: process.env.CLAUDE_MODEL || "claude-opus-5",
    mock: process.env.MOCK_AI === "1",
  });
}));

app.get("/api/brief", wrap(async (_req, res) => res.json(await readBrief())));
app.put("/api/brief", wrap(async (req, res) => {
  await fs.writeFile(BRIEF, JSON.stringify(req.body, null, 2));
  res.json(req.body);
}));
app.post("/api/brief/reset", wrap(async (_req, res) => {
  await fs.rm(BRIEF, { force: true });
  res.json(await readBrief());
}));

app.post("/api/angles", wrap(async (req, res) => {
  const brief = await readBrief();
  res.json({ angles: await suggestAngles({ brief, count: req.body?.count || 8 }) });
}));

app.post("/api/copy", wrap(async (req, res) => {
  const { angle, notes } = req.body || {};
  if (!angle || !angle.trim()) return res.status(400).json({ error: "Choose a topic or describe one first." });
  const length = Math.min(2000, Math.max(300, Math.round(Number(req.body?.length) || 750)));
  const brief = await readBrief();
  res.json(await generatePostPackage({ brief, angle, notes, length }));
}));

app.post("/api/rewrite", wrap(async (req, res) => {
  const { platform, text, instruction } = req.body || {};
  if (!text || !instruction) return res.status(400).json({ error: "Text and instruction are required." });
  const brief = await readBrief();
  res.json({ text: await rewriteCopy({ brief, platform, text, instruction }) });
}));

const EXT = { "image/png": "png", "image/webp": "webp", "image/jpeg": "jpg" };

app.post("/api/images/upload", upload.array("image", 40), wrap(async (req, res) => {
  const files = req.files || [];
  if (!files.length) return res.status(400).json({ error: "Upload a PNG, JPEG, or WebP." });
  const saved = [];
  for (const f of files) {
    const name = `${id()}.${EXT[f.mimetype] || "jpg"}`;
    await fs.writeFile(path.join(IMAGES, name), f.buffer);
    saved.push({ url: `/images/${name}`, source: "upload", filename: f.originalname });
  }
  // `url` keeps single-file callers working; `saved` carries the whole batch.
  res.json({ ...saved[0], saved, count: saved.length });
}));

app.delete("/api/images/:name", wrap(async (req, res) => {
  const name = path.basename(req.params.name);
  if (!/^[\w.-]+\.(png|jpe?g|webp)$/i.test(name)) return res.status(400).json({ error: "Not an image file." });
  await fs.rm(path.join(IMAGES, name), { force: true });
  res.json({ ok: true });
}));


// The logo placed on every picture. A staff upload lives in data/ and replaces
// the built-in file until someone goes back to it.
const LOGO_META = path.join(DATA, "logo.json");
async function logoInfo() {
  try {
    const meta = JSON.parse(await fs.readFile(LOGO_META, "utf8"));
    await fs.access(path.join(DATA, meta.file));
    return { custom: true, url: `/api/logo/file?v=${encodeURIComponent(meta.uploadedAt)}`, uploadedAt: meta.uploadedAt, name: meta.name };
  } catch {
    return { custom: false, url: "/logo-default.png" };
  }
}
async function removeLogoFiles() {
  for (const f of await fs.readdir(DATA)) if (/^logo\.(png|jpg|webp)$/.test(f)) await fs.rm(path.join(DATA, f), { force: true });
  await fs.rm(LOGO_META, { force: true });
}
app.get("/api/logo", wrap(async (_req, res) => res.json(await logoInfo())));
app.get("/api/logo/file", wrap(async (_req, res) => {
  const meta = JSON.parse(await fs.readFile(LOGO_META, "utf8"));
  res.set("Cache-Control", "no-store").sendFile(path.join(DATA, path.basename(meta.file)));
}));
app.post("/api/logo", upload.single("logo"), wrap(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose a PNG, JPEG, or WebP image for the logo." });
  await removeLogoFiles();
  const file = `logo.${EXT[req.file.mimetype] || "png"}`;
  await fs.writeFile(path.join(DATA, file), req.file.buffer);
  await fs.writeFile(LOGO_META, JSON.stringify({ file, name: req.file.originalname, uploadedAt: new Date().toISOString() }, null, 2));
  res.json(await logoInfo());
}));
app.delete("/api/logo", wrap(async (_req, res) => { await removeLogoFiles(); res.json(await logoInfo()); }));

app.get("/api/images", wrap(async (_req, res) => {
  const files = (await fs.readdir(IMAGES)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const stats = await Promise.all(files.map(async (f) => ({ url: `/images/${f}`, mtime: (await fs.stat(path.join(IMAGES, f))).mtimeMs })));
  res.json({ images: stats.sort((a, b) => b.mtime - a.mtime) });
}));

async function listPosts() {
  const files = (await fs.readdir(POSTS)).filter((f) => f.endsWith(".json"));
  const posts = await Promise.all(files.map(async (f) => JSON.parse(await fs.readFile(path.join(POSTS, f), "utf8"))));
  return posts.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

app.get("/api/posts", wrap(async (_req, res) => res.json({ posts: await listPosts() })));
app.get("/api/posts/:id", wrap(async (req, res) => {
  const file = path.join(POSTS, `${path.basename(req.params.id)}.json`);
  res.json(JSON.parse(await fs.readFile(file, "utf8")));
}));
app.post("/api/posts", wrap(async (req, res) => {
  const post = { ...req.body, id: req.body?.id || id(), updatedAt: new Date().toISOString() };
  post.createdAt = post.createdAt || post.updatedAt;
  await fs.writeFile(path.join(POSTS, `${post.id}.json`), JSON.stringify(post, null, 2));
  res.json(post);
}));
app.delete("/api/posts/:id", wrap(async (req, res) => {
  await fs.rm(path.join(POSTS, `${path.basename(req.params.id)}.json`), { force: true });
  res.json({ ok: true });
}));


const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Hawaii Course social builder: http://localhost:${port}`));
