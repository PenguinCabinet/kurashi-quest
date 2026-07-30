import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGlossary, lookup, markTerms } from "../../src/lib/quest/glossary.ts";
import type { TermHit } from "../../src/lib/quest/glossary.ts";
import { realData } from "./fixture.ts";

const glossary = buildGlossary(realData());
const words = (parts: (string | TermHit)[]) =>
  parts.filter((p): p is TermHit => typeof p !== "string").map((p) => p.term.word);

test("用語集は、いまのデータから作れる（新しく書かない）", () => {
  assert.ok(glossary.length > 0);

  const kenmen = lookup("個人番号カードの券面記載事項変更（継続利用手続き）", glossary)!;
  assert.equal(kenmen.plain, "マイナンバーカードの住所を書き換える");
  assert.match(kenmen.what ?? "", /住所/);
  assert.equal(kenmen.from, "procedure");
});

test("かっこ書きが無い形でも引ける", () => {
  // 本文では「個人番号カードの券面記載事項変更」とだけ書かれることがある
  const short = lookup("個人番号カードの券面記載事項変更", glossary);
  assert.ok(short, "かっこ無しでも見つかる");
  assert.equal(short!.plain, "マイナンバーカードの住所を書き換える");
});

test("文の中の用語に印を付けられる", () => {
  const parts = markTerms("転入届のあとに個人番号カードの券面記載事項変更をします", glossary);

  assert.ok(words(parts).includes("転入届"));
  assert.ok(words(parts).includes("個人番号カードの券面記載事項変更"));
  // 印を付けた部分と、その他の文字を合わせると元の文に戻る
  const back = parts.map((p) => (typeof p === "string" ? p : p.term.word)).join("");
  assert.equal(back, "転入届のあとに個人番号カードの券面記載事項変更をします");
});

test("長い用語を優先する（短い方に食われない）", () => {
  const parts = markTerms("個人番号カードの券面記載事項変更（継続利用手続き）が必要です", glossary);
  const hit = parts.find((p): p is TermHit => typeof p !== "string")!;
  assert.equal(hit.term.word, "個人番号カードの券面記載事項変更（継続利用手続き）");
});

test("持ち物の用語も引ける", () => {
  const pin = lookup("住民基本台帳用暗証番号（数字4桁）", glossary)!;
  assert.match(pin.plain, /カードを作ったときに決めた番号/);
  assert.equal(pin.from, "item");
});

test("用語が無い文は、そのまま返る", () => {
  const parts = markTerms("こんにちは", glossary);
  assert.deepEqual(parts, ["こんにちは"]);
});

test("知らない言葉を引いても落ちない", () => {
  assert.equal(lookup("そんな言葉はない", glossary), null);
});
