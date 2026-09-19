// Image generation adapter. Default provider is OpenAI's gpt-image-1 because it
// produces clean editorial photography and honors "no text" reliably.
// Set IMAGE_PROVIDER=none to disable generation (uploads still work).

const PROVIDER = process.env.IMAGE_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "none");

// Claude does not generate images, so an Anthropic key in this slot is a
// category error rather than a typo. Say so instead of sending it upstream.
const WRONG_KEY =
  "That is an Anthropic key, not an OpenAI key. Claude cannot generate images, so this feature needs a separate OpenAI account. " +
  "Set OPENAI_API_KEY in .env to a key from platform.openai.com that starts with sk-proj- or sk-, or leave it blank and upload a photo instead.";

function keyProblem() {
  const k = (process.env.OPENAI_API_KEY || "").trim();
  if (!k) return "Image generation is not configured. Add OPENAI_API_KEY to .env, or upload a photo instead.";
  if (k.startsWith("sk-ant-")) return WRONG_KEY;
  if (k === (process.env.ANTHROPIC_API_KEY || "").trim()) return WRONG_KEY;
  if (!k.startsWith("sk-")) return "OPENAI_API_KEY does not look like an OpenAI key. OpenAI keys start with sk-proj- or sk-.";
  return null;
}

export function imageGenStatus() {
  if (PROVIDER !== "openai") return { enabled: false, provider: "none", model: null, reason: "Image generation is turned off. Upload a photo instead." };
  const reason = keyProblem();
  return { enabled: !reason, provider: "openai", model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", reason };
}

const SIZE_BY_ORIENTATION = {
  landscape: "1536x1024",
  square: "1024x1024",
  portrait: "1024x1536",
};

export async function generateImage({ prompt, orientation = "landscape" }) {
  const status = imageGenStatus();
  if (!status.enabled) throw new Error(status.reason);
  const size = SIZE_BY_ORIENTATION[orientation] || SIZE_BY_ORIENTATION.landscape;
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: status.model,
      prompt,
      n: 1,
      size,
      quality: process.env.OPENAI_IMAGE_QUALITY || "high",
      output_format: "png",
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message || JSON.stringify(j);
    } catch {
      detail = await res.text();
    }
    throw new Error(`Image provider error (${res.status}): ${detail}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("Image provider returned no image data.");
  return { buffer: Buffer.from(b64, "base64"), mime: "image/png" };
}
