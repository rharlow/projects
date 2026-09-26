/* Hawaii Course social builder: front-end state, API calls, and canvas composer. */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const api = async (url, opts = {}) => {
  const res = await fetch(url, { headers: opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {}, ...opts });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || res.statusText);
  return json;
};
let toastTimer;
function toast(msg, isError = false) {
  const t = $("#toast");
  t.textContent = msg; t.classList.toggle("error", isError); t.classList.remove("hidden");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add("hidden"), isError ? 6000 : 2500);
}
const busy = (id, on) => $(id).classList.toggle("hidden", !on);

const STARTER_ANGLES = [
  { title: "GERD or a mimic?", pitch: "How the course uses esophageal diagnostics to separate GERD from its mimics before anyone operates." },
  { title: "Surgeon versus gastroenterologist", pitch: "The 42-year debate tradition: every lecture followed by real argument between surgeons, gastroenterologists, and pathologists." },
  { title: "Anti-reflux options compared", pitch: "Fundoplication, LINX, TIF, and RefluxStop: what the evidence supports and who should get what." },
  { title: "Barrett's in 2027", pitch: "Surveillance, dysplasia markers, and when to intervene." },
  { title: "Achalasia subtype drives treatment", pitch: "How subtype and stage change the plan, including the sigmoid esophagus." },
  { title: "Small classroom, not a ballroom", pitch: "Why a small-group format beats a 3,000-seat meeting for actually changing practice." },
  { title: "Hotel block fills first", pitch: "Registration is open and the discounted room block goes fast. Practical urgency for planners." },
  { title: "Mornings in class, afternoons on Kaua'i", pitch: "The schedule that makes a week of CME possible with family along." },
];
const SIZES = {
  square: { w: 1080, h: 1080, label: "square" },
  portrait: { w: 1080, h: 1350, label: "portrait" },
  link: { w: 1200, h: 628, label: "link" },
  story: { w: 1080, h: 1920, label: "story" },
};

const state = {
  id: null, createdAt: null,
  brief: null,
  status: null,
  angle: "", notes: "", angleTitle: "",
  platform: "linkedin",
  copy: { linkedin: blankCopy(), facebook: blankCopy(), instagram: blankCopy() },
  imageUrl: null, imageSource: null,
  img: null, logo: null, logoUrl: null,
  overlay: { headline: "", subline: "", footer: "", layout: "gradient", accent: "#0f6f8f", text: "#ffffff", scale: 100, fx: 50, fy: 50, size: "square", topScrim: 0, bottomScrim: 82, shade: "#000000", logoScale: 22, logoPos: "tr" },
  variant: 0,
};
function blankCopy() { return { body: "", hashtags: "", altText: "" }; }

/* ---------- Brief ---------- */
const BRIEF_FIELDS = [
  ["shortName", "Short name"], ["courseName", "Full course name"], ["edition", "Edition"], ["dates", "Dates"], ["venue", "Venue"],
  ["island", "Island"], ["directors", "Directors", "textarea"], ["founders", "History", "textarea"], ["audience", "Audience", "textarea"],
  ["goal", "Goal of these posts", "textarea"], ["sellingPoints", "Selling points (one per line)", "lines"], ["registrationFee", "Registration fee"],
  ["websiteUrl", "Website URL"], ["registrationUrl", "Registration URL"], ["contactEmail", "Contact email"], ["voice", "Voice rules", "textarea"],
  ["hashtags", "Preferred hashtags (space separated)", "tags"], ["pastPosts", "Past posts to match voice (paste text, separate with a blank line)", "textarea"],
];
function renderBrief() {
  const f = $("#brief-form"); f.innerHTML = "";
  for (const [key, label, kind] of BRIEF_FIELDS) {
    const l = document.createElement("label"); l.textContent = label;
    const el = document.createElement(kind === "textarea" || kind === "lines" ? "textarea" : "input");
    el.name = key;
    const v = state.brief[key];
    el.value = kind === "lines" ? (v || []).join("\n") : kind === "tags" ? (v || []).join(" ") : (v || "");
    if (el.tagName === "TEXTAREA") el.rows = kind === "lines" ? 8 : 4;
    l.appendChild(el); f.appendChild(l);
  }
}
function readBriefForm() {
  const b = { ...state.brief };
  for (const [key, , kind] of BRIEF_FIELDS) {
    const v = $(`#brief-form [name=${key}]`).value;
    b[key] = kind === "lines" ? v.split("\n").map((s) => s.trim()).filter(Boolean) : kind === "tags" ? v.split(/\s+/).filter(Boolean) : v;
  }
  return b;
}
$("#brief-save").onclick = async () => {
  try { state.brief = await api("/api/brief", { method: "PUT", body: JSON.stringify(readBriefForm()) }); applyBriefDefaults(); toast("Brief saved"); }
  catch (e) { toast(e.message, true); }
};
$("#brief-reset").onclick = async () => {
  if (!confirm("Reset the brief to the built-in defaults?")) return;
  state.brief = await api("/api/brief/reset", { method: "POST" }); renderBrief(); applyBriefDefaults(); toast("Brief reset");
};
function applyBriefDefaults() {
  const b = state.brief;
  if (!state.overlay.footer) state.overlay.footer = b.brand?.footer || "foregutdiseasefoundation.org";
  if (b.brand?.accent) state.overlay.accent = b.brand.accent;
  syncOverlayInputs(); updateLink(); render();
}

/* ---------- Angles ---------- */
function renderAngles(list) {
  const box = $("#angles"); box.innerHTML = "";
  for (const a of list) {
    const c = document.createElement("button"); c.type = "button"; c.className = "chip"; c.textContent = a.title; c.title = a.pitch;
    c.onclick = () => { $$(".chip").forEach((x) => x.classList.remove("active")); c.classList.add("active"); state.angleTitle = a.title; $("#angle").value = /[.?!]$/.test(a.title) ? `${a.title} ${a.pitch}` : `${a.title}. ${a.pitch}`; state.angle = $("#angle").value; };
    box.appendChild(c);
  }
}
$("#btn-angles").onclick = async () => {
  const btn = $("#btn-angles"); btn.disabled = true; btn.textContent = "Thinking…";
  try { const { angles } = await api("/api/angles", { method: "POST", body: JSON.stringify({ count: 8 }) }); renderAngles([...angles, ...STARTER_ANGLES]); toast("New angles added"); }
  catch (e) { toast(e.message, true); }
  finally { btn.disabled = false; btn.textContent = "Suggest angles with Claude"; }
};
$("#angle").oninput = (e) => (state.angle = e.target.value);
$("#notes").oninput = (e) => (state.notes = e.target.value);

/* ---------- Copy ---------- */
async function generate(variant) {
  state.angle = $("#angle").value.trim(); state.notes = $("#notes").value.trim();
  if (!state.angle) return toast("Pick or write an angle first.", true);
  busy("#copy-busy", true); $("#btn-copy").disabled = true; $("#btn-variant").disabled = true;
  try {
    if (variant) state.variant += 1;
    const pkg = await api("/api/copy", { method: "POST", body: JSON.stringify({ angle: state.angle, notes: state.notes, variantSeed: variant ? `${Date.now()}-${state.variant}` : undefined }) });
    for (const p of ["linkedin", "facebook", "instagram"]) {
      state.copy[p] = { body: pkg[p].body, hashtags: pkg[p].hashtags.join(" "), altText: pkg[p].altText };
    }
    state.angleTitle = pkg.angleTitle;
    state.overlay.headline = pkg.headline; state.overlay.subline = pkg.subline;
    syncOverlayInputs(); showPlatform(state.platform); render();
    toast(`Copy written with ${pkg.model}`);
  } catch (e) { toast(e.message, true); }
  finally { busy("#copy-busy", false); $("#btn-copy").disabled = false; $("#btn-variant").disabled = false; }
}
$("#btn-copy").onclick = () => generate(false);
$("#btn-variant").onclick = () => generate(true);

function showPlatform(p) {
  state.platform = p;
  $$("#platform-tabs .tab").forEach((t) => t.classList.toggle("active", t.dataset.p === p));
  const c = state.copy[p];
  $("#copy-body").value = c.body; $("#copy-tags").value = c.hashtags; $("#copy-alt").value = c.altText;
  updateFinal();
}
$$("#platform-tabs .tab").forEach((t) => (t.onclick = () => showPlatform(t.dataset.p)));
$("#copy-body").oninput = (e) => { state.copy[state.platform].body = e.target.value; updateFinal(); };
$("#copy-tags").oninput = (e) => { state.copy[state.platform].hashtags = e.target.value; updateFinal(); };
$("#copy-alt").oninput = (e) => { state.copy[state.platform].altText = e.target.value; };
$$(".rewrite").forEach((b) => (b.onclick = async () => {
  const text = state.copy[state.platform].body; if (!text) return toast("Nothing to rewrite yet.", true);
  busy("#rewrite-busy", true);
  try { const { text: t } = await api("/api/rewrite", { method: "POST", body: JSON.stringify({ platform: state.platform, text, instruction: b.dataset.i }) }); state.copy[state.platform].body = t; showPlatform(state.platform); }
  catch (e) { toast(e.message, true); }
  finally { busy("#rewrite-busy", false); }
}));

function trackedLink(platform = state.platform) {
  const b = state.brief || {};
  const base = $("#link-target").value === "registration" ? b.registrationUrl : b.websiteUrl;
  if (!base) return "";
  const u = new URL(base);
  u.searchParams.set("utm_source", platform); u.searchParams.set("utm_medium", "social");
  u.searchParams.set("utm_campaign", $("#link-campaign").value.trim() || "hawaii2027");
  return u.toString();
}
function finalText(platform) {
  const c = state.copy[platform]; const link = trackedLink(platform);
  const body = (c.body || "").replace(/\{LINK\}/g, link);
  return c.hashtags ? `${body}\n\n${c.hashtags}` : body;
}
function updateLink() { $("#link-preview").textContent = trackedLink(); updateFinal(); }
function updateFinal() {
  const t = finalText(state.platform); $("#copy-final").textContent = t;
  const n = t.length;
  const limits = { linkedin: 3000, facebook: 63206, instagram: 2200 };
  const target = { linkedin: [1000, 1600], facebook: [500, 900], instagram: [500, 1200] }[state.platform];
  const hard = limits[state.platform];
  const over = n > hard;
  const outside = n < target[0] || n > target[1];
  $("#char-count").textContent = `${n} characters. Target ${target[0]} to ${target[1]}${over ? `. Over the ${state.platform} limit of ${hard.toLocaleString()}` : ""}`;
  $("#char-count").style.color = over ? "var(--danger)" : outside ? "var(--muted)" : "var(--ok)";
}
$("#link-target").onchange = updateLink; $("#link-campaign").oninput = updateLink;
$("#btn-copy-clip").onclick = () => navigator.clipboard.writeText(finalText(state.platform)).then(() => toast("Post copied"));
$("#btn-copy-link").onclick = () => navigator.clipboard.writeText(trackedLink()).then(() => toast("Link copied"));

/* ---------- Images ---------- */
function loadImage(url) {
  return new Promise((resolve, reject) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
}
async function useImage(url, source) {
  try { state.img = await loadImage(url); state.imageUrl = url; state.imageSource = source; $$("#gallery img").forEach((i) => i.classList.toggle("active", i.dataset.url === url)); render(); }
  catch { toast("Could not load that image.", true); }
}
async function refreshGallery() {
  const { images } = await api("/api/images");
  const g = $("#gallery"); g.innerHTML = "";
  $("#gallery-count").textContent = images.length ? `${images.length} photo${images.length === 1 ? "" : "s"}` : "";
  if (!images.length) { g.innerHTML = '<p class="hint">No photos yet. Add some above and they stay here for every future post.</p>'; return; }
  for (const im of images) {
    const fig = document.createElement("figure");
    const i = document.createElement("img");
    i.src = im.url; i.dataset.url = im.url; i.loading = "lazy";
    i.classList.toggle("active", im.url === state.imageUrl);
    i.onclick = () => useImage(im.url, "library");
    const kill = document.createElement("button");
    kill.className = "kill"; kill.textContent = "\u00d7"; kill.title = "Remove from library";
    kill.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Remove this photo from the library? Saved posts that used it will lose their image.")) return;
      try {
        await api(`/api/images/${im.url.split("/").pop()}`, { method: "DELETE" });
        if (state.imageUrl === im.url) { state.img = null; state.imageUrl = null; render(); }
        refreshGallery();
      } catch (err) { toast(err.message, true); }
    };
    fig.append(i, kill); g.appendChild(fig);
  }
}

async function uploadFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
  const skipped = (fileList?.length || 0) - files.length;
  if (!files.length) return toast("Those files are not PNG, JPEG, or WebP.", true);
  const fd = new FormData();
  for (const f of files) fd.append("image", f);
  try {
    const r = await api("/api/images/upload", { method: "POST", body: fd });
    await refreshGallery();
    await useImage(r.url, "upload");
    toast(`Added ${r.count} photo${r.count === 1 ? "" : "s"}${skipped ? `, skipped ${skipped}` : ""}`);
  } catch (err) { toast(err.message, true); }
}
$("#file-input").onchange = async (e) => { await uploadFiles(e.target.files); e.target.value = ""; };

const dz = $("#dropzone");
for (const ev of ["dragenter", "dragover"]) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); });
for (const ev of ["dragleave", "dragend"]) dz.addEventListener(ev, () => dz.classList.remove("over"));
dz.addEventListener("drop", async (e) => { e.preventDefault(); dz.classList.remove("over"); await uploadFiles(e.dataTransfer?.files); });
// Stop a stray drop elsewhere on the page from navigating away from the app.
for (const ev of ["dragover", "drop"]) document.addEventListener(ev, (e) => { if (!dz.contains(e.target)) e.preventDefault(); });
$("#logo-input").onchange = async (e) => {
  const f = e.target.files[0]; if (!f) return;
  const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  state.logo = await loadImage(url); state.logoUrl = url; try { localStorage.setItem("hawaii-logo", url); } catch {}
  render(); e.target.value = "";
};
$("#logo-clear").onclick = () => { state.logo = null; state.logoUrl = null; try { localStorage.removeItem("hawaii-logo"); } catch {} render(); };

/* ---------- Composer ---------- */
const OV_TEXT = ["headline", "subline", "footer", "layout", "accent", "text", "shade", "logoPos"];
const OV_NUM = ["scale", "topScrim", "bottomScrim", "logoScale"];
const OV = [...OV_TEXT, ...OV_NUM];
function syncOverlayInputs() {
  for (const k of OV) $(`#ov-${k}`).value = state.overlay[k];
  $("#focal-x").value = state.overlay.fx; $("#focal-y").value = state.overlay.fy; $("#size").value = state.overlay.size;
}
for (const k of OV) $(`#ov-${k}`).oninput = (e) => { state.overlay[k] = OV_NUM.includes(k) ? Number(e.target.value) : e.target.value; render(); };
$("#focal-x").oninput = (e) => { state.overlay.fx = Number(e.target.value); render(); };
$("#focal-y").oninput = (e) => { state.overlay.fy = Number(e.target.value); render(); };
$("#size").onchange = (e) => { state.overlay.size = e.target.value; render(); };

function wrapLines(ctx, text, maxWidth) {
  const words = (text || "").split(/\s+/).filter(Boolean); const lines = []; let line = "";
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function drawCover(ctx, img, w, h, fx, fy) {
  const s = Math.max(w / img.width, h / img.height); const dw = img.width * s, dh = img.height * s;
  const dx = (w - dw) * (fx / 100), dy = (h - dh) * (fy / 100);
  ctx.drawImage(img, dx, dy, dw, dh);
}
function hexToRgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

function renderTo(canvas, sizeKey) {
  const { w, h } = SIZES[sizeKey]; canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d"); const o = state.overlay;
  ctx.fillStyle = "#0c1a22"; ctx.fillRect(0, 0, w, h);
  if (state.img) drawCover(ctx, state.img, w, h, o.fx, o.fy);
  else { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, o.accent); g.addColorStop(1, "#0c1a22"); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); }

  const base = Math.min(w, h); const k = o.scale / 100;
  const pad = base * 0.07; const maxTextW = w - pad * 2;
  const subSize = base * 0.034 * k; const footSize = base * 0.026 * k;
  const font = (size, weight) => `${weight} ${size}px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif`;
  const top = o.layout === "top";

  // Headline auto-fit: shrink until it fits three lines, so a long headline
  // never runs off the canvas or crowds the subline.
  let headSize = base * 0.072 * k; let headLines = [];
  for (let i = 0; i < 40; i++) {
    ctx.font = font(headSize, 700);
    headLines = wrapLines(ctx, o.headline, maxTextW);
    if (headLines.length <= 3 || headSize <= base * 0.032) break;
    headSize *= 0.94;
  }
  ctx.font = font(subSize, 400); const subLines = wrapLines(ctx, o.subline, maxTextW);
  const blockH = headLines.length * headSize * 1.1 + (subLines.length ? subSize * 0.6 + subLines.length * subSize * 1.3 : 0);
  const footH = o.footer ? footSize * 2.2 : 0;

  // Shading. Top and bottom are independent, so a logo in a bright sky can be
  // darkened without moving the text or changing the layout.
  const shade = o.shade || "#000000";
  const bottomAlpha = (o.layout === "band" ? 0 : o.bottomScrim / 100) * (top ? 0.35 : 1);
  if (bottomAlpha > 0.01) {
    const g = ctx.createLinearGradient(0, h * 0.35, 0, h);
    g.addColorStop(0, hexToRgba(shade, 0)); g.addColorStop(1, hexToRgba(shade, bottomAlpha));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const topAlpha = Math.max(o.topScrim / 100, top ? 0.78 : 0);
  if (topAlpha > 0.01) {
    const g = ctx.createLinearGradient(0, 0, 0, h * (top ? 0.6 : 0.34));
    g.addColorStop(0, hexToRgba(shade, topAlpha)); g.addColorStop(1, hexToRgba(shade, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  if (o.layout === "band") {
    const bandH = blockH + footH + pad * 1.6; ctx.fillStyle = hexToRgba(o.accent, 0.94); ctx.fillRect(0, h - bandH, w, bandH);
  }

  let y = top ? pad : h - pad - footH - blockH;
  ctx.fillStyle = o.text; ctx.textBaseline = "top";
  if (o.layout !== "band") { ctx.shadowColor = "rgba(0,0,0,0.45)"; ctx.shadowBlur = base * 0.012; ctx.shadowOffsetY = base * 0.003; }
  ctx.font = font(headSize, 700);
  for (const l of headLines) { ctx.fillText(l, pad, y); y += headSize * 1.1; }
  if (subLines.length) { y += subSize * 0.6; ctx.font = font(subSize, 400); for (const l of subLines) { ctx.fillText(l, pad, y); y += subSize * 1.3; } }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  if (o.footer) {
    ctx.font = font(footSize, 600); const tw = ctx.measureText(o.footer).width; const ph = footSize * 1.9, pw = tw + footSize * 1.6;
    const fy = top ? y + subSize : h - pad - ph; ctx.fillStyle = o.layout === "band" ? "rgba(255,255,255,0.18)" : hexToRgba(o.accent, 0.95);
    ctx.beginPath(); ctx.roundRect(pad, fy, pw, ph, ph / 2); ctx.fill();
    ctx.fillStyle = o.text; ctx.fillText(o.footer, pad + footSize * 0.8, fy + (ph - footSize) / 2 - footSize * 0.05);
  }

  if (state.logo) {
    // Sized by width, because these logos are wide lockups whose height says
    // little about how large the wordmark actually reads.
    const lw = w * (o.logoScale / 100); const lh = state.logo.height * (lw / state.logo.width);
    const pos = o.logoPos || "tr";
    const atTop = pos.startsWith("t"); const side = pos.slice(1);
    const lx = side === "c" ? (w - lw) / 2 : side === "r" ? w - pad - lw : pad;
    // A bottom logo that is not hard right would sit on the footer pill, so lift it clear.
    const clearsFooter = o.footer && side !== "r";
    const ly = atTop ? pad : h - pad - lh - (clearsFooter ? footH : 0);
    ctx.drawImage(state.logo, lx, ly, lw, lh);
  }
}
function render() { renderTo($("#canvas"), state.overlay.size); }

function slug() { return (state.angleTitle || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "post"; }
function download(canvas, name) { const a = document.createElement("a"); a.download = name; a.href = canvas.toDataURL("image/png"); a.click(); }
$("#btn-download").onclick = () => { download($("#canvas"), `${slug()}-${SIZES[state.overlay.size].label}.png`); };
$("#btn-export-all").onclick = async () => {
  const off = document.createElement("canvas"); const urls = [];
  for (const key of Object.keys(SIZES)) {
    renderTo(off, key); const dataUrl = off.toDataURL("image/png");
    try { const { url } = await api("/api/exports", { method: "POST", body: JSON.stringify({ dataUrl, name: `${slug()}-${SIZES[key].label}` }) }); urls.push(url); } catch (e) { toast(e.message, true); }
    download(off, `${slug()}-${SIZES[key].label}.png`);
  }
  state.exports = urls; $("#export-note").textContent = `Saved ${urls.length} files to data/exports`;
};

/* ---------- Posts ---------- */
function collectPost() {
  return {
    id: state.id, createdAt: state.createdAt, title: state.angleTitle || $("#angle").value.trim().slice(0, 60) || "Untitled",
    angle: $("#angle").value, notes: $("#notes").value, angleTitle: state.angleTitle, copy: state.copy,
    imageUrl: state.imageUrl, imageSource: state.imageSource, overlay: state.overlay,
    linkTarget: $("#link-target").value, campaign: $("#link-campaign").value, exports: state.exports || [],
    final: { linkedin: finalText("linkedin"), facebook: finalText("facebook"), instagram: finalText("instagram") },
  };
}
$("#btn-save").onclick = async () => {
  try { const p = await api("/api/posts", { method: "POST", body: JSON.stringify(collectPost()) }); state.id = p.id; state.createdAt = p.createdAt; await refreshLibrary(); toast("Post saved"); }
  catch (e) { toast(e.message, true); }
};
async function loadPost(p) {
  state.id = p.id; state.createdAt = p.createdAt; state.angleTitle = p.angleTitle || p.title || "";
  $("#angle").value = p.angle || ""; $("#notes").value = p.notes || ""; state.angle = p.angle || ""; state.notes = p.notes || "";
  state.copy = { linkedin: blankCopy(), facebook: blankCopy(), instagram: blankCopy(), ...(p.copy || {}) };
  state.overlay = { ...state.overlay, ...(p.overlay || {}) }; syncOverlayInputs();
  $("#link-target").value = p.linkTarget || "website"; $("#link-campaign").value = p.campaign || "hawaii2027";
  state.exports = p.exports || [];
  state.img = null; state.imageUrl = null; if (p.imageUrl) await useImage(p.imageUrl, p.imageSource);
  showPlatform("linkedin"); updateLink(); render(); window.scrollTo({ top: 0, behavior: "smooth" });
}
function newPost() {
  state.id = null; state.createdAt = null; state.angleTitle = ""; state.variant = 0; state.exports = [];
  state.copy = { linkedin: blankCopy(), facebook: blankCopy(), instagram: blankCopy() };
  $("#angle").value = ""; $("#notes").value = ""; state.angle = state.notes = "";
  state.overlay.headline = ""; state.overlay.subline = ""; syncOverlayInputs(); $$(".chip").forEach((x) => x.classList.remove("active"));
  state.img = null; state.imageUrl = null; showPlatform("linkedin"); render();
}
$("#btn-new").onclick = newPost;
async function refreshLibrary() {
  const { posts } = await api("/api/posts"); const ul = $("#library"); ul.innerHTML = "";
  if (!posts.length) { ul.innerHTML = '<li class="empty">No saved posts yet.</li>'; return; }
  for (const p of posts) {
    const li = document.createElement("li");
    const saved = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
    li.innerHTML = `<span><strong>${escapeHtml(p.title || "Untitled")}</strong><span class="meta">${saved ? `Saved ${saved}` : ""}</span></span><button class="del" title="Delete">×</button>`;
    li.onclick = (e) => { if (!e.target.classList.contains("del")) loadPost(p); };
    li.querySelector(".del").onclick = async (e) => { e.stopPropagation(); if (!confirm(`Delete "${p.title}"?`)) return; await api(`/api/posts/${p.id}`, { method: "DELETE" }); if (state.id === p.id) newPost(); refreshLibrary(); };
    ul.appendChild(li);
  }
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

async function refreshStatus() {
  const st = await api("/api/status");
  state.status = st;
  $("#status").textContent = st.claude ? `Claude ${st.claudeModel}` : "No ANTHROPIC_API_KEY";
  return st;
}

/* ---------- Init ---------- */
(async function init() {
  try {
    await refreshStatus();
    state.brief = await api("/api/brief"); renderBrief(); renderAngles(STARTER_ANGLES);
    try { const l = localStorage.getItem("hawaii-logo"); if (l) { state.logo = await loadImage(l); state.logoUrl = l; } } catch {}
    applyBriefDefaults(); showPlatform("linkedin"); await refreshGallery(); await refreshLibrary();
  } catch (e) { toast(e.message, true); }
})();
