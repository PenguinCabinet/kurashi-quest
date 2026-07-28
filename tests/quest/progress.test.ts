import { test } from "node:test";
import assert from "node:assert/strict";
import {
  broughtCount,
  clearBrought,
  complete,
  dismiss,
  emptyProgress,
  isBrought,
  isDone,
  normalizeProgress,
  pruneProgress,
  restore,
  toggle,
  toggleBrought,
  uncomplete,
} from "../../src/lib/quest/progress.ts";
import { KEYS, loadProgress, memoryStorage, saveProgress } from "../../src/lib/quest/storage.ts";
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
  assert.deepEqual(normalizeProgress(null), emptyProgress());
  assert.deepEqual(normalizeProgress("こわれてる"), emptyProgress());
  assert.deepEqual(
    normalizeProgress({
      doneAt: { a: "2026-07-28", b: true, c: "ゆうべ" },
      dismissed: ["x", 3],
      brought: ["id-doc", 7],
    }),
    { doneAt: { a: "2026-07-28" }, dismissed: ["x"], brought: ["id-doc"] },
  );
});

test("データから消えた手続きの進捗は捨てる", () => {
  const p = {
    doneAt: { a: "2026-07-28", zzz: "2026-07-28" },
    dismissed: ["zzz"],
    brought: ["id-doc"],
  };
  assert.deepEqual(pruneProgress(p, ["a"]), {
    doneAt: { a: "2026-07-28" },
    dismissed: [],
    brought: ["id-doc"],
  });
});

test("保存して読み戻せる", () => {
  const storage = memoryStorage();
  const p = complete(emptyProgress(), "tennyu-todoke", "2026-07-28");
  saveProgress(storage, p);
  assert.deepEqual(loadProgress(storage), p);
});

test("保存が壊れていても、空の状態で始まる", () => {
  const storage = memoryStorage({ [KEYS.progress]: "{壊れたJSON" });
  assert.deepEqual(loadProgress(storage), emptyProgress());
});

test("保存できない環境（null）でも落ちない", () => {
  assert.deepEqual(loadProgress(null), emptyProgress());
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

test("持ち物のチェックを付け外しできる（攻略シートの「準備 2/4」）", () => {
  let p = emptyProgress();
  assert.equal(isBrought(p, "id-doc"), false);

  p = toggleBrought(p, "id-doc");
  assert.equal(isBrought(p, "id-doc"), true);
  assert.deepEqual(p.brought, ["id-doc"]);

  p = toggleBrought(p, "id-doc");
  assert.equal(isBrought(p, "id-doc"), false, "もう一度押すと外れる");
  assert.deepEqual(p.brought, []);
});

test("持ち物のチェックも保存されて、読み戻せる", () => {
  const storage = memoryStorage();
  const p = toggleBrought(toggleBrought(emptyProgress(), "id-doc"), "juki-pin");
  saveProgress(storage, p);

  const back = loadProgress(storage);
  assert.deepEqual(back.brought, ["id-doc", "juki-pin"]);
  assert.equal(isBrought(back, "juki-pin"), true);
});

test("そろった数を数えられる。要らないものは分母に入らない", () => {
  const lines = [{ id: "id-doc" }, { id: "mynumber-card" }, { id: "student-id-copy" }, { id: "juki-pin" }];
  const p = toggleBrought(toggleBrought(emptyProgress(), "id-doc"), "mynumber-card");

  assert.deepEqual(broughtCount(p, lines), { ready: 2, total: 4 });
  assert.deepEqual(broughtCount(emptyProgress(), lines), { ready: 0, total: 4 });
});

test("持ち物のチェックだけまとめて外せる", () => {
  const p = toggleBrought(toggleBrought(emptyProgress(), "id-doc"), "juki-pin");
  const done = complete(p, "tennyu-todoke", "2026-07-28");

  const cleared = clearBrought(done);
  assert.deepEqual(cleared.brought, []);
  assert.equal(isDone(cleared, "tennyu-todoke"), true, "手続きの進捗は消さない");
});
