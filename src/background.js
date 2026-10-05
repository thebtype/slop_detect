// Service worker: calls the Claude API on behalf of the content script so the
// API key never touches the LinkedIn page, and caches verdicts per post.
//
// Plain fetch is used because this extension has no build step to bundle the
// Anthropic SDK.

const API_URL = "https://api.anthropic.com/v1/messages";
const CACHE_KEY = "verdictCache";
const CACHE_LIMIT = 2000;

const SYSTEM_PROMPT = `You judge LinkedIn posts for "AI slop": text that reads as mass-produced by an LLM or written to farm engagement rather than to say something.

Signals of slop: generic stock phrasing, "It's not X, it's Y" framing, one-sentence-per-line "broetry", emoji bullet lists, em-dash-heavy cadence, vague inspirational lessons with no concrete specifics, hooks like "Let that sink in" or "Here's the thing", and closing engagement asks ("Agree?", "Repost ♻️").

Signals of a human post: concrete details (names, numbers, dates, places, specific events), a distinctive voice, typos or informality, a clear point that could only come from this author.

Score 0-100 for how likely the post is AI slop. Give a short reason (under 20 words).`;

const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", description: "0 = clearly human, 100 = clearly AI slop" },
    reason: { type: "string" },
  },
  required: ["score", "reason"],
  additionalProperties: false,
};

async function getSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  return settings || {};
}

async function getApiKey() {
  // Key lives in local storage so it is not synced across devices.
  const { apiKey } = await chrome.storage.local.get("apiKey");
  return apiKey || "";
}

async function cacheGet(id) {
  const { [CACHE_KEY]: cache = {} } = await chrome.storage.local.get(CACHE_KEY);
  return cache[id];
}

async function cachePut(id, verdict) {
  const { [CACHE_KEY]: cache = {} } = await chrome.storage.local.get(CACHE_KEY);
  cache[id] = { ...verdict, t: Date.now() };
  const ids = Object.keys(cache);
  if (ids.length > CACHE_LIMIT) {
    ids.sort((a, b) => cache[a].t - cache[b].t);
    for (const old of ids.slice(0, ids.length - CACHE_LIMIT)) delete cache[old];
  }
  await chrome.storage.local.set({ [CACHE_KEY]: cache });
}

async function classifyWithClaude(text, model) {
  const apiKey = await getApiKey();
  if (!apiKey) throw new Error("No Anthropic API key set. Open the extension options.");
  const allowed = await chrome.permissions.contains({ origins: ["https://api.anthropic.com/*"] });
  if (!allowed) throw new Error("Permission to reach api.anthropic.com not granted. Re-save the extension options.");

  const headers = {
    "content-type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  const body = {
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    output_config: { format: { type: "json_schema", schema: VERDICT_SCHEMA } },
    messages: [{ role: "user", content: `<post>\n${text.slice(0, 6000)}\n</post>` }],
  };
  // Haiku 4.5 rejects the effort parameter; newer models take it, and Opus
  // gets server-side refusal fallbacks.
  if (!model.startsWith("claude-haiku")) body.output_config.effort = "low";
  if (model.startsWith("claude-opus")) {
    headers["anthropic-beta"] = "server-side-fallback-2026-07-01";
    body.fallbacks = "default";
  }

  const res = await fetch(API_URL, { method: "POST", headers, body: JSON.stringify(body) });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Claude API ${res.status}: ${body.slice(0, 200)}`);
  }

  const msg = await res.json();
  if (msg.stop_reason === "refusal") throw new Error("Claude declined to classify this post.");
  const block = msg.content.find((b) => b.type === "text");
  if (!block) throw new Error("Claude returned no text.");
  const verdict = JSON.parse(block.text);
  return { score: Math.max(0, Math.min(100, verdict.score)), reason: verdict.reason };
}

chrome.runtime.onMessage.addListener((req, _sender, sendResponse) => {
  if (req?.type !== "classify") return false;
  (async () => {
    const settings = await getSettings();
    if (!settings.claudeConsent) throw new Error("Claude modes need your consent in the extension options.");
    const model = settings.model || "claude-opus-5";
    const cacheId = `${model}:${req.id}`;
    const cached = await cacheGet(cacheId);
    if (cached) return { ok: true, verdict: cached };
    const verdict = await classifyWithClaude(req.text, model);
    await cachePut(cacheId, verdict);
    return { ok: true, verdict };
  })()
    .then(sendResponse)
    .catch((err) => sendResponse({ ok: false, error: String(err.message || err) }));
  return true; // async response
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
