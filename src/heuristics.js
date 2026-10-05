// Rule-based scorer for LinkedIn-style AI slop. Runs locally, no network.
// Loaded as a content script (exposes globalThis.SlopHeuristics) and
// required from Node for tests (module.exports).
(function (root) {
  "use strict";

  // Phrases that show up far more often in LLM-written or engagement-bait posts.
  const PHRASES = [
    "delve", "delving", "tapestry", "testament to", "game-changer", "game changer",
    "in today's fast-paced", "in today’s fast-paced", "ever-evolving", "ever evolving",
    "navigate the complexities", "navigating the complexities", "the landscape of",
    "unlock the power", "unlock your", "unleash", "harness the power", "elevate your",
    "fostering", "seamless", "synergy", "paradigm shift", "at the end of the day",
    "let that sink in", "read that again", "here's the thing", "here’s the thing",
    "here's the truth", "here’s the truth", "the truth is", "plot twist",
    "hot take", "unpopular opinion", "i'm humbled", "i’m humbled", "humbled and honored",
    "thrilled to announce", "excited to announce", "i'm excited to share", "i’m excited to share",
    "agree?", "thoughts?", "what do you think?", "drop a comment", "comment below",
    "repost ♻️", "♻️ repost", "follow me for more", "follow for more", "save this post",
    "that's it. that's the post", "that’s it. that’s the post", "stop scrolling",
    "most people don't", "most people don’t", "nobody talks about", "no one talks about",
    "here's what i learned", "here’s what i learned", "lessons i learned", "key takeaways",
    "the secret?", "the result?", "the lesson?", "the kicker?", "the best part?",
    "rich tapestry", "embark on", "journey", "resonate", "pivotal", "crucial", "robust",
    "moreover", "furthermore", "in conclusion", "it's worth noting", "it’s worth noting",
  ];

  const EMOJI_BULLET = /^[\s]*(?:[✅❌👉💡🔥🚀📈📌⚡️✨🎯💪🙌👇➡️→•▶️🔑🧠💼🌟⭐️✔️☑️🔹🔸📍]|\d+[.)️⃣]|[-–])\s*/u;
  const NOT_X_BUT_Y = /\b(?:it'?s|it’s|this is|that'?s|that’s)\s+not\s+(?:just\s+)?(?:about\s+)?[^.!?\n]{1,60}[,.;—–-]\s*(?:it'?s|it’s|but)\b/gi;
  const NOT_JUST = /\bnot\s+just\s+[^.!?\n]{1,50}[,—–-]?\s*but\b/gi;
  const EM_DASH = /—/g;
  const ARROW = /(?:→|➡️|⬇️|👇)/gu;
  const HASHTAG = /(^|\s)#[\p{L}\p{N}_]+/gu;
  const EMOJI = /\p{Extended_Pictographic}/gu;
  const RHETORICAL_HOOK = /^[^\n]{3,90}\?\s*$/m;

  function countMatches(text, re) {
    const m = text.match(re);
    return m ? m.length : 0;
  }

  // Returns { score: 0-100, reasons: string[] }.
  function scoreText(raw) {
    const text = (raw || "").replace(/\r/g, "").trim();
    if (text.length < 80) return { score: 0, reasons: [] };

    const lower = text.toLowerCase();
    const words = text.split(/\s+/).filter(Boolean).length;
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const per100 = (n) => (n / Math.max(words, 1)) * 100;

    let score = 0;
    const reasons = [];
    const add = (points, reason) => {
      if (points <= 0) return;
      score += points;
      reasons.push(reason);
    };

    // Stock phrases.
    const hits = PHRASES.filter((p) => lower.includes(p));
    if (hits.length) {
      add(Math.min(hits.length * 7, 35), `Stock phrases: ${hits.slice(0, 4).map((h) => `“${h}”`).join(", ")}`);
    }

    // "It's not X, it's Y" contrast framing.
    const contrasts = countMatches(text, NOT_X_BUT_Y) + countMatches(text, NOT_JUST);
    if (contrasts) add(Math.min(contrasts * 10, 20), `“Not X, but Y” framing ×${contrasts}`);

    // Em dashes are common in LLM prose.
    const dashes = countMatches(text, EM_DASH);
    if (dashes >= 2 || per100(dashes) > 1) add(Math.min(dashes * 3, 15), `${dashes} em dash${dashes === 1 ? "" : "es"}`);

    // "Broetry": one short sentence per line.
    if (lines.length >= 6) {
      const shortLines = lines.filter((l) => l.split(/\s+/).length <= 12).length;
      const ratio = shortLines / lines.length;
      if (ratio > 0.7) add(Math.round((ratio - 0.7) * 50) + 5, "One-line-per-sentence formatting");
    }

    // Emoji / numbered bullet lists.
    const bullets = lines.filter((l) => EMOJI_BULLET.test(l)).length;
    if (bullets >= 3) add(Math.min(bullets * 2, 12), `${bullets} emoji/numbered bullets`);

    const arrows = countMatches(text, ARROW);
    if (arrows >= 2) add(Math.min(arrows * 2, 8), `${arrows} arrows`);

    const emojis = countMatches(text, EMOJI);
    if (per100(emojis) > 3) add(6, "Heavy emoji use");

    const hashtags = countMatches(text, HASHTAG);
    if (hashtags >= 4) add(Math.min((hashtags - 3) * 2, 8), `${hashtags} hashtags`);

    // Hook: short question or one-liner opening, followed by a blank line.
    const firstLine = lines[0] || "";
    if (RHETORICAL_HOOK.test(firstLine) || (firstLine.split(/\s+/).length <= 8 && /\n\s*\n/.test(text.slice(0, 200)))) {
      add(6, "Engagement-bait hook opener");
    }

    // Ends with an engagement ask.
    // Only for multi-line posts, so a single paragraph isn't judged by its last word.
    const lastLine = lines.length > 2 ? lines[lines.length - 1].toLowerCase() : "";
    if (lastLine && lastLine.length < 120 && (/\?\s*$/.test(lastLine) || /\b(comment|repost|follow|share|agree)\b/.test(lastLine))) {
      add(6, "Ends with an engagement ask");
    }

    // Tricolon fragments: "Faster. Cheaper. Better."
    const fragments = countMatches(text, /(?:\b[A-Z][a-z]+\.\s+){2,}[A-Z][a-z]+\./g);
    if (fragments) add(6, "Staccato fragment triplets");

    return { score: Math.min(Math.round(score), 100), reasons };
  }

  const api = { scoreText };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.SlopHeuristics = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
