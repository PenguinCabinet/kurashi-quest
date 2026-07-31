import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadProcedures, validateProcedures } from "../../src/lib/quest/data.ts";
import { realData } from "./fixture.ts";

function raw(): any {
  return JSON.parse(readFileSync(new URL("../../src/data/procedures.json", import.meta.url), "utf8"));
}

test("本物の procedures.json が読める", () => {
  const data = realData();
  assert.equal(data.procedures.length, 6);
  assert.ok(data.procedures.every((p) => p.id));
});

test("本物の procedures.json に直すべきエラーが無い", () => {
  const result = validateProcedures(raw());
  assert.deepEqual(result.errors, []);
});

test("未確認の項目は残作業として出てくる（調べる人のチェックリスト）", () => {
  const result = validateProcedures(raw());
  assert.ok(result.unverified.length > 0, "未確認が1件も出ないのはおかしい");
  // 「どこで」が未確認の手続きが挙がっている
  assert.ok(result.unverified.some((u) => u.field === "where"));
});

test("id の重複を見つける", () => {
  const data = raw();
  data.procedures[1].id = data.procedures[0].id;
  const result = validateProcedures(data);
  assert.ok(result.errors.some((e) => e.field === "id"));
});

test("requires に無い id を書いたら見つける", () => {
  const data = raw();
  data.procedures[0].requires = ["sonzai-shinai"];
  const result = validateProcedures(data);
  assert.ok(result.errors.some((e) => e.field === "requires" && e.message.includes("ありません")));
});

test("requires が循環していたら見つける", () => {
  const data = raw();
  data.procedures[0].requires = [data.procedures[3].id];
  data.procedures[3].requires = [data.procedures[0].id];
  const result = validateProcedures(data);
  assert.ok(result.errors.some((e) => e.message.includes("循環")));
});

test("stuckIf が持ち物に無い id を指していたら見つける", () => {
  const data = raw();
  data.procedures[3].steps[4].stuckIf = { missing: "nai-mono", message: "止まります" };
  const result = validateProcedures(data);
  assert.ok(result.errors.some((e) => e.message.includes("bring にありません")));
});

test("手順の番号が飛んでいたら見つける", () => {
  const data = raw();
  data.procedures[0].steps[2].n = 9;
  const result = validateProcedures(data);
  assert.ok(result.errors.some((e) => e.field.startsWith("steps")));
});

test("キャラメイクに無い項目で出し分けようとしたら見つける", () => {
  const data = raw();
  data.procedures[0].showIf = { hasPet: true };
  const result = validateProcedures(data);
  assert.ok(result.errors.some((e) => e.message.includes("キャラメイクの項目にありません")));
});

test("エラーがあると loadProcedures は例外を投げる（画面が黙って空になるより落とす）", () => {
  const data = raw();
  data.procedures[0].id = data.procedures[1].id;
  assert.throws(() => loadProcedures(data), /直すところ/);
});

test("sameAs が実在しない持ち物を指していたら見つける", () => {
  const data = raw();
  data.procedures[5].bring[1].sameAs = "nai-mochimono";
  const result = validateProcedures(data);
  assert.ok(result.errors.some((e) => e.field.includes("sameAs")));
});

test("sameAs の指す先にも sameAs が付いていたら見つける（別名の別名は解決しない）", () => {
  const data = raw();
  data.procedures[3].bring[1].sameAs = "id-doc"; // mynumber-card 自体を別名にする
  const result = validateProcedures(data);
  assert.ok(result.errors.some((e) => e.message.includes("別名の別名")));
});

test("同じ名前なのに id が違う持ち物は警告になる（攻略シートで2行に見えるため）", () => {
  const data = raw();
  data.procedures[5].bring[2].id = "id-doc-2"; // 本人確認書類が2つの id で入る
  const result = validateProcedures(data);
  assert.ok(result.warnings.some((w) => w.message.includes("別の id")));
});

test("持ち物に「見せる」と書いてある手順は、そこで止まるようにしてある", () => {
  // 手順に「本人確認書類を見せる」と書いてあるのに、そこで止まらないと、
  // いちばん起きやすい出直し（身分証を忘れる）が再現できない
  const data = realData();
  const shows: string[] = [];

  for (const p of data.procedures) {
    for (const step of p.steps) {
      if (!/を見せる|を出す$/.test(step.text)) continue;
      // その手順で出すものが、持ち物にあるなら、止まる指定が要る
      const named = p.bring.find((b) => step.text.includes(b.label));
      if (!named) continue;
      if (!step.stuckIf) shows.push(`${p.id} 手順${step.n}「${step.text}」`);
    }
  }

  assert.deepEqual(shows, [], "止まる指定が抜けている手順");
});

test("本人確認書類は、窓口で聞かれる", () => {
  // 転出届と郵便の転送届は、窓口で必ず身分証を見せる
  const data = realData();
  for (const id of ["tenshutsu-todoke", "yubin-tenso"]) {
    const p = data.procedures.find((x) => x.id === id)!;
    const asks = p.steps.filter((s) => s.stuckIf?.missing === "id-doc");
    assert.equal(asks.length, 1, `${id} で本人確認書類を聞いていない`);
    assert.ok(
      p.bring.some((b) => (b.sameAs ?? b.id) === "id-doc"),
      `${id} の持ち物に本人確認書類が無い`,
    );
  }
});
