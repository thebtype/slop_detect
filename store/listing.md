# Chrome Web Store listing (copy-paste)

## Name
Slop Detect for LinkedIn

## Summary (max 132 characters, same as manifest description)
Flags AI-generated slop and engagement bait in your LinkedIn feed with a score, reasons and an optional collapse.

## Category
Social & Communication (alternative: Productivity)

## Language
English

## Description

Tired of scrolling past the same AI-written "I got rejected from 47 jobs… here's what I learned 👇" posts? Slop Detect labels them, so you can skip them at a glance.

WHAT IT DOES
• Scores every post in your LinkedIn feed from 0 to 100 for how much it looks like AI slop or engagement bait
• Stamps likely slop with a big "AI SLOP" stamp (amber "SLOP?" for borderline posts)
• Click any badge to see exactly why a post was flagged
• Collapse any flagged post with one click, or auto-collapse only near-certain slop
• Optionally dim slop instead of hiding it

HOW IT DECIDES
By default, Slop Detect uses fast local rules that run entirely in your browser: stock phrases ("let that sink in", "in today's fast-paced world"), "it's not X, it's Y" framing, one-sentence-per-line formatting, emoji bullet lists, em-dash-heavy writing, hashtag piles, hook openers and "Agree? ♻️ Repost" closers.

Want a second opinion on borderline posts? Add your own Anthropic API key and switch to Hybrid mode: only posts the local rules already find suspicious are sent to Claude for a verdict. This is optional, and you pay Anthropic directly.

PRIVATE BY DEFAULT
• No account, no sign-up, no tracking, no analytics
• In the default mode nothing leaves your browser
• Post text is only sent to Anthropic if you turn on a Claude mode with your own key

The rules are a best guess, not proof: some real people write this way too. Tune the threshold in settings to taste.

Slop Detect is an independent project and is not affiliated with or endorsed by LinkedIn.

Source code: https://github.com/thebtype/slop_detect

## Privacy policy URL
https://github.com/thebtype/slop_detect/blob/HEAD/PRIVACY.md
(`HEAD` always points at the repo's default branch.)

## Privacy practices tab

### Single purpose
Labels posts in the user's LinkedIn feed that look AI-generated or written as engagement bait, so the user can recognise, dim or collapse them.

### Permission justifications
- **storage**: Saves the user's settings (detection mode, thresholds, display options), their optional Anthropic API key, and a local cache of verdicts so posts are not re-scored.
- **Host permission `https://www.linkedin.com/*`**: The content script reads the text of feed posts to score them and adds the label, stamp and collapse button to each post. It runs only on LinkedIn.
- **Optional host permission `https://api.anthropic.com/*`**: Requested only when the user turns on a Claude mode and enters their own API key. Used to send post text to Anthropic's API for classification.
- **Remote code**: No. All code is packaged with the extension; it does not load or execute remote code.

### Data usage disclosures
Tick **Website content** (the extension reads post text on linkedin.com; in optional Claude modes it is sent to Anthropic).
Tick **Authentication information** only if the reviewer considers the user's own Anthropic API key to be one; it is stored locally and sent only to Anthropic. (Ticking it is the safer choice.)
Leave all other categories unticked.

Certify all three:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

## Assets
- Store icon: `icons/icon128.png`
- Screenshots (1280×800): `store/screenshot-*.png`
- Small promo tile (440×280): `store/promo-small.png`
