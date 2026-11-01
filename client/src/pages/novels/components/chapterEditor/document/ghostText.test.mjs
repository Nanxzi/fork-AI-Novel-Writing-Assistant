import assert from "node:assert/strict";
import test from "node:test";
import { extractGhostSuggestion, isParagraphEndOffset } from "./ghostText.ts";

test("paragraph end at text end and before a break", () => {
  assert.equal(isParagraphEndOffset("第一段。", 4), true);
  assert.equal(isParagraphEndOffset("第一段。\n第二段。", 4), true);
  assert.equal(isParagraphEndOffset("第一段。\n第二段。", 9), true);
});

test("not a paragraph end mid-paragraph or on an empty paragraph", () => {
  assert.equal(isParagraphEndOffset("第一段。", 2), false);
  assert.equal(isParagraphEndOffset("第一段。\n", 5), false);
  assert.equal(isParagraphEndOffset("   ", 3), false);
  assert.equal(isParagraphEndOffset("第一段。", 99), false);
});

test("suggestion is cut at the first sentence ending, terminator kept", () => {
  assert.equal(extractGhostSuggestion("她握紧了灯台。风从门缝里钻进来，后半句不要。"), "她握紧了灯台。");
  assert.equal(extractGhostSuggestion("真的吗？后面还有很多。"), "真的吗？");
});

test("suggestion strips leading blank space and stops at newlines", () => {
  assert.equal(extractGhostSuggestion("\n\n  他抬起头"), "他抬起头");
  assert.equal(extractGhostSuggestion("第一行\n第二行"), "第一行");
  assert.equal(extractGhostSuggestion("   "), "");
});

test("suggestion is hard-capped", () => {
  const long = "这是一个没有标点的很长的句子".repeat(6);
  assert.equal(extractGhostSuggestion(long).length, 42);
  assert.equal(extractGhostSuggestion(long, 10).length, 10);
});
