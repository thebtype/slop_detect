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
    stamp: true, // big animated stamp across slop posts
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

  // Generic text containers, used when LinkedIn's class names don't match.
  const GENERIC_TEXT = "[dir='ltr'], [data-testid*='text' i], [class*='commentary' i], [class*='text-view' i]";
  const MIN_TEXT = 80;

  function findPostText(post) {
    for (const sel of TEXT_SELECTORS) {
      const el = post.querySelector(sel);
      if (el && el.innerText.trim().length) return el.innerText.trim();
    }
    let best = "";
    for (const el of post.querySelectorAll(GENERIC_TEXT)) {
      if (el.closest(".slop-badge")) continue;
      const t = el.innerText.trim();
      if (t.length > best.length) best = t;
    }
    return best.length >= MIN_TEXT ? best : "";
  }

  // Every feed post has a "Comment" action button. Walk up from it to the
  // smallest ancestor that also holds the post text; that is the post.
  function findPostsByActionBar() {
    const root = document.querySelector("main") || document.body;
    const isCommentBtn = (b) => {
      const label = (b.getAttribute("aria-label") || b.innerText || "").trim().toLowerCase();
      return label === "comment" || label.startsWith("comment on");
    };
    const buttons = [...root.querySelectorAll("button, [role='button']")].filter(isCommentBtn);
    const posts = [];
    for (const btn of buttons) {
      let el = btn.parentElement;
      for (let depth = 0; el && el !== root && depth < 20; depth++, el = el.parentElement) {
        // Climbed past this post into a container holding several posts.
        if (buttons.some((b) => b !== btn && el.contains(b))) break;
        if (findPostText(el)) {
          posts.push(el);
          break;
        }
      }
    }
    return posts;
  }

  function findPosts() {
    const found = new Set(document.querySelectorAll(POST_SELECTORS.join(",")));
    for (const el of findPostsByActionBar()) {
      // Skip if a known container already covers this post.
      if (![...found].some((f) => f.contains(el) || el.contains(f))) found.add(el);
    }
    // Reshares nest one post inside another; only label the outermost.
    return [...found].filter((el) => ![...found].some((o) => o !== el && o.contains(el)));
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

  // Small on-page counter so it's obvious the extension is running even when
  // nothing in view is slop.
  const stats = { scanned: 0, flagged: 0 };
  let statusEl = null;
  let statusDismissed = false;

  function updateStatus() {
    if (statusDismissed || !settings.enabled || !document.body) return;
    if (!statusEl) {
      statusEl = document.createElement("button");
      statusEl.type = "button";
      statusEl.className = "slop-status";
      statusEl.title = "Slop Detect is running. Click to hide.";
      statusEl.addEventListener("click", () => {
        statusDismissed = true;
        statusEl.remove();
      });
    }
    if (!statusEl.isConnected) document.body.appendChild(statusEl);
    statusEl.textContent = `🤖 Slop Detect · ${stats.scanned} scanned · ${stats.flagged} flagged`;
  }

  function render(post, { score, reasons, source, error }) {
    post.querySelector(":scope > .slop-badge")?.remove();
    post.querySelector(":scope > .slop-stamp")?.remove();
    post.classList.remove("slop-dim", "slop-collapsed", "slop-stamped", "slop-stamped-slop", "slop-stamped-maybe");

    const label = verdictLabel(score);
    if (label.cls !== "human") {
      stats.flagged++;
      updateStatus();
    }
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
        addStamp(post, label, score);
      });
      badge.append(reveal);
    } else if (label.cls === "slop" && settings.action === "dim") {
      post.classList.add("slop-dim");
    }

    post.prepend(badge);
    if (!post.classList.contains("slop-collapsed")) addStamp(post, label, score);
  }

  // Stamps slam down the first time their post scrolls into view.
  const stampObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("slop-stamp-in");
        stampObserver.unobserve(entry.target);
      }
    },
    { threshold: 0.4 }
  );

  function addStamp(post, label, score) {
    if (!settings.stamp || label.cls === "human") return;
    const stamp = document.createElement("div");
    stamp.className = "slop-stamp";
    stamp.setAttribute("aria-hidden", "true");
    const main = document.createElement("div");
    main.className = "slop-stamp-main";
    main.textContent = label.cls === "slop" ? "AI SLOP" : "SLOP?";
    const sub = document.createElement("div");
    sub.className = "slop-stamp-sub";
    sub.textContent = `score ${score}/100`;
    stamp.append(main, sub);
    post.classList.add("slop-stamped", `slop-stamped-${label.cls}`);
    post.appendChild(stamp);
    stampObserver.observe(stamp);
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

    const text = findPostText(post);
    if (!text) return; // text may not be rendered yet; retry on next mutation
    post.dataset[DONE] = "1";

    const local = SlopHeuristics.scoreText(text);
    stats.scanned++;
    updateStatus();
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
    updateStatus();
    findPosts().forEach((post) => {
      processPost(post).catch((err) => console.warn("[slop-detect]", err));
    });
  }

  function resetAll() {
    document.querySelectorAll(".slop-badge, .slop-stamp").forEach((b) => b.remove());
    document
      .querySelectorAll(".slop-dim, .slop-collapsed, .slop-stamped")
      .forEach((p) => p.classList.remove("slop-dim", "slop-collapsed", "slop-stamped", "slop-stamped-slop", "slop-stamped-maybe"));
    document.querySelectorAll("[data-slop-done]").forEach((p) => delete p.dataset[DONE]);
    stats.scanned = 0;
    stats.flagged = 0;
    if (!settings.enabled) statusEl?.remove();
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
