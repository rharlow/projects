import "./lib/env.js";
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { generatePostPackage, rewriteCopy, suggestAngles } from "./lib/claude.js";
import { generateImage, imageGenStatus } from "./lib/imagegen.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(here, "data");
const IMAGES = path.join(DATA, "images");
const EXPORTS = path.join(DATA, "exports");
const POSTS = path.join(DATA, "posts");
const BRIEF = path.join(DATA, "brief.json");
const BRIEF_DEFAULT = path.join(DATA, "brief.default.json");

for (const d of [IMAGES, EXPORTS, POSTS]) await fs.mkdir(d, { recursive: true });

const app = express();
app.use(express.json({ limit: "25mb" }));
app.use(express.static(path.join(here, "public")));
app.use("/images", express.static(IMAGES));
app.use("/exports", express.static(EXPORTS));

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

async function readBrief() {
  try {
    return JSON.parse(await fs.readFile(BRIEF, "utf8"));
  } catch {
    return JSON.parse(await fs.readFile(BRIEF_DEFAULT, "utf8"));
  }
}

app.get("/api/status", wrap(async (_req, res) => {
  res.json({
    claude: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
    claudeModel: process.env.CLAUDE_MODEL || "claude-opus-5",
    image: imageGenStatus(),
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
  const { angle, notes, variantSeed } = req.body || {};
  if (!angle || !angle.trim()) return res.status(400).json({ error: "Pick or write an angle first." });
  const brief = await readBrief();
  res.json(await generatePostPackage({ brief, angle, notes, variantSeed }));
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

app.post("/api/images/generate", wrap(async (req, res) => {
  const { prompt, orientation } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "An image prompt is required." });
  const { buffer } = await generateImage({ prompt, orientation });
  const name = `${id()}.png`;
  await fs.writeFile(path.join(IMAGES, name), buffer);
  res.json({ url: `/images/${name}`, source: "generated", prompt });
}));

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

app.post("/api/exports", wrap(async (req, res) => {
  const { dataUrl, name } = req.body || {};
  const m = /^data:image\/png;base64,(.+)$/.exec(dataUrl || "");
  if (!m) return res.status(400).json({ error: "Expected a PNG data URL." });
  const safe = (name || "post").replace(/[^a-z0-9_-]/gi, "_").slice(0, 60);
  const file = `${safe}-${id()}.png`;
  await fs.writeFile(path.join(EXPORTS, file), Buffer.from(m[1], "base64"));
  res.json({ url: `/exports/${file}` });
}));

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`Hawaii Course social builder: http://localhost:${port}`));
