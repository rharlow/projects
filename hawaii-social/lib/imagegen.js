// Image generation adapter. Two providers are supported:
//
//   gemini  Google Generative Language API. Default when GEMINI_API_KEY is set.
//           Stronger photographic realism, which is what these posts need.
//   openai  gpt-image-1.
//
// Claude does not generate images at all, so an Anthropic key in either slot is
// a category error rather than a typo and is reported as such.
// Set IMAGE_PROVIDER to force one, or leave it unset to auto-detect from keys.

const GEMINI_MODELS = (process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image,gemini-2.5-flash-image")
  .split(",").map((m) => m.trim()).filter(Boolean);

const ASPECT = { landscape: "16:9", square: "1:1", portrait: "4:5" };
const OPENAI_SIZE = { landscape: "1536x1024", square: "1024x1024", portrait: "1024x1536" };

const key = (name) => (process.env[name] || "").trim();

function chooseProvider() {
  const forced = (process.env.IMAGE_PROVIDER || "").trim().toLowerCase();
  if (forced) return forced;
  if (key("GEMINI_API_KEY")) return "gemini";
  if (key("OPENAI_API_KEY")) return "openai";
  return "none";
}

const WRONG = (slot, vendor, where, shape) =>
  `${slot} holds an Anthropic key. Claude cannot generate images, so this needs a separate ${vendor} account. ` +
  `Put a key from ${where} in ${slot} (they look like ${shape}), or leave it blank and upload a photo instead.`;

function keyProblem(provider) {
  const anthropic = key("ANTHROPIC_API_KEY");
  if (provider === "gemini") {
    const k = key("GEMINI_API_KEY");
    if (!k) return "Set GEMINI_API_KEY in .env to generate images, or upload a photo instead.";
    if (k.startsWith("sk-ant-") || (anthropic && k === anthropic)) return WRONG("GEMINI_API_KEY", "Google", "aistudio.google.com/apikey", "AIza...");
    if (k.startsWith("sk-")) return "GEMINI_API_KEY looks like an OpenAI key. Google keys start with AIza. Set IMAGE_PROVIDER=openai if you meant to use OpenAI.";
    return null;
  }
  if (provider === "openai") {
    const k = key("OPENAI_API_KEY");
    if (!k) return "Set OPENAI_API_KEY in .env to generate images, or upload a photo instead.";
    if (k.startsWith("sk-ant-") || (anthropic && k === anthropic)) return WRONG("OPENAI_API_KEY", "OpenAI", "platform.openai.com/api-keys", "sk-proj-...");
    if (!k.startsWith("sk-")) return "OPENAI_API_KEY does not look like an OpenAI key. They start with sk-proj- or sk-.";
    return null;
  }
  return "Image generation is off. Upload a photo instead.";
}

export function imageGenStatus() {
  const provider = chooseProvider();
  if (provider === "none") return { enabled: false, provider, model: null, reason: "No image key set. Upload a photo instead, or add GEMINI_API_KEY to .env." };
  const reason = keyProblem(provider);
  const model = provider === "gemini" ? GEMINI_MODELS[0] : process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  return { enabled: !reason, provider, model, reason };
}

async function readError(res) {
  const text = await res.text().catch(() => "");
  try { const j = JSON.parse(text); return j?.error?.message || text; } catch { return text; }
}

async function generateGemini(prompt, orientation) {
  const apiKey = key("GEMINI_API_KEY");
  let lastErr = "";
  // Model ids move; fall through the list rather than hard-failing on a rename.
  for (const model of GEMINI_MODELS) {
    const base = process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
    const res = await fetch(`${base}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: ASPECT[orientation] || ASPECT.landscape },
        },
      }),
    });
    if (!res.ok) {
      lastErr = `${res.status}: ${await readError(res)}`;
      if (res.status === 404 || res.status === 400) continue; // try the next model id
      throw new Error(`Google rejected the request (${lastErr})`);
    }
    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts || [];
    const img = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const inline = img?.inlineData || img?.inline_data;
    if (!inline) {
      const why = json?.candidates?.[0]?.finishReason || parts.find((p) => p.text)?.text || "no image in the reply";
      lastErr = `${model} returned no image (${String(why).slice(0, 200)})`;
      continue;
    }
    return { buffer: Buffer.from(inline.data, "base64"), mime: inline.mimeType || inline.mime_type || "image/png" };
  }
  throw new Error(`Google could not generate an image. Last response: ${lastErr}`);
}

async function generateOpenAI(prompt, orientation) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Bearer ${key("OPENAI_API_KEY")}` },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt, n: 1,
      size: OPENAI_SIZE[orientation] || OPENAI_SIZE.landscape,
      quality: process.env.OPENAI_IMAGE_QUALITY || "high",
      output_format: "png",
    }),
  });
  if (!res.ok) throw new Error(`OpenAI rejected the request (${res.status}: ${await readError(res)})`);
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image data.");
  return { buffer: Buffer.from(b64, "base64"), mime: "image/png" };
}

export async function generateImage({ prompt, orientation = "landscape" }) {
  const status = imageGenStatus();
  if (!status.enabled) throw new Error(status.reason);
  return status.provider === "gemini" ? generateGemini(prompt, orientation) : generateOpenAI(prompt, orientation);
}
