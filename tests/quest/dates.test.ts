import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, diffDays, formatDaysLeft, formatJa, isDateString } from "../../src/lib/quest/dates";

test("日数の足し引きが月をまたいでも合う", () => {
  assert.equal(addDays("2026-07-20", 14), "2026-08-03");
  assert.equal(addDays("2026-07-20", -7), "2026-07-13");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29"); // うるう年
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
});

test("差分は日数で出る", () => {
  assert.equal(diffDays("2026-07-28", "2026-08-03"), 6);
  assert.equal(diffDays("2026-08-03", "2026-07-28"), -6);
  assert.equal(diffDays("2026-07-28", "2026-07-28"), 0);
});

test("壊れた日付は null になり、例外にはならない", () => {
  assert.equal(addDays("2026-13-01", 1), null);
  assert.equal(addDays("2026-02-31", 1), null); // 存在しない日
  assert.equal(addDays("きのう", 1), null);
  assert.equal(diffDays("2026-07-28", ""), null);
  assert.equal(isDateString("2026-7-8"), false); // 桁が足りないものは受け付けない
  assert.equal(isDateString("2026-07-08"), true);
});

test("画面用の文字にできる", () => {
  assert.equal(formatJa("2026-08-03"), "8月3日");
  assert.equal(formatDaysLeft(3), "あと3日");
  assert.equal(formatDaysLeft(0), "今日まで");
  assert.equal(formatDaysLeft(-2), "2日すぎている");
  assert.equal(formatDaysLeft(null), "");
});
