import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5";
const MOCK = process.env.MOCK_AI === "1";

function mockPackage(angle) {
  const body = (p) => `Most dysphagia workups stop at "reflux" too early.\n\nAt the ${p} level, the question is whether testing changes the operation. That is the argument this course has hosted for 42 years, with surgeons, gastroenterologists, and pathologists in the same room.\n\nAngle: ${angle.slice(0, 80)}\n\nReview the 2027 agenda and register: {LINK}`;
  return {
    model: "mock",
    angleTitle: "Mock: " + angle.slice(0, 30),
    headline: "GERD, or a GERD mimic?",
    subline: "February 4 to 9, 2027 · Kaua'i",
    imagePrompt: "Editorial photograph of a quiet seminar room at dawn with open notebooks, warm side light, shallow depth of field, no people, no text.",
    linkedin: { hook: "Most dysphagia workups stop too early.", body: body("LinkedIn"), hashtags: ["#Foregut", "#GERD", "#CME"], altText: "Seminar room at dawn." },
    facebook: { hook: "Most dysphagia workups stop too early.", body: body("Facebook"), hashtags: ["#Foregut", "#GERD"], altText: "Seminar room at dawn." },
    instagram: { hook: "Most dysphagia workups stop too early.", body: body("Instagram") + "\n\nLink in bio.", hashtags: ["#Foregut", "#GERD", "#Esophagus", "#Gastroenterology", "#GISurgery", "#CME", "#Kauai", "#ForegutCourse2027"], altText: "Seminar room at dawn." },
  };
}

const PlatformCopy = z.object({
  hook: z.string().describe("First line. Must work on its own before the fold."),
  body: z.string().describe("Full post text including the hook, blank lines between paragraphs, ending with the CTA and link placeholder {LINK}. No hashtags here."),
  hashtags: z.array(z.string()).describe("Hashtags without spaces, each starting with #."),
  altText: z.string().describe("Accessible image description for this platform, one or two sentences."),
});

const PostPackage = z.object({
  angleTitle: z.string().describe("Short internal label for this post idea."),
  headline: z.string().describe("Overlay headline for the graphic. Max 8 words. No period."),
  subline: z.string().describe("Overlay subline for the graphic. Max 12 words, usually dates and island or the one-line promise."),
  imagePrompt: z.string().describe("A detailed prompt for an image generation model. Photographic, editorial, no text or logos in the image, no faces of identifiable real people, no fabricated medical imagery. Describe scene, light, lens, and mood."),
  linkedin: PlatformCopy,
  facebook: PlatformCopy,
  instagram: PlatformCopy,
});

function briefToText(brief) {
  const sp = (brief.sellingPoints || []).map((s) => `- ${s}`).join("\n");
  return `COURSE FACTS
Name: ${brief.courseName}
Short name: ${brief.shortName}
Edition: ${brief.edition}
Dates: ${brief.dates}
Venue: ${brief.venue}
Organizer: ${brief.organizer}
Directors: ${brief.directors}
History: ${brief.founders}
Registration fee: ${brief.registrationFee}
Website: ${brief.websiteUrl}
Registration page: ${brief.registrationUrl}
Contact: ${brief.contactEmail}

AUDIENCE
${brief.audience}

GOAL
${brief.goal}

SELLING POINTS
${sp}

VOICE
${brief.voice}

PREFERRED HASHTAGS (choose from these, add at most two new ones)
${(brief.hashtags || []).join(" ")}${brief.pastPosts && brief.pastPosts.trim() ? `

PAST POSTS (match this voice and rhythm, do not copy sentences)
${brief.pastPosts.trim()}` : ""}`;
}

const SYSTEM = `You write social media posts that recruit first-time attendees to a long-running CME course for physicians who treat esophageal and foregut disease.

Readers are busy gastroenterologists and surgeons scrolling between cases. They respond to specific clinical questions, named controversies, and respected faculty, not to generic conference marketing. They are allergic to hype.

Rules that always apply:
- Only state facts given in the brief or the user's angle. Never invent faculty, talks, outcomes, statistics, or quotes.
- Never use em-dashes. Use commas, periods, or parentheses. Use oxford commas.
- Put the literal token {LINK} exactly once in each body, in the CTA line near the end. The app substitutes the tracked URL.
- The CTA should point to reviewing the website or agenda and registering, in that order of softness. First-time attendees need a reason to look before a reason to buy.
- Mention that afternoons are free or that it is on Kaua'i at most once per post, and never as the lead. The clinical value is the lead. The island is the reward.

Platform rules:
- LinkedIn: 900 to 1,300 characters. Professional. No emojis. Three to five hashtags at the end. Line breaks between short paragraphs. Hook must not read as an ad.
- Facebook: 400 to 800 characters. Warmer and more conversational, may address the reader as "you", one emoji at most and only if it fits. Two to four hashtags.
- Instagram: 500 to 1,200 characters. Hook in the first 125 characters because that is what shows before "more". Short lines. Eight to fifteen hashtags. Since Instagram captions cannot carry a clickable link, the CTA says "link in bio" and still includes {LINK} on its own line for the bio and for reuse.

The headline and subline are burned onto the image, so keep them short and typeset-friendly. The image prompt must describe a photograph with no text, no logos, no identifiable real people, and no fabricated clinical imagery (no fake endoscopy or scans).`;

export async function generatePostPackage({ brief, angle, notes, variantSeed }) {
  if (MOCK) return mockPackage(angle);
  const client = new Anthropic();
  const user = `${briefToText(brief)}

POST ANGLE
${angle}

${notes ? `ADDITIONAL NOTES FROM THE EDITOR\n${notes}\n` : ""}${variantSeed ? `VARIANT\nProduce a fresh take that differs in hook and structure from an earlier draft. Variant seed: ${variantSeed}\n` : ""}
Write the post package.`;

  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { format: zodOutputFormat(PostPackage), effort: "medium" },
  });

  if (response.stop_reason === "refusal") {
    throw new Error("The model declined this request. Adjust the angle or notes and try again.");
  }
  if (!response.parsed_output) {
    throw new Error("Copy generation returned no structured output. Try again.");
  }
  return { model: response.model, ...response.parsed_output };
}

const Rewrite = z.object({ text: z.string() });

export async function rewriteCopy({ brief, platform, text, instruction }) {
  if (MOCK) return `${text}\n\n(mock rewrite: ${instruction})`;
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `${briefToText(brief)}

Rewrite the following ${platform} post according to this instruction: ${instruction}

Keep {LINK} exactly once. Return only the rewritten post text (no hashtags unless they were in the original).

POST
${text}`,
      },
    ],
    output_config: { format: zodOutputFormat(Rewrite), effort: "low" },
  });
  if (response.stop_reason === "refusal") throw new Error("The model declined this rewrite.");
  if (!response.parsed_output) throw new Error("Rewrite returned no output.");
  return response.parsed_output.text;
}

const Angles = z.object({
  angles: z.array(
    z.object({
      title: z.string(),
      pitch: z.string().describe("One or two sentences describing the post idea and why a first-time attendee would care."),
    })
  ),
});

export async function suggestAngles({ brief, count = 8 }) {
  if (MOCK) return [{ title: "Mock angle", pitch: "A mock pitch for offline testing." }];
  const client = new Anthropic();
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `${briefToText(brief)}

Propose ${count} distinct post angles for a six-week campaign aimed at physicians who have never attended. Mix clinical-controversy hooks, format hooks (the debate tradition, small classroom), practical hooks (CME, hotel block filling), and one or two Kaua'i lifestyle hooks. Each must be grounded in the brief.`,
      },
    ],
    output_config: { format: zodOutputFormat(Angles), effort: "medium" },
  });
  if (!response.parsed_output) throw new Error("No angles returned.");
  return response.parsed_output.angles;
}
