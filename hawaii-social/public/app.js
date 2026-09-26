/* Hawaii Course social posts: front-end state, API calls, autosave, and the picture composer. */
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
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add("hidden"), isError ? 7000 : 3000);
}
const show = (sel, on) => $(sel).classList.toggle("hidden", !on);

const PLATFORMS = ["linkedin", "facebook", "instagram"];
const NAMES = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram" };
// Editorial targets, then each platform's hard limit.
const LENGTH = { linkedin: [1000, 1600, 3000], facebook: [500, 900, 63206], instagram: [500, 1200, 2200] };

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
  square: { w: 1080, h: 1080, file: "square" },
  portrait: { w: 1080, h: 1350, file: "instagram-tall" },
  link: { w: 1200, h: 628, file: "link-preview" },
  story: { w: 1080, h: 1920, file: "story" },
};

// The standard look. "Put everything back" restores these and leaves the words and photo alone.
const STANDARD_LOOK = { layout: "gradient", accent: "#0f6f8f", text: "#ffffff", scale: 100, topScrim: 45, bottomScrim: 82, shade: "#000000", showLogo: true, logoScale: 30, logoPos: "tr" };
const freshOverlay = () => ({ headline: "", subline: "", footer: "", fx: 50, fy: 50, size: "square", ...STANDARD_LOOK });
const blankCopy = () => ({ text: "", altText: "" });
const blankCopies = () => ({ linkedin: blankCopy(), facebook: blankCopy(), instagram: blankCopy() });

const state = {
  id: null, createdAt: null, brief: null,
  angle: "", notes: "", angleTitle: "", variant: 0,
  platform: "linkedin", linkTarget: "website",
  copy: blankCopies(), copied: {},
  imageUrl: null, imageSource: null, img: null, logo: null,
  overlay: freshOverlay(),
};

/* ---------- Autosave ---------- */
// Saves run one after another, so the id assigned by the first save is used by
// every later one and a post is never duplicated.
let saveTimer = null, inFlight = Promise.resolve(), dirty = false, quiet = false;
const hasContent = () => Boolean(state.angle.trim() || state.imageUrl || PLATFORMS.some((p) => state.copy[p].text));
function setSaveState(msg, isError = false) { const s = $("#save-state"); s.textContent = msg; s.classList.toggle("error", isError); }
function markDirty() {
  if (quiet || !hasContent()) return;
  dirty = true; clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; save(); }, 900);
}
function save() { inFlight = inFlight.then(doSave); return inFlight; }
async function doSave() {
  if (!dirty) return;
  dirty = false; setSaveState("Saving…");
  try {
    const p = await api("/api/posts", { method: "POST", body: JSON.stringify(collectPost()) });
    state.id = p.id; state.createdAt = p.createdAt;
    setSaveState("All changes saved");
    refreshLibrary();
  } catch {
    dirty = true; setSaveState("Could not save. Your work is still on screen.", true);
  }
}
async function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } await save(); }
function cancelPendingSave() { clearTimeout(saveTimer); saveTimer = null; dirty = false; }
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

/* ---------- Links ---------- */
function linkFor(platform, target = state.linkTarget, brief = state.brief) {
  const base = target === "registration" ? brief?.registrationUrl : brief?.websiteUrl;
  if (!base) return "";
  const u = new URL(base);
  u.searchParams.set("utm_source", platform); u.searchParams.set("utm_medium", "social");
  u.searchParams.set("utm_campaign", brief?.campaign || "hawaii2027");
  return u.toString();
}
function composeText(body, hashtags, platform, target) {
  const tags = Array.isArray(hashtags) ? hashtags.join(" ") : (hashtags || "");
  const text = (body || "").replace(/\{LINK\}/g, linkFor(platform, target));
  return tags ? `${text}\n\n${tags}` : text;
}
// Swap one set of links for another in all three posts, leaving every other edit alone.
function relink(oldLinks, newLinks) {
  for (const p of PLATFORMS) {
    if (oldLinks[p] && newLinks[p] && oldLinks[p] !== newLinks[p]) state.copy[p].text = state.copy[p].text.split(oldLinks[p]).join(newLinks[p]);
  }
}
const allLinks = (target, brief) => Object.fromEntries(PLATFORMS.map((p) => [p, linkFor(p, target, brief)]));

/* ---------- Course facts ---------- */
const FACT_FIELDS = [
  ["shortName", "Course short name"], ["courseName", "Full course title"], ["edition", "Edition"], ["dates", "Dates"],
  ["venue", "Location"], ["island", "Island"], ["directors", "Course directors", "long"], ["founders", "Course history", "long"],
  ["audience", "Who these posts are for", "long"], ["goal", "What the posts should achieve", "long"],
  ["sellingPoints", "Reasons to attend, one per line", "lines"], ["registrationFee", "Registration fee"],
  ["websiteUrl", "Website address"], ["registrationUrl", "Registration page address"], ["contactEmail", "Contact email"],
  ["voice", "How the posts should sound", "long"], ["hashtags", "Hashtags to use, separated by spaces", "tags"],
  ["pastPosts", "Past posts to match, with a blank line between each", "long"],
];
function renderFacts() {
  const f = $("#facts-form"); f.innerHTML = "";
  for (const [key, label, kind] of FACT_FIELDS) {
    const l = document.createElement("label"); l.textContent = label;
    const long = kind === "long" || kind === "lines";
    const el = document.createElement(long ? "textarea" : "input");
    el.name = key;
    const v = state.brief[key];
    el.value = kind === "lines" ? (v || []).join("\n") : kind === "tags" ? (v || []).join(" ") : (v || "");
    if (long) el.rows = kind === "lines" ? 8 : 3;
    l.appendChild(el); f.appendChild(l);
  }
}
function readFacts() {
  const b = { ...state.brief };
  for (const [key, , kind] of FACT_FIELDS) {
    const v = $(`#facts-form [name=${key}]`).value;
    b[key] = kind === "lines" ? v.split("\n").map((s) => s.trim()).filter(Boolean) : kind === "tags" ? v.split(/\s+/).filter(Boolean) : v;
  }
  return b;
}
async function applyNewBrief(next) {
  const before = allLinks(state.linkTarget, state.brief);
  state.brief = next;
  relink(before, allLinks(state.linkTarget, state.brief));
  showPlatform(state.platform); markDirty();
}
$("#btn-facts").onclick = () => { renderFacts(); $("#facts-dialog").showModal(); };
$("#facts-save").onclick = async () => {
  try {
    await applyNewBrief(await api("/api/brief", { method: "PUT", body: JSON.stringify(readFacts()) }));
    $("#facts-dialog").close(); toast("Course facts saved. New posts will use them.");
  } catch (e) { toast(e.message, true); }
};
$("#facts-reset").onclick = async () => {
  if (!confirm("Replace all the course facts with the original versions? Your changes to them will be lost.")) return;
  try { await applyNewBrief(await api("/api/brief/reset", { method: "POST" })); renderFacts(); toast("Original course facts restored."); }
  catch (e) { toast(e.message, true); }
};

/* ---------- Step 1: topic ---------- */
function renderAngles(list) {
  const box = $("#angles"); box.innerHTML = "";
  for (const a of list) {
    const c = document.createElement("button");
    c.type = "button"; c.className = "chip"; c.textContent = a.title; c.title = a.pitch;
    c.onclick = () => {
      $$(".chip").forEach((x) => x.classList.remove("active")); c.classList.add("active");
      state.angleTitle = a.title;
      $("#angle").value = /[.?!]$/.test(a.title) ? `${a.title} ${a.pitch}` : `${a.title}. ${a.pitch}`;
      state.angle = $("#angle").value; markDirty();
    };
    box.appendChild(c);
  }
}
$("#btn-angles").onclick = async () => {
  const btn = $("#btn-angles"); btn.disabled = true; btn.textContent = "Finding topics…";
  try { const { angles } = await api("/api/angles", { method: "POST", body: JSON.stringify({ count: 8 }) }); renderAngles([...angles, ...STARTER_ANGLES]); toast("New topics added at the front of the list."); }
  catch (e) { toast(e.message, true); }
  finally { btn.disabled = false; btn.textContent = "Suggest more topics"; }
};
$("#angle").oninput = (e) => { state.angle = e.target.value; markDirty(); };
$("#notes").oninput = (e) => { state.notes = e.target.value; markDirty(); };

async function writePosts(variant) {
  state.angle = $("#angle").value.trim(); state.notes = $("#notes").value.trim();
  if (!state.angle) { toast("Choose a topic or describe one first.", true); $("#angle").focus(); return; }
  const had = PLATFORMS.some((p) => state.copy[p].text);
  if (had && !variant && !confirm("Replace the posts you already have with newly written ones?")) return;
  show("#copy-busy", true); $("#btn-copy").disabled = true; $("#btn-variant").disabled = true;
  try {
    if (variant) state.variant += 1;
    const pkg = await api("/api/copy", { method: "POST", body: JSON.stringify({ angle: state.angle, notes: state.notes, variantSeed: variant ? `${Date.now()}-${state.variant}` : undefined }) });
    for (const p of PLATFORMS) state.copy[p] = { text: composeText(pkg[p].body, pkg[p].hashtags, p), altText: pkg[p].altText };
    state.copied = {};
    state.angleTitle = pkg.angleTitle;
    state.overlay.headline = pkg.headline; state.overlay.subline = pkg.subline;
    syncLookInputs(); showPlatform("linkedin"); render(); markDirty();
    toast("Posts written. Read them over in step 2.");
    $("#copy-area").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) { toast(e.message, true); }
  finally { show("#copy-busy", false); $("#btn-copy").disabled = false; $("#btn-variant").disabled = false; }
}
$("#btn-copy").onclick = () => writePosts(false);
$("#btn-variant").onclick = () => writePosts(true);

/* ---------- Step 2: wording ---------- */
function showPlatform(p) {
  state.platform = p;
  const has = PLATFORMS.some((x) => state.copy[x].text);
  show("#copy-empty", !has); show("#copy-area", has); show("#btn-variant", has);
  $$("#platform-tabs .tab").forEach((t) => {
    t.classList.toggle("active", t.dataset.p === p);
    t.setAttribute("aria-selected", t.dataset.p === p);
    t.classList.toggle("copied", Boolean(state.copied[t.dataset.p]));
  });
  $("#copy-text").value = state.copy[p].text;
  $("#copy-alt").value = state.copy[p].altText;
  $("#btn-copy-post").textContent = `Copy ${NAMES[p]} post`;
  show("#btn-copy-link", p === "instagram");
  $("#link-target").value = state.linkTarget;
  updateLength();
}
function updateLength() {
  const p = state.platform, text = state.copy[p].text, n = text.length;
  const [lo, hi, hard] = LENGTH[p];
  const el = $("#length-note");
  let msg, cls;
  if (text && !text.includes(linkFor(p))) { msg = "The link to the course website is missing from this post."; cls = "bad"; }
  else if (n > hard) { msg = `Too long for ${NAMES[p]}. Remove about ${(n - hard).toLocaleString()} characters.`; cls = "bad"; }
  else if (n < lo) { msg = "A little short"; cls = "meh"; }
  else if (n > hi) { msg = "A little long"; cls = "meh"; }
  else { msg = "Good length"; cls = "good"; }
  el.textContent = n ? `${msg} · ${n.toLocaleString()} characters` : "";
  el.className = `length-note ${cls}`;
}
$$("#platform-tabs .tab").forEach((t) => (t.onclick = () => showPlatform(t.dataset.p)));
$("#copy-text").oninput = (e) => {
  state.copy[state.platform].text = e.target.value;
  if (state.copied[state.platform]) { state.copied[state.platform] = false; showPlatform(state.platform); }
  updateLength(); markDirty();
};
$("#copy-alt").oninput = (e) => { state.copy[state.platform].altText = e.target.value; markDirty(); };
$("#link-target").onchange = (e) => {
  const before = allLinks(state.linkTarget); state.linkTarget = e.target.value;
  relink(before, allLinks(state.linkTarget));
  showPlatform(state.platform); markDirty();
  toast(`All three posts now link to the ${state.linkTarget === "registration" ? "registration page" : "course website"}.`);
};
$$(".rewrite").forEach((b) => (b.onclick = async () => {
  const p = state.platform, link = linkFor(p), text = state.copy[p].text;
  if (!text) return;
  show("#rewrite-busy", true); $$(".rewrite").forEach((x) => (x.disabled = true));
  try {
    const { text: t } = await api("/api/rewrite", { method: "POST", body: JSON.stringify({ platform: p, text: text.split(link).join("{LINK}"), instruction: b.dataset.i }) });
    state.copy[p].text = t.replace(/\{LINK\}/g, link); state.copied[p] = false;
    showPlatform(p); markDirty();
  } catch (e) { toast(e.message, true); }
  finally { show("#rewrite-busy", false); $$(".rewrite").forEach((x) => (x.disabled = false)); }
}));

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand("copy"); ta.remove(); return ok;
  }
}
function flashButton(btn, label) { const was = btn.textContent; btn.textContent = label; setTimeout(() => { btn.textContent = was; }, 1600); }
$("#btn-copy-post").onclick = async () => {
  const p = state.platform;
  if (!(await copyText(state.copy[p].text))) return toast("Could not copy. Select the text and copy it by hand.", true);
  state.copied[p] = true; showPlatform(p); markDirty();
  flashButton($("#btn-copy-post"), "Copied");
  toast(`${NAMES[p]} post copied. Paste it into ${NAMES[p]}.`);
};
$("#btn-copy-link").onclick = async () => { if (await copyText(linkFor("instagram"))) { flashButton($("#btn-copy-link"), "Link copied"); toast("Link copied. Paste it into your Instagram bio."); } };
$("#btn-copy-alt").onclick = async () => { if (await copyText($("#copy-alt").value)) flashButton($("#btn-copy-alt"), "Copied"); };

/* ---------- Step 3: photos ---------- */
function loadImage(url) {
  return new Promise((resolve, reject) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
}
async function useImage(url, source, { keepFocus = false } = {}) {
  try {
    state.img = await loadImage(url); state.imageUrl = url; state.imageSource = source;
    if (!keepFocus) { state.overlay.fx = 50; state.overlay.fy = 50; }
    $$("#gallery img").forEach((i) => i.classList.toggle("active", i.dataset.url === url));
    show("#drag-hint", true); $("#canvas").classList.add("draggable");
    render(); markDirty();
  } catch { toast("That photo could not be opened.", true); }
}
async function refreshGallery() {
  const { images } = await api("/api/images");
  const g = $("#gallery"); g.innerHTML = "";
  if (!images.length) { g.innerHTML = '<p class="empty">No photos yet.</p>'; return; }
  for (const im of images) {
    const fig = document.createElement("figure");
    const i = document.createElement("img");
    i.src = im.url; i.dataset.url = im.url; i.loading = "lazy"; i.alt = "Photo";
    i.classList.toggle("active", im.url === state.imageUrl);
    i.onclick = () => useImage(im.url, "library");
    const kill = document.createElement("button");
    kill.type = "button"; kill.className = "kill"; kill.textContent = "×"; kill.title = "Remove this photo"; kill.setAttribute("aria-label", "Remove this photo");
    kill.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Remove this photo? Any saved post that uses it will lose its picture.")) return;
      try {
        await api(`/api/images/${im.url.split("/").pop()}`, { method: "DELETE" });
        if (state.imageUrl === im.url) { state.img = null; state.imageUrl = null; show("#drag-hint", false); $("#canvas").classList.remove("draggable"); render(); markDirty(); }
        refreshGallery();
      } catch (err) { toast(err.message, true); }
    };
    fig.append(i, kill); g.appendChild(fig);
  }
}
async function uploadFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => /^image\/(png|jpeg|webp)$/.test(f.type));
  const skipped = (fileList?.length || 0) - files.length;
  if (!files.length) return toast("Those files are not photos this app can use. Use JPEG, PNG, or WebP.", true);
  const fd = new FormData();
  for (const f of files) fd.append("image", f);
  try {
    const r = await api("/api/images/upload", { method: "POST", body: fd });
    await refreshGallery(); await useImage(r.url, "upload");
    toast(`Added ${r.count} photo${r.count === 1 ? "" : "s"}${skipped ? `. Skipped ${skipped} that were not photos` : ""}.`);
  } catch (err) { toast(err.message, true); }
}
$("#file-input").onchange = async (e) => { await uploadFiles(e.target.files); e.target.value = ""; };
const dz = $("#dropzone");
for (const ev of ["dragenter", "dragover"]) dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add("over"); });
for (const ev of ["dragleave", "dragend"]) dz.addEventListener(ev, () => dz.classList.remove("over"));
dz.addEventListener("drop", async (e) => { e.preventDefault(); dz.classList.remove("over"); await uploadFiles(e.dataTransfer?.files); });
// Stop a stray drop elsewhere on the page from navigating away from the app.
for (const ev of ["dragover", "drop"]) document.addEventListener(ev, (e) => { if (!dz.contains(e.target)) e.preventDefault(); });

/* ---------- Step 3: the look ---------- */
const LOOK_TEXT = ["headline", "subline", "footer", "layout", "accent", "text", "shade", "logoPos"];
const LOOK_NUM = ["scale", "topScrim", "bottomScrim", "logoScale"];
function syncLookInputs() {
  for (const k of [...LOOK_TEXT, ...LOOK_NUM]) $(`#ov-${k}`).value = state.overlay[k];
  $("#ov-showLogo").checked = state.overlay.showLogo !== false;
  $$(".size").forEach((b) => { const on = b.dataset.size === state.overlay.size; b.classList.toggle("active", on); b.setAttribute("aria-checked", on); });
}
for (const k of [...LOOK_TEXT, ...LOOK_NUM]) $(`#ov-${k}`).oninput = (e) => { state.overlay[k] = LOOK_NUM.includes(k) ? Number(e.target.value) : e.target.value; render(); markDirty(); };
$("#ov-showLogo").onchange = (e) => { state.overlay.showLogo = e.target.checked; render(); markDirty(); };
$$(".size").forEach((b) => (b.onclick = () => { state.overlay.size = b.dataset.size; syncLookInputs(); render(); markDirty(); }));
$("#btn-reset-look").onclick = () => { Object.assign(state.overlay, STANDARD_LOOK); syncLookInputs(); render(); markDirty(); };

// Drag the photo to reposition it inside the frame.
(() => {
  const cv = $("#canvas"); let drag = null;
  cv.addEventListener("pointerdown", (e) => {
    if (!state.img) return;
    const { w, h } = SIZES[state.overlay.size];
    const s = Math.max(w / state.img.width, h / state.img.height);
    drag = { x: e.clientX, y: e.clientY, fx: state.overlay.fx, fy: state.overlay.fy,
             ox: state.img.width * s - w, oy: state.img.height * s - h, ratio: w / cv.getBoundingClientRect().width };
    cv.setPointerCapture(e.pointerId); cv.classList.add("dragging");
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = (e.clientX - drag.x) * drag.ratio, dy = (e.clientY - drag.y) * drag.ratio;
    const clamp = (v) => Math.max(0, Math.min(100, v));
    if (drag.ox > 0) state.overlay.fx = clamp(drag.fx - (dx / drag.ox) * 100);
    if (drag.oy > 0) state.overlay.fy = clamp(drag.fy - (dy / drag.oy) * 100);
    render();
  });
  const end = () => { if (!drag) return; drag = null; cv.classList.remove("dragging"); markDirty(); };
  cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
})();

function wrapLines(ctx, text, maxWidth) {
  const words = (text || "").split(/\s+/).filter(Boolean); const lines = []; let line = "";
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (ctx.measureText(t).width > maxWidth && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function drawCover(ctx, img, w, h, fx, fy) {
  const s = Math.max(w / img.width, h / img.height); const dw = img.width * s, dh = img.height * s;
  ctx.drawImage(img, (w - dw) * (fx / 100), (h - dh) * (fy / 100), dw, dh);
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

  // Headline auto-fit: shrink until it fits three lines.
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

  const shade = o.shade || "#000000";
  const noShade = o.layout === "none";
  const bottomAlpha = (o.layout === "band" || noShade ? 0 : o.bottomScrim / 100) * (top ? 0.35 : 1);
  if (bottomAlpha > 0.01) {
    const g = ctx.createLinearGradient(0, h * 0.35, 0, h);
    g.addColorStop(0, hexToRgba(shade, 0)); g.addColorStop(1, hexToRgba(shade, bottomAlpha));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const topAlpha = noShade ? 0 : Math.max(o.topScrim / 100, top ? 0.78 : 0);
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

  if (state.logo && o.showLogo !== false) {
    // Sized by width, because the lockup is wide and its height says little about how large it reads.
    const lw = w * (o.logoScale / 100); const lh = state.logo.height * (lw / state.logo.width);
    const pos = o.logoPos || "tr"; const atTop = pos.startsWith("t"); const side = pos.slice(1);
    const lx = side === "c" ? (w - lw) / 2 : side === "r" ? w - pad - lw : pad;
    const ly = atTop ? pad : h - pad - lh - (o.footer && side !== "r" ? footH : 0);
    ctx.drawImage(state.logo, lx, ly, lw, lh);
  }
}
function render() { renderTo($("#canvas"), state.overlay.size); }

const slug = () => (state.angleTitle || state.angle || "post").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "post";
function download(canvas, name) { const a = document.createElement("a"); a.download = name; a.href = canvas.toDataURL("image/png"); a.click(); }
$("#btn-download").onclick = () => {
  download($("#canvas"), `${slug()}-${SIZES[state.overlay.size].file}.png`);
  toast("Picture downloaded. You will find it in your Downloads folder.");
};
$("#btn-download-all").onclick = async () => {
  toast("Downloading four pictures. If your browser asks, choose Allow.");
  const off = document.createElement("canvas");
  for (const key of Object.keys(SIZES)) {
    renderTo(off, key); download(off, `${slug()}-${SIZES[key].file}.png`);
    await new Promise((r) => setTimeout(r, 350)); // spaced out so browsers do not drop any
  }
};

/* ---------- Saved posts ---------- */
function collectPost() {
  return {
    id: state.id, createdAt: state.createdAt,
    title: state.angleTitle || state.angle.trim().split(/[.?!\n]/)[0].slice(0, 60) || "Untitled post",
    angle: state.angle, notes: state.notes, angleTitle: state.angleTitle,
    copy: state.copy, copied: state.copied, linkTarget: state.linkTarget,
    imageUrl: state.imageUrl, imageSource: state.imageSource, overlay: state.overlay,
  };
}
function migrateCopy(p) {
  // Posts saved before the single-text-box change kept body, hashtags, and {LINK} apart.
  const out = blankCopies();
  for (const k of PLATFORMS) {
    const c = p.copy?.[k] || {};
    out[k] = c.text !== undefined ? { text: c.text, altText: c.altText || "" }
      : { text: c.body ? composeText(c.body, c.hashtags, k, p.linkTarget || "website") : "", altText: c.altText || "" };
  }
  return out;
}
async function loadPost(p) {
  await flush();
  quiet = true;
  state.id = p.id; state.createdAt = p.createdAt; state.angleTitle = p.angleTitle || p.title || "";
  state.angle = p.angle || ""; state.notes = p.notes || "";
  $("#angle").value = state.angle; $("#notes").value = state.notes;
  $$(".chip").forEach((x) => x.classList.toggle("active", x.textContent === state.angleTitle));
  state.linkTarget = p.linkTarget || "website";
  state.copy = migrateCopy(p); state.copied = p.copied || {};
  state.overlay = { ...freshOverlay(), footer: defaultFooter(), ...(p.overlay || {}) };
  syncLookInputs();
  state.img = null; state.imageUrl = null; show("#drag-hint", false); $("#canvas").classList.remove("draggable");
  if (p.imageUrl) await useImage(p.imageUrl, p.imageSource, { keepFocus: true });
  showPlatform("linkedin"); render();
  quiet = false;
  setSaveState("All changes saved"); highlightCurrent();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
async function newPost() {
  await flush();
  resetToBlank();
  toast("Ready for a new post.");
  $("#angle").focus();
}
function resetToBlank() {
  quiet = true;
  state.id = null; state.createdAt = null; state.angleTitle = ""; state.variant = 0;
  state.angle = ""; state.notes = ""; $("#angle").value = ""; $("#notes").value = "";
  state.copy = blankCopies(); state.copied = {}; state.linkTarget = "website";
  state.overlay = { ...freshOverlay(), footer: defaultFooter() };
  state.img = null; state.imageUrl = null; state.imageSource = null;
  $$(".chip").forEach((x) => x.classList.remove("active"));
  $$("#gallery img").forEach((i) => i.classList.remove("active"));
  show("#drag-hint", false); $("#canvas").classList.remove("draggable");
  syncLookInputs(); showPlatform("linkedin"); render();
  quiet = false;
  setSaveState(""); highlightCurrent();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
$("#btn-new").onclick = newPost;

function savedWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `Today at ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function highlightCurrent() { $$("#library li[data-id]").forEach((li) => li.classList.toggle("current", li.dataset.id === state.id)); }
async function refreshLibrary() {
  const { posts } = await api("/api/posts"); const ul = $("#library"); ul.innerHTML = "";
  if (!posts.length) { ul.innerHTML = '<li class="empty">Nothing saved yet. Your first post will appear here as soon as you start it.</li>'; return; }
  for (const p of posts) {
    const li = document.createElement("li"); li.dataset.id = p.id;
    const done = PLATFORMS.filter((k) => p.copied?.[k]).length;
    li.innerHTML = `<span><span class="title">${escapeHtml(p.title || "Untitled post")}</span><span class="meta">${savedWhen(p.updatedAt)}${done ? ` · copied ${done} of 3` : ""}</span></span><button type="button" class="del" title="Delete this post" aria-label="Delete this post">×</button>`;
    li.onclick = (e) => { if (!e.target.classList.contains("del") && p.id !== state.id) loadPost(p); };
    li.querySelector(".del").onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
      if (p.id === state.id) { cancelPendingSave(); await inFlight; }
      await api(`/api/posts/${p.id}`, { method: "DELETE" });
      if (p.id === state.id) resetToBlank();
      refreshLibrary();
    };
    ul.appendChild(li);
  }
  highlightCurrent();
}
function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
const defaultFooter = () => state.brief?.brand?.footer || "foregutdiseasefoundation.org";

/* ---------- Start ---------- */
(async function init() {
  try {
    const st = await api("/api/status");
    if (st.mock) { $("#banner").textContent = "Practice mode. The posts you get are sample text, not real writing."; show("#banner", true); }
    else if (!st.claude) { $("#banner").textContent = "The writing assistant is not connected, so Write the posts will not work yet. In Terminal, run npm run check to see why."; show("#banner", true); }
    state.brief = await api("/api/brief");
    renderAngles(STARTER_ANGLES);
    try { state.logo = await loadImage("logo-default.png"); } catch {}
    state.overlay.footer = defaultFooter();
    syncLookInputs(); showPlatform("linkedin"); render();
    await refreshGallery(); await refreshLibrary();
  } catch (e) { toast(e.message, true); }
})();
