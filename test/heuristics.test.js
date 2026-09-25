const test = require("node:test");
const assert = require("node:assert");
const { scoreText } = require("../src/heuristics.js");

const SLOP = `I got rejected from 47 jobs.

Then I got hired by my dream company.

Here's the thing — it's not about talent, it's about persistence.

Here's what I learned:

✅ Rejection is redirection
✅ Consistency beats motivation
✅ Your network is your net worth
✅ Growth happens outside your comfort zone

Let that sink in.

In today's fast-paced world, you need to unlock your potential — and embrace the journey.

Agree?

♻️ Repost to help someone in your network.
#careers #growth #mindset #leadership #motivation`;

const HUMAN = `We shipped the new billing export on Tuesday after about three weeks of back and forth with finance. The main thing that took time was reconciling the Stripe payout IDs with our internal invoice numbers, since about 2% of older invoices were created before we stored the payout reference. Maria wrote a backfill script that matched on amount and timestamp and flagged 312 rows for manual review, which Dev and I worked through on Thursday afternoon. If you run a similar setup and hit the same mismatch, happy to share the script.`;

test("flags typical LinkedIn slop", () => {
  const { score, reasons } = scoreText(SLOP);
  assert.ok(score >= 50, `expected slop score >= 50, got ${score}`);
  assert.ok(reasons.length >= 3);
});

test("does not flag a concrete, plain post", () => {
  const { score } = scoreText(HUMAN);
  assert.ok(score < 30, `expected human score < 30, got ${score}`);
});

test("ignores very short text", () => {
  assert.deepStrictEqual(scoreText("Congrats!"), { score: 0, reasons: [] });
});

test("score is capped at 100", () => {
  const { score } = scoreText(SLOP.repeat(5));
  assert.ok(score <= 100);
});
