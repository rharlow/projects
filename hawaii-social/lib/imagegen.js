// Image generation adapter. Default provider is OpenAI's gpt-image-1 because it
// produces clean editorial photography and honors "no text" reliably.
// Set IMAGE_PROVIDER=none to disable generation (uploads still work).

const PROVIDER = process.env.IMAGE_PROVIDER || (process.env.OPENAI_API_KEY ? "openai" : "none");

export function imageGenStatus() {
  if (PROVIDER === "openai") {
    return { enabled: Boolean(process.env.OPENAI_API_KEY), provider: "openai", model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1" };
  }
  return { enabled: false, provider: "none", model: null };
}

const SIZE_BY_ORIENTATION = {
  landscape: "1536x1024",
  square: "1024x1024",
  portrait: "1024x1536",
};

export async function generateImage({ prompt, orientation = "landscape" }) {
  const status = imageGenStatus();
  if (!status.enabled) {
    throw new Error("Image generation is not configured. Add OPENAI_API_KEY to .env or upload a photo instead.");
  }
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
