import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  benefitLine,
  buildBenefitBoard,
  decideEligibility,
  loadBenefits,
  validateBenefits,
} from "../../src/lib/quest/benefits.ts";
import type { Benefit, BenefitFile } from "../../src/lib/quest/types.ts";
import { student, worker } from "./fixture.ts";

/** 中身が入る前の形。データ担当が足すときの見本でもある */
function sample(overrides: Partial<Benefit> = {}): Benefit {
  return {
    id: "yachin-hojo",
    name: "若者向け家賃補助",
    what: "家賃の一部が毎月もどってくる",
    ifNot: "申請しないと1円ももらえない",
    showIf: { occupation: "student", livingAlone: true },
    deadline: { text: "入居から3か月以内" },
    where: { text: "市役所 住宅課", verified: false },
    howTo: { text: "申請書と賃貸契約書のコピーを出す", verified: false },
    sources: [],
    ...overrides,
  };
}

function fileWith(...benefits: Benefit[]): BenefitFile {
  return { dataVersion: "2026-07-27", targetCity: "◯◯市", benefits };
}

test("本物の benefits.json が読める（まだ中身は空）", () => {
  const text = readFileSync(new URL("../../src/data/benefits.json", import.meta.url), "utf8");
  const data = loadBenefits(JSON.parse(text));
  assert.equal(Array.isArray(data.benefits), true);
});

test("制度が1件も無くても、画面は作れる", () => {
  const board = buildBenefitBoard(fileWith(), student);
  assert.deepEqual(board.cards, []);
  assert.equal(board.yearlyTotalYen, null);
  assert.equal(benefitLine(board), null, "0件のときは一行を出さない");
});

test("使える人には出て、対象外の人には理由付きで残る", () => {
  const data = fileWith(sample());

  const forStudent = buildBenefitBoard(data, student);
  assert.deepEqual(forStudent.cards.map((c) => c.id), ["yachin-hojo"]);
  assert.equal(forStudent.cards[0].need.status, "show");

  const forWorker = buildBenefitBoard(data, worker);
  assert.deepEqual(forWorker.cards, [], "対象外は「使える制度」に出さない");
  assert.deepEqual(forWorker.notEligible.map((c) => c.id), ["yachin-hojo"], "消さずに残す");
  assert.match(forWorker.notEligible[0].need.message ?? "", /対象外/);
});

test("判定できないときは、消さずに出す（手続きと同じ方針）", () => {
  const half = { occupation: "student" as const }; // 1人暮らしかどうか未回答
  const board = buildBenefitBoard(fileWith(sample()), half);

  assert.equal(board.cards.length, 1);
  assert.equal(board.cards[0].need.status, "unsure");
  assert.match(board.cards[0].need.message ?? "", /1人暮らし/);
});

test("誰でも使えるものは、答えていなくても出る", () => {
  const board = buildBenefitBoard(fileWith(sample({ showIf: { always: true } })), {});
  assert.equal(board.cards[0].need.status, "show");
});

test("年齢の条件も、手続きと同じように効く", () => {
  const b = sample({ showIf: { ageAtLeast: 20 } });

  assert.equal(decideEligibility(b, { age: 20 }).status, "show");
  assert.equal(decideEligibility(b, { age: 19 }).status, "notNeeded");
  assert.equal(decideEligibility(b, {}).status, "unsure", "年齢が未回答なら念のため出す");
});

test("金額は、分かっているものだけ出す", () => {
  const noAmount = buildBenefitBoard(fileWith(sample()), student);
  assert.equal(noAmount.cards[0].amount, null);
  assert.equal(noAmount.yearlyTotalYen, null, "0円と出すと嘘になる");
  assert.equal(benefitLine(noAmount), "使える制度が1件あります");
});

test("金額が入っていれば、合計が出る", () => {
  const data = fileWith(
    sample({ amount: { text: "月1万円まで", yearlyYen: 120000 } }),
    sample({ id: "kenshin", name: "無料健診", showIf: { always: true }, amount: { text: "5千円ぶん", yearlyYen: 5000 } }),
  );
  const board = buildBenefitBoard(data, student);

  assert.equal(board.yearlyTotalYen, 125000);
  assert.match(benefitLine(board) ?? "", /125,000円/);
});

test("対象外のものは、金額の合計に入れない", () => {
  const data = fileWith(sample({ amount: { text: "月1万円まで", yearlyYen: 120000 } }));
  const board = buildBenefitBoard(data, worker); // 対象外
  assert.equal(board.yearlyTotalYen, null);
});

test("未確認の項目は画面に渡る", () => {
  const board = buildBenefitBoard(fileWith(sample()), student);
  assert.deepEqual(board.cards[0].unverified, ["どこで", "やり方", "出典"]);
});

test("データが壊れていたら、直すところを並べて落とす", () => {
  assert.throws(() => loadBenefits(null), /直すところ/);
  assert.throws(() => loadBenefits({ benefits: "配列じゃない" }), /直すところ/);

  const problems = validateBenefits({
    benefits: [{ id: "a" }, { id: "a", name: "重複", what: "x", showIf: {}, deadline: { text: "随時" } }],
  });
  assert.ok(problems.some((p) => p.includes("重複")));
  assert.ok(problems.some((p) => p.includes("name")));
});
