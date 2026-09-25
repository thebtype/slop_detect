// Finds posts in the LinkedIn feed, scores them, and attaches a label.
(function () {
  "use strict";

  const DEFAULTS = {
    enabled: true,
    mode: "heuristic", // "heuristic" | "hybrid" | "claude"
    threshold: 50, // score at or above this counts as slop
    hybridGate: 25, // hybrid mode: only ask Claude when the local score reaches this
    action: "label", // "label" | "dim" | "collapse"
    showHuman: false, // also label posts that look human
  };

  // LinkedIn's markup changes often; keep several fallbacks.
  const POST_SELECTORS = [
    "div.feed-shared-update-v2",
    "div[data-urn^='urn:li:activity']",
    "div[data-id^='urn:li:activity']",
    "div[data-urn^='urn:li:aggregate']",
  ];
  const TEXT_SELECTORS = [
    ".update-components-text",
    ".feed-shared-update-v2__description",
    ".feed-shared-inline-show-more-text",
    ".feed-shared-text",
    "[data-test-id='main-feed-activity-card__commentary']",
  ];

  const DONE = "slopDone";
  let settings = { ...DEFAULTS };

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function findPostText(post) {
    for (const sel of TEXT_SELECTORS) {
      const el = post.querySelector(sel);
      if (el && el.innerText.trim().length) return el.innerText.trim();
    }
    return "";
  }

  function postId(post, text) {
    const urn = post.getAttribute("data-urn") || post.getAttribute("data-id");
    return urn || `h:${hash(text)}`;
  }

  function verdictLabel(score) {
    if (score >= settings.threshold) return { cls: "slop", text: "AI slop" };
    if (score >= settings.threshold * 0.6) return { cls: "maybe", text: "Maybe slop" };
    return { cls: "human", text: "Looks human" };
  }

  function render(post, { score, reasons, source, error }) {
    post.querySelector(":scope > .slop-badge")?.remove();
    post.classList.remove("slop-dim", "slop-collapsed");

    const label = verdictLabel(score);
    if (label.cls === "human" && !settings.showHuman && !error) return;

    const badge = document.createElement("div");
    badge.className = `slop-badge slop-${label.cls}`;

    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "slop-pill";
    pill.textContent = `${label.cls === "slop" ? "🤖 " : ""}${label.text} · ${score}`;
    pill.title = "Click for details";

    const details = document.createElement("div");
    details.className = "slop-details";
    details.hidden = true;
    const list = document.createElement("ul");
    for (const r of reasons.length ? reasons : ["No strong signals"]) {
      const li = document.createElement("li");
      li.textContent = r;
      list.appendChild(li);
    }
    const src = document.createElement("div");
    src.className = "slop-source";
    src.textContent = error ? `Claude error: ${error} (showing local score)` : `Scored by ${source}`;
    details.append(list, src);

    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      details.hidden = !details.hidden;
    });
    badge.append(pill, details);

    if (label.cls === "slop" && settings.action === "collapse") {
      post.classList.add("slop-collapsed");
      const reveal = document.createElement("button");
      reveal.type = "button";
      reveal.className = "slop-reveal";
      reveal.textContent = "Show post";
      reveal.addEventListener("click", (e) => {
        e.stopPropagation();
        post.classList.remove("slop-collapsed");
        reveal.remove();
      });
      badge.append(reveal);
    } else if (label.cls === "slop" && settings.action === "dim") {
      post.classList.add("slop-dim");
    }

    post.prepend(badge);
  }

  function classifyWithClaude(id, text) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "classify", id, text }, (res) => {
        if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
        else resolve(res || { ok: false, error: "No response" });
      });
    });
  }

  async function processPost(post) {
    if (post.dataset[DONE]) return;
    // Reshares nest one post inside another; only label the outermost.
    if (post.parentElement?.closest(POST_SELECTORS.join(","))) return;

    const text = findPostText(post);
    if (!text) return; // text may not be rendered yet; retry on next mutation
    post.dataset[DONE] = "1";

    const local = SlopHeuristics.scoreText(text);
    const wantClaude =
      settings.mode === "claude" || (settings.mode === "hybrid" && local.score >= settings.hybridGate);

    if (!wantClaude) {
      render(post, { ...local, source: "local rules" });
      return;
    }

    const res = await classifyWithClaude(postId(post, text), text);
    if (res.ok) {
      render(post, { score: res.verdict.score, reasons: [res.verdict.reason], source: "Claude" });
    } else {
      render(post, { ...local, source: "local rules", error: res.error });
    }
  }

  function scan() {
    if (!settings.enabled) return;
    document.querySelectorAll(POST_SELECTORS.join(",")).forEach((post) => {
      processPost(post).catch((err) => console.warn("[slop-detect]", err));
    });
  }

  function resetAll() {
    document.querySelectorAll(".slop-badge").forEach((b) => b.remove());
    document.querySelectorAll(".slop-dim, .slop-collapsed").forEach((p) => p.classList.remove("slop-dim", "slop-collapsed"));
    document.querySelectorAll("[data-slop-done]").forEach((p) => delete p.dataset[DONE]);
  }

  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 400);
  });

  chrome.storage.sync.get("settings", ({ settings: saved }) => {
    settings = { ...DEFAULTS, ...(saved || {}) };
    scan();
    observer.observe(document.body, { childList: true, subtree: true });
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.settings) return;
    settings = { ...DEFAULTS, ...(changes.settings.newValue || {}) };
    resetAll();
    scan();
  });
})();
