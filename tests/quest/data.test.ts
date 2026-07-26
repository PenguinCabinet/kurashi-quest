import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadProcedures, validateProcedures } from "../../src/lib/quest/data";
import { realData } from "./fixture";

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

test("未確認の項目は残作業として出てくる（データ担当のチェックリスト）", () => {
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
