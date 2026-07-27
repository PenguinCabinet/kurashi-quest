import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ASKED_KEYS,
  QUESTIONS,
  answer,
  clearAnswer,
  emptyProfile,
  isComplete,
  labelOf,
  matchCond,
  missingAnswers,
  normalizeProfile,
  unknownKeys,
} from "../../src/lib/quest/profile.ts";
import type { Profile } from "../../src/lib/quest/types.ts";

test("キャラメイクは6問。聞かないものは入れない", () => {
  assert.equal(QUESTIONS.length, 6);
  assert.deepEqual(ASKED_KEYS, [
    "occupation",
    "movedOn",
    "hasMyNumberCard",
    "livingAlone",
    "vehicle",
    "age",
  ]);
  assert.ok(!ASKED_KEYS.includes("city"), "対象自治体は1つなので聞かない");
});

test("年齢は「20歳以上か」だけを聞く", () => {
  // 年齢そのものは使わないので、数字を入力させずに2択で済ませる
  const age = QUESTIONS.find((q) => q.key === "age")!;
  assert.equal(age.kind, "choice");
  if (age.kind !== "choice") return;

  assert.deepEqual(age.options.map((o) => o.label), ["20歳以上", "20歳未満"]);
  assert.equal(answer(emptyProfile(), "age", 20).age, 20);
  assert.equal(answer(emptyProfile(), "age", 19).age, 19);
});

test("選択肢の値は、そのまま答えとして通る", () => {
  // 画面はここの value をそのまま answer() に渡すので、
  // 捨てられる値が混じっていると、押しても何も起きない画面になる
  for (const q of QUESTIONS) {
    if (q.kind !== "choice") continue;
    for (const option of q.options) {
      const after = answer(emptyProfile(), q.key, option.value);
      assert.equal(after[q.key], option.value, `${q.key} の「${option.label}」が捨てられている`);
    }
  }
});

test("1問に答えると、その項目だけが変わる", () => {
  const before: Profile = { occupation: "student", movedOn: "2026-07-20" };
  const after = answer(before, "vehicle", "car");

  assert.deepEqual(after, { occupation: "student", movedOn: "2026-07-20", vehicle: "car" });
  assert.deepEqual(before, { occupation: "student", movedOn: "2026-07-20" }, "元の値は書き換えない");
});

test("おかしい値を渡しても、それまでの答えを壊さない", () => {
  const before: Profile = { occupation: "student", movedOn: "2026-07-20" };

  assert.deepEqual(answer(before, "occupation", "忍者"), before);
  assert.deepEqual(answer(before, "vehicle", "ヘリコプター"), before);
  assert.deepEqual(answer(before, "movedOn", "きのう"), before);
  assert.deepEqual(answer(before, "livingAlone", "はい"), before, "文字列は真偽値として受け取らない");
});

test("「いいえ」の答えも、ちゃんと残る", () => {
  // false は「未回答」と間違えやすいので、別のものとして扱えているか
  const p = answer(answer(emptyProfile(), "livingAlone", false), "hasMyNumberCard", false);

  assert.equal(p.livingAlone, false);
  assert.equal(p.hasMyNumberCard, false);
  assert.deepEqual(missingAnswers(p), ["occupation", "movedOn", "vehicle", "age"], "答えた扱いになる");
});

test("答えを取り消せる", () => {
  const p: Profile = { occupation: "student", vehicle: "car" };

  assert.deepEqual(answer(p, "vehicle", null), { occupation: "student" });
  assert.deepEqual(answer(p, "vehicle", undefined), { occupation: "student" });
  assert.deepEqual(clearAnswer(p, "vehicle"), { occupation: "student" });
  assert.deepEqual(clearAnswer(p, "movedOn"), p, "もともと無いものを消しても変わらない");
});

test("引越し日は、日付として成り立つものだけ受け取る", () => {
  assert.equal(answer(emptyProfile(), "movedOn", "2026-07-20").movedOn, "2026-07-20");
  assert.equal(answer(emptyProfile(), "movedOn", "2026-02-31").movedOn, undefined, "存在しない日");
  assert.equal(answer(emptyProfile(), "movedOn", "2026-7-20").movedOn, undefined, "桁が足りない");
  assert.equal(answer(emptyProfile(), "movedOn", "").movedOn, undefined);
});

test("保存されていた値を読むとき、知らないものは捨てる", () => {
  assert.deepEqual(normalizeProfile(null), {});
  assert.deepEqual(normalizeProfile("こわれてる"), {});
  assert.deepEqual(normalizeProfile([1, 2, 3]), {});
  assert.deepEqual(
    normalizeProfile({ occupation: "student", hobby: "釣り", vehicle: "ヘリコプター" }),
    { occupation: "student" },
  );
});

test("年齢は、ありえない値を弾いて整数にする", () => {
  assert.equal(normalizeProfile({ age: 20 }).age, 20);
  assert.equal(normalizeProfile({ age: 20.7 }).age, 20, "小数は切り捨てる");
  assert.equal(normalizeProfile({ age: -1 }).age, undefined);
  assert.equal(normalizeProfile({ age: 200 }).age, undefined);
  assert.equal(normalizeProfile({ age: NaN }).age, undefined);
  assert.equal(normalizeProfile({ age: "20" }).age, undefined, "文字列は受け取らない");
});

test("残りの質問数と、全部答えたかが分かる", () => {
  assert.deepEqual(missingAnswers(emptyProfile()), ASKED_KEYS);
  assert.equal(isComplete(emptyProfile()), false);

  const full: Profile = {
    occupation: "student",
    movedOn: "2026-07-20",
    hasMyNumberCard: true,
    livingAlone: true,
    vehicle: "none",
    age: 20,
  };
  assert.deepEqual(missingAnswers(full), []);
  assert.equal(isComplete(full), true);
  assert.equal(isComplete({ ...full, movedOn: undefined }), false);
});

test("条件に当てはまるかは、はい・いいえ・分からない の3つで返す", () => {
  const student: Profile = { occupation: "student", hasMyNumberCard: true };

  assert.equal(matchCond({ occupation: "student" }, student), "yes");
  assert.equal(matchCond({ occupation: "worker" }, student), "no");
  assert.equal(matchCond({ vehicle: "car" }, student), "unknown", "答えていない項目");
});

test("条件が複数のとき、1つでも違えば「いいえ」", () => {
  const me: Profile = { occupation: "student", vehicle: "car" };

  assert.equal(matchCond({ occupation: "student", vehicle: "car" }, me), "yes");
  assert.equal(matchCond({ occupation: "student", vehicle: "none" }, me), "no");

  // 分からない項目があっても、はっきり違うものがあれば「いいえ」が勝つ。
  // ここが逆だと、要らない手続きが「判定できません」付きで残ってしまう
  assert.equal(matchCond({ occupation: "worker", livingAlone: true }, me), "no");
  assert.equal(matchCond({ occupation: "student", livingAlone: true }, me), "unknown");
});

test("条件が空なら、誰にでも当てはまる", () => {
  assert.equal(matchCond({}, emptyProfile()), "yes");
});

test("「何が分からないか」を名前で出せる", () => {
  const me: Profile = { occupation: "student" };
  const cond: Partial<Profile> = { occupation: "student", hasMyNumberCard: true, vehicle: "car" };

  assert.deepEqual(unknownKeys(cond, me), ["hasMyNumberCard", "vehicle"]);
  assert.deepEqual(unknownKeys(cond, me).map(labelOf), ["マイナンバーカードの有無", "乗り物"]);
  assert.deepEqual(unknownKeys({ occupation: "student" }, me), []);
});

test("項目名は、全部が日本語になっている", () => {
  // 画面に「hasMyNumberCard が分からないので」と出てしまわないように
  for (const key of ASKED_KEYS) {
    assert.notEqual(labelOf(key), key, `${key} の日本語名が無い`);
  }
});
