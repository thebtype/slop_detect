const DEFAULTS = {
  enabled: true,
  mode: "heuristic",
  threshold: 50,
  hybridGate: 25,
  action: "label",
  autoCollapse: false,
  collapseAt: 90,
  showHuman: false,
  stamp: true,
  claudeConsent: false,
  model: "claude-opus-5",
};

const ANTHROPIC_ORIGIN = "https://api.anthropic.com/*";
const $ = (id) => document.getElementById(id);
const CHECKBOXES = ["enabled", "autoCollapse", "showHuman", "stamp", "claudeConsent"];
const NUMBERS = ["threshold", "hybridGate", "collapseAt"];
const SELECTS = ["mode", "action", "model"];

async function load() {
  const { settings } = await chrome.storage.sync.get("settings");
  const { apiKey } = await chrome.storage.local.get("apiKey");
  const s = { ...DEFAULTS, ...(settings || {}) };
  // Migrate the old "collapse all slop" action to the auto-collapse switch.
  if (s.action === "collapse") Object.assign(s, { action: "label", autoCollapse: true });
  CHECKBOXES.forEach((k) => ($(k).checked = s[k]));
  NUMBERS.forEach((k) => ($(k).value = s[k]));
  SELECTS.forEach((k) => ($(k).value = s[k]));
  $("apiKey").value = apiKey || "";
}

async function save() {
  const settings = {};
  CHECKBOXES.forEach((k) => (settings[k] = $(k).checked));
  NUMBERS.forEach((k) => (settings[k] = Math.max(0, Math.min(100, Number($(k).value) || DEFAULTS[k]))));
  SELECTS.forEach((k) => (settings[k] = $(k).value));

  const apiKey = $("apiKey").value.trim();
  if (settings.mode !== "heuristic") {
    if (!apiKey) {
      $("status").textContent = "Add an API key to use Claude modes.";
      return;
    }
    if (!settings.claudeConsent) {
      $("status").textContent = "Tick the box confirming post text may be sent to Anthropic.";
      return;
    }
    // Must be the first await so it still counts as part of the click.
    const granted = await chrome.permissions.request({ origins: [ANTHROPIC_ORIGIN] });
    if (!granted) {
      $("status").textContent = "Claude modes need permission to contact api.anthropic.com.";
      return;
    }
  }
  await chrome.storage.sync.set({ settings });
  await chrome.storage.local.set({ apiKey });
  $("status").textContent = "Saved. Your LinkedIn tabs update automatically.";
  setTimeout(() => ($("status").textContent = ""), 3000);
}

$("save").addEventListener("click", save);
load();
