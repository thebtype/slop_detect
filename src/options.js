const DEFAULTS = {
  enabled: true,
  mode: "heuristic",
  threshold: 50,
  hybridGate: 25,
  action: "label",
  showHuman: false,
  model: "claude-opus-5",
};

const $ = (id) => document.getElementById(id);
const CHECKBOXES = ["enabled", "showHuman"];
const NUMBERS = ["threshold", "hybridGate"];
const SELECTS = ["mode", "action", "model"];

async function load() {
  const { settings } = await chrome.storage.sync.get("settings");
  const { apiKey } = await chrome.storage.local.get("apiKey");
  const s = { ...DEFAULTS, ...(settings || {}) };
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
  if (settings.mode !== "heuristic" && !apiKey) {
    $("status").textContent = "Add an API key to use Claude modes.";
    return;
  }
  await chrome.storage.sync.set({ settings });
  await chrome.storage.local.set({ apiKey });
  $("status").textContent = "Saved. Your LinkedIn tabs update automatically.";
  setTimeout(() => ($("status").textContent = ""), 3000);
}

$("save").addEventListener("click", save);
load();
