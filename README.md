# Slop Detect for LinkedIn

A Chrome extension that labels likely AI-generated "slop" in your LinkedIn feed.

Slop posts get a big red **AI SLOP** stamp that slams down across the post as it scrolls into view (amber **SLOP?** for borderline ones). Each post also gets a small badge: **🤖 AI slop**, **Maybe slop**, or (optionally) **Looks human**, with a 0–100 score. Click the badge to see why it was flagged.

## Install (developer mode)

1. Clone this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the repo folder.
4. Open https://www.linkedin.com/feed/ and scroll.

Click the extension icon to open settings.

## Detection modes

| Mode | Cost | How it works |
|---|---|---|
| **Local rules** (default) | Free, instant, nothing leaves your browser | Scores posts on stock phrases ("let that sink in", "in today's fast-paced…"), "it's not X, it's Y" framing, em dashes, one-line-per-sentence formatting, emoji bullets, hashtag piles, hook openers and engagement-bait endings. |
| **Hybrid** | Low | Runs the local rules first and sends a post to Claude only if its local score passes the "hybrid gate". |
| **Claude** | Higher | Sends every post to Claude for a verdict. |

The Claude modes need an [Anthropic API key](https://console.anthropic.com/). The key is stored in `chrome.storage.local` on this device only, and the API is called from the extension's background service worker, never from the LinkedIn page. Verdicts are cached per post, so scrolling back up doesn't cost anything.

## Settings

- **Slop threshold**: the score at which a post counts as slop (default 50).
- **What to do with slop**: just label it, or label and dim it.
- **Auto-collapse near-certain slop**: off by default. When on, only posts scoring at or above the "auto-collapse at" score (default 90) are hidden automatically; lower-scoring flagged posts stay open. Every flagged post also has a **Collapse** / **Show post** button so you can hide or expand it yourself.
- **Big animated stamp across slop posts**: on by default; turn off to keep just the small badge. The animation is skipped if your OS has reduced motion turned on.
- **Also label posts that look human**: off by default, to keep the feed quiet.
- **Claude model**: Opus 5 (default), Sonnet 5, or Haiku 4.5.

## Development

```
npm test   # heuristic scorer unit tests (Node 18+, no dependencies)
```

- `src/heuristics.js`: the local rule-based scorer (shared by the extension and the tests)
- `src/content.js`: finds feed posts, scores them, renders badges
- `src/background.js`: Claude API calls and the verdict cache
- `src/options.html`, `src/options.js`: settings page

LinkedIn changes its markup often. Posts are found by known class names first, then by walking up from each post's "Comment" button, so detection survives most redesigns. A counter in the bottom-left corner shows how many posts were scanned and flagged; if it says 0 scanned, the post detection in `src/content.js` needs updating.

## Publishing to the Chrome Web Store

```
npm run package   # runs tests, then builds dist/slop-detect-<version>.zip
```

Upload that zip in the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole). Listing text, permission justifications, data-usage answers and image assets are in [`store/`](store/listing.md); the privacy policy is [`PRIVACY.md`](PRIVACY.md). Bump `version` in `manifest.json` for every update you upload.
