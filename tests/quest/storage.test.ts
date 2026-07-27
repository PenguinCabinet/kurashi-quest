import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KEYS,
  browserStorage,
  clearAll,
  loadProfile,
  loadProgress,
  memoryStorage,
  saveProfile,
  saveProgress,
} from "../../src/lib/quest/storage.ts";
import type { StorageLike } from "../../src/lib/quest/storage.ts";
import { complete, emptyProgress } from "../../src/lib/quest/progress.ts";
import type { Profile } from "../../src/lib/quest/types.ts";

const student: Profile = {
  occupation: "student",
  movedOn: "2026-07-20",
  hasMyNumberCard: true,
  livingAlone: true,
  vehicle: "none",
};

/** window を差し替える。テストが終わったら必ず元に戻す */
function withWindow(fake: unknown, body: () => void) {
  const g = globalThis as unknown as { window?: unknown };
  const had = "window" in g;
  const before = g.window;
  g.window = fake;
  try {
    body();
  } finally {
    if (had) g.window = before;
    else delete g.window;
  }
}

test("答えを保存して、読み戻せる", () => {
  const storage = memoryStorage();
  saveProfile(storage, student);
  assert.deepEqual(loadProfile(storage), student);
});

test("答えと進捗は、別の場所に入る", () => {
  const storage = memoryStorage();
  saveProfile(storage, student);
  saveProgress(storage, complete(emptyProgress(), "tennyu-todoke", "2026-07-28"));

  assert.notEqual(KEYS.profile, KEYS.progress);
  assert.ok(storage.getItem(KEYS.profile));
  assert.ok(storage.getItem(KEYS.progress));
  assert.deepEqual(loadProfile(storage), student, "片方を保存しても、もう片方は壊れない");
});

test("何も保存されていなければ、空の状態で始まる", () => {
  const storage = memoryStorage();
  assert.deepEqual(loadProfile(storage), {});
  assert.deepEqual(loadProgress(storage), { doneAt: {}, dismissed: [] });
});

test("保存が壊れていても、空の状態で始まる", () => {
  const storage = memoryStorage({
    [KEYS.profile]: "{壊れたJSON",
    [KEYS.progress]: "[1,2,3",
  });
  assert.deepEqual(loadProfile(storage), {});
  assert.deepEqual(loadProgress(storage), { doneAt: {}, dismissed: [] });
});

test("古い形の保存データが入っていても、知らない項目は捨てて読む", () => {
  const storage = memoryStorage({
    [KEYS.profile]: JSON.stringify({ occupation: "student", hobby: "釣り", vehicle: "ヘリコプター" }),
  });
  assert.deepEqual(loadProfile(storage), { occupation: "student" });
});

test("最初からやり直すと、両方消える", () => {
  const storage = memoryStorage();
  saveProfile(storage, student);
  saveProgress(storage, complete(emptyProgress(), "lifeline", "2026-07-28"));

  clearAll(storage);

  assert.equal(storage.getItem(KEYS.profile), null);
  assert.equal(storage.getItem(KEYS.progress), null);
});

test("保存できない環境（null）でも、全部の関数が動く", () => {
  // サーバ側で最初の描画をするとき、localStorage はまだ無い
  assert.deepEqual(loadProfile(null), {});
  assert.deepEqual(loadProgress(null), { doneAt: {}, dismissed: [] });
  saveProfile(null, student);
  saveProgress(null, emptyProgress());
  clearAll(null);
});

test("保存できない環境でも、書き込みで落ちない（プライベートモード）", () => {
  // Safari のプライベートモードは setItem で例外を投げる
  const throwing: StorageLike = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {
      throw new Error("QuotaExceededError");
    },
  };

  saveProfile(throwing, student);
  saveProgress(throwing, emptyProgress());
  clearAll(throwing);
});

test("読み込みで例外が出ても、空の状態で始まる", () => {
  const throwing: StorageLike = {
    getItem: () => {
      throw new Error("読めません");
    },
    setItem: () => {},
    removeItem: () => {},
  };

  assert.deepEqual(loadProfile(throwing), {});
  assert.deepEqual(loadProgress(throwing), { doneAt: {}, dismissed: [] });
});

test("サーバ側では、保存先が無い（null）", () => {
  // Node には window が無いので、そのままの状態が「サーバ側」にあたる
  assert.equal(browserStorage(), null);
});

test("ブラウザでは localStorage を返し、確認用の書き込みを残さない", () => {
  const fake = memoryStorage();
  withWindow({ localStorage: fake }, () => {
    assert.equal(browserStorage(), fake);
    assert.equal(fake.getItem("kurashi-quest.probe"), null, "確認用の値を消し忘れない");
  });
});

test("書き込めないブラウザでは null を返す（アプリは動く）", () => {
  const privateMode: StorageLike = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  };

  withWindow({ localStorage: privateMode }, () => {
    assert.equal(browserStorage(), null);
  });
  withWindow({}, () => {
    assert.equal(browserStorage(), null, "localStorage が無いブラウザ");
  });
});
