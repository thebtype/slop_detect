# Privacy Policy: Slop Detect for LinkedIn

_Last updated: 5 October 2026_

Slop Detect for LinkedIn ("the extension") labels posts in your LinkedIn feed that look AI-generated or written as engagement bait. This policy explains what the extension does with data.

## Summary

- By default, everything happens inside your browser. Nothing is sent anywhere.
- The extension has no server, no analytics, no tracking and no ads. The developer never receives your data.
- Post text is sent to a third party (Anthropic) **only** if you turn on a Claude mode and enter your own Anthropic API key.

## What the extension reads

To score posts, the extension reads the text of posts shown in your LinkedIn feed on `www.linkedin.com`. It does not read your messages, profile or contacts, and it does not read pages on other websites.

## Default mode: local rules

In the default "Local rules only" mode, post text is scored by code that runs entirely in your browser. No post text, scores or other data leave your device.

## Optional Claude modes

If you choose "Hybrid" or "Claude for every post", provide your own Anthropic API key, and tick the consent box in the settings:

- The text of the relevant posts is sent directly from your browser to Anthropic's API (`api.anthropic.com`) to be classified. In Hybrid mode, only posts the local rules already find suspicious are sent.
- These requests are made with your API key, under your Anthropic account, and are governed by Anthropic's terms and privacy policy: https://www.anthropic.com/legal/privacy
- The extension asks for Chrome's permission to contact `api.anthropic.com` only when you turn on one of these modes.

## What is stored, and where

All stored data stays in your browser's extension storage:

- **Settings** (mode, thresholds, display choices): stored in Chrome sync storage, so they follow your Chrome profile if you use Chrome sync.
- **Anthropic API key** (only if you enter one): stored in local extension storage on this device only. It is not synced and is never sent anywhere except to Anthropic's API.
- **Cached Claude verdicts** (only in Claude modes): a score and a short reason per post, keyed by post ID, kept locally so the same post isn't sent twice. The cache is capped at 2,000 entries.

Removing the extension deletes all of this data.

## Sharing and sale of data

The extension does not sell, share or transfer user data to anyone, except for sending post text to Anthropic when you have turned that on yourself, as described above. Data is not used for advertising, credit-worthiness or any purpose unrelated to labeling posts.

## Not affiliated with LinkedIn

This extension is an independent project. It is not affiliated with, endorsed by or sponsored by LinkedIn Corporation.

## Contact

Questions or concerns: open an issue at https://github.com/thebtype/slop_detect/issues
