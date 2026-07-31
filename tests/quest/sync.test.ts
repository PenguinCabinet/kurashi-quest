import assert from "node:assert/strict";
import { test } from "node:test";

import {
  formatPassphrase,
  isPassphrase,
  makePassphrase,
  normalizePassphrase,
} from "../../src/lib/quest/passphrase.ts";
import { pullSave, pushSave, readSave, syncLine } from "../../src/lib/quest/sync.ts";
import type { Fetcher } from "../../src/lib/quest/sync.ts";
import { emptyProfile } from "../../src/lib/quest/profile.ts";
import { complete, emptyProgress, loseDay } from "../../src/lib/quest/progress.ts";

/** 決まった順で数を返す。テストが実行ごとに変わらないように */
function fixedRandom(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

/** サーバの代わり。何を送ったかも覚えておく */
function fakeServer(
  reply: { ok: boolean; status: number; body: unknown } | "落ちる",
): Fetcher & { sent: { url: string; body: unknown }[] } {
  const sent: { url: string; body: unknown }[] = [];
  const f = (async (url: string, init?: { body?: string }) => {
    sent.push({ url, body: init?.body ? JSON.parse(init.body) : null });
    if (reply === "落ちる") throw new Error("つながらない");
    return { ok: reply.ok, status: reply.status, json: async () => reply.body };
  }) as Fetcher & { sent: { url: string; body: unknown }[] };
  f.sent = sent;
  return f;
}

// ── 合言葉の形 ──

test("合言葉は6文字で、見間違えやすい文字を使わない", () => {
  const code = makePassphrase(fixedRandom([0.1, 0.3, 0.5, 0.7, 0.9, 0.2]));
  assert.equal(code.length, 6);
  assert.ok(isPassphrase(code));
  // 0 と O、1 と I と L、8 と B、2 と Z、5 と S は入れない
  for (const ng of ["0", "O", "1", "I", "L", "8", "B", "2", "Z", "5", "S"]) {
    assert.ok(!code.includes(ng), `${ng} が入っている: ${code}`);
  }
});

test("同じ乱数からは同じ合言葉ができる", () => {
  const a = makePassphrase(fixedRandom([0.4, 0.4, 0.4, 0.4, 0.4, 0.4]));
  const b = makePassphrase(fixedRandom([0.4, 0.4, 0.4, 0.4, 0.4, 0.4]));
  assert.equal(a, b);
});

test("小文字・空白・ハイフンは、打ち方の違いとして受け入れる", () => {
  const want = normalizePassphrase("KQ7F4M");
  for (const typed of ["kq7f4m", "KQ7 F4M", "kq7-f4m", "　KQ7F4M　"]) {
    assert.equal(normalizePassphrase(typed), want, typed);
  }
});

test("使っていない文字の見間違いだけ直す", () => {
  // O は合言葉に無いので、Q の打ち間違いとみなしてよい
  assert.equal(normalizePassphrase("QQQQQQ"), normalizePassphrase("OOOOOO"));
  assert.equal(normalizePassphrase("JJJJJJ"), normalizePassphrase("IL1IL1"));
});

test("寄せ先の無い文字は直さずに落とし、「使えない」と分かるようにする", () => {
  // S は形の似た行き先が無い。勝手に別の文字にすると、
  // 打ち間違いが黙って他人の合言葉になってしまう
  const got = normalizePassphrase("SSSSSS");
  assert.equal(got, "");
  assert.ok(!isPassphrase(got));
});

test("読みやすいように3文字ずつ区切る", () => {
  assert.equal(formatPassphrase("KQ7F4M"), "KQ7 F4M");
  assert.equal(formatPassphrase("みじかい"), "みじかい", "6文字でなければそのまま");
});

// ── 預ける ──

test("預けると、合言葉が返ってくる", async () => {
  const server = fakeServer({ ok: true, status: 200, body: { code: "KQ7F4M" } });
  const got = await pushSave(server, emptyProfile(), emptyProgress(), null);
  assert.deepEqual(got, { ok: true, code: "KQ7F4M" });
  assert.equal(server.sent.length, 1);
});

test("すでに合言葉があるときは、それを送って上書きする", async () => {
  const server = fakeServer({ ok: true, status: 200, body: { code: "KQ7F4M" } });
  await pushSave(server, emptyProfile(), emptyProgress(), "KQ7F4M");
  const body = server.sent[0]!.body as { code: string };
  assert.equal(body.code, "KQ7F4M", "新しく作り直さない");
});

test("つながらないときと、サーバが失敗したときを分けて返す", async () => {
  const offline = await pushSave(fakeServer("落ちる"), emptyProfile(), emptyProgress(), null);
  assert.deepEqual(offline, { ok: false, reason: "network" });

  const broken = await pushSave(
    fakeServer({ ok: false, status: 500, body: null }),
    emptyProfile(),
    emptyProgress(),
    null,
  );
  assert.deepEqual(broken, { ok: false, reason: "server" });
});

test("合言葉の形になっていない返事は、受け取らない", async () => {
  const server = fakeServer({ ok: true, status: 200, body: { code: "みじかい" } });
  const got = await pushSave(server, emptyProfile(), emptyProgress(), null);
  assert.deepEqual(got, { ok: false, reason: "server" });
});

// ── 取り出す ──

test("合言葉で、預けたものが戻る", async () => {
  const progress = loseDay(complete(emptyProgress(), "tennyu-todoke", "2026-08-01"));
  const server = fakeServer({
    ok: true,
    status: 200,
    body: { version: 1, profile: emptyProfile(), progress, savedAt: "2026-08-01T10:00:00.000Z" },
  });
  const got = await pullSave(server, "kq7 f4m");
  assert.ok(got.ok);
  assert.equal(got.data.progress.lostDays, 1);
  assert.equal(got.data.progress.doneAt["tennyu-todoke"], "2026-08-01");
  assert.equal(got.data.savedAt, "2026-08-01T10:00:00.000Z");
});

test("打ち間違いは、サーバまで行かせずに弾く", async () => {
  const server = fakeServer({ ok: true, status: 200, body: {} });
  const got = await pullSave(server, "みじかい");
  assert.deepEqual(got, { ok: false, reason: "badcode" });
  assert.equal(server.sent.length, 0, "通信していない");
});

test("無い合言葉は「見つかりません」と返す", async () => {
  const server = fakeServer({ ok: false, status: 404, body: null });
  const got = await pullSave(server, "KQ7F4M");
  assert.deepEqual(got, { ok: false, reason: "notfound" });
});

test("壊れた中身が返ってきても、落ちずに読み直す", () => {
  const got = readSave({ profile: "これは違う", progress: 12345, savedAt: null });
  assert.ok(got);
  assert.deepEqual(got.progress, emptyProgress(), "進捗は空として読む");
  assert.equal(got.savedAt, "");
});

test("中身がまるごと無いときは、受け取らない", () => {
  assert.equal(readSave(null), null);
  assert.equal(readSave("文字列"), null);
});

// ── 画面に出す言葉 ──

test("うまくいかなかった理由ごとに、違う言い方をする", () => {
  const lines = new Set(
    (["badcode", "notfound", "network", "server"] as const).map((reason) =>
      syncLine({ ok: false, reason }),
    ),
  );
  assert.equal(lines.size, 4, "全部ちがう文になっている");
  assert.match(syncLine({ ok: true, code: "KQ7F4M" }), /KQ7F4M/);
});
