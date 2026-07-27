import { test } from "node:test";
import assert from "node:assert/strict";
import {
  complete,
  dismiss,
  emptyProgress,
  isDone,
  normalizeProgress,
  pruneProgress,
  restore,
  toggle,
  uncomplete,
} from "../../src/lib/quest/progress.ts";
import { loadProgress, memoryStorage, saveProgress } from "../../src/lib/quest/storage.ts";
import { normalizeProfile } from "../../src/lib/quest/profile.ts";

test("元の値を書き換えずに、新しい値を返す", () => {
  const before = emptyProgress();
  const after = complete(before, "tennyu-todoke", "2026-07-28");
  assert.deepEqual(before.doneAt, {});
  assert.equal(after.doneAt["tennyu-todoke"], "2026-07-28");
});

test("終わった日を持つ（true/false では90日の期限が計算できない）", () => {
  const p = complete(emptyProgress(), "tennyu-todoke", "2026-07-28");
  assert.equal(p.doneAt["tennyu-todoke"], "2026-07-28");
});

test("チェックの付け外し", () => {
  let p = emptyProgress();
  p = toggle(p, "lifeline", "2026-07-28");
  assert.equal(isDone(p, "lifeline"), true);
  p = toggle(p, "lifeline", "2026-07-28");
  assert.equal(isDone(p, "lifeline"), false);
  assert.equal(uncomplete(p, "lifeline"), p, "変化が無いときは同じ値を返す");
});

test("壊れた日付では終わったことにしない", () => {
  const p = complete(emptyProgress(), "lifeline", "きょう");
  assert.equal(isDone(p, "lifeline"), false);
});

test("消す・戻す", () => {
  let p = dismiss(emptyProgress(), "yubin-tenso");
  assert.deepEqual(p.dismissed, ["yubin-tenso"]);
  p = dismiss(p, "yubin-tenso");
  assert.deepEqual(p.dismissed, ["yubin-tenso"], "二重に入らない");
  p = restore(p, "yubin-tenso");
  assert.deepEqual(p.dismissed, []);
});

test("古い保存データが壊れていても落ちない", () => {
  assert.deepEqual(normalizeProgress(null), { doneAt: {}, dismissed: [] });
  assert.deepEqual(normalizeProgress("こわれてる"), { doneAt: {}, dismissed: [] });
  assert.deepEqual(
    normalizeProgress({ doneAt: { a: "2026-07-28", b: true, c: "ゆうべ" }, dismissed: ["x", 3] }),
    { doneAt: { a: "2026-07-28" }, dismissed: ["x"] },
  );
});

test("データから消えた手続きの進捗は捨てる", () => {
  const p = { doneAt: { a: "2026-07-28", zzz: "2026-07-28" }, dismissed: ["zzz"] };
  assert.deepEqual(pruneProgress(p, ["a"]), { doneAt: { a: "2026-07-28" }, dismissed: [] });
});

test("保存して読み戻せる", () => {
  const storage = memoryStorage();
  const p = complete(emptyProgress(), "tennyu-todoke", "2026-07-28");
  saveProgress(storage, p);
  assert.deepEqual(loadProgress(storage), p);
});

test("保存が壊れていても、空の状態で始まる", () => {
  const storage = memoryStorage({ "hikkoshi-quest.progress.v1": "{壊れたJSON" });
  assert.deepEqual(loadProgress(storage), { doneAt: {}, dismissed: [] });
});

test("保存できない環境（null）でも落ちない", () => {
  assert.deepEqual(loadProgress(null), { doneAt: {}, dismissed: [] });
  saveProgress(null, emptyProgress());
});

test("キャラメイクの答えも、知らない値は捨てて読む", () => {
  const profile = normalizeProfile({
    occupation: "ninja",
    movedOn: "2026-07-20",
    vehicle: "car",
    age: -3,
    hobby: "釣り",
  });
  assert.deepEqual(profile, { movedOn: "2026-07-20", vehicle: "car" });
});
