import { test } from "node:test";
import assert from "node:assert/strict";
import {
  comeAgain,
  openBag,
  purposeChoices,
  questionsOf,
  say,
  show,
  startCounter,
} from "../../src/lib/quest/counter.ts";
import type { Procedure } from "../../src/lib/quest/types.ts";
import { emptyProgress, toggleBrought } from "../../src/lib/quest/progress.ts";
import { realData, student, worker } from "./fixture.ts";

const data = realData();
const find = (id: string): Procedure => data.procedures.find((p) => p.id === id)!;
const tennyu = find("tennyu-todoke");
const open = (me = student) => startCounter(tennyu, data.procedures, me);

test("窓口に着くと、用件を聞かれる", () => {
  const s = open();
  assert.equal(s.status, "purpose");
  assert.equal(s.clerk, "本日はどのようなご用件ですか？");
  assert.deepEqual(s.log, [{ who: "clerk", text: "本日はどのようなご用件ですか？" }]);
});

test("選択肢は、他の手続きの「何て言う」から作る（データを足さない）", () => {
  const choices = purposeChoices(tennyu, data.procedures, student);

  assert.equal(choices.filter((c) => c.correct).length, 1);
  assert.equal(choices.find((c) => c.correct)!.text, "転入届を出したいです");

  // 間違いの選択肢も、実在する手続きの言い方
  const said = data.procedures.map((p) => p.sayThis.text);
  for (const c of choices) assert.ok(said.includes(c.text));
});

test("紛らわしい選択肢は、同じ場所の手続きから混ぜる", () => {
  const choices = purposeChoices(tennyu, data.procedures, student);
  const wrong = choices.filter((c) => !c.correct).map((c) => c.text);

  // 市役所でやる他の手続きが入る（郵便局や自宅のものより紛らわしい）
  assert.ok(wrong.includes("マイナンバーカードの住所も変更したいです"));
});

test("言い方を間違えると、やり直しになる（そこで終わりではない）", () => {
  let s = open();
  const wrongIndex = s.choices.findIndex((c) => !c.correct);
  s = say(s, tennyu, wrongIndex, student);

  assert.equal(s.status, "purpose", "追い返されはしない");
  assert.equal(s.mistakes, 1);
  assert.match(s.clerk, /こちらの窓口ではありません/);
  assert.equal(s.log.filter((l) => l.who === "me").length, 1, "言ったことは残る");
});

test("正しく言うと、持ち物を聞かれる", () => {
  let s = open();
  s = say(s, tennyu, s.choices.findIndex((c) => c.correct), student);

  assert.equal(s.status, "item");
  assert.equal(s.asking?.itemId, "juki-pin");
  assert.match(s.clerk, /住民基本台帳用暗証番号（数字4桁）はお持ちですか/);
});

test("持っていないと、その場で出直しになる", () => {
  let s = open();
  s = say(s, tennyu, s.choices.findIndex((c) => c.correct), student);
  s = show(s, tennyu, false, student);

  assert.equal(s.status, "turnedAway");
  assert.match(s.turnedAwayReason ?? "", /暗証番号/);
});

test("持っていれば、最後まで進んで完了する", () => {
  let s = open();
  s = say(s, tennyu, s.choices.findIndex((c) => c.correct), student);
  s = show(s, tennyu, true, student);

  assert.equal(s.status, "cleared");
  assert.match(s.clerk, /手続きが完了しました/);
  assert.match(s.clerk, /住民票/, "終わると何が手に入るかを言う");
});

test("出直すと最初からになるが、回数は残る", () => {
  let s = open();
  s = say(s, tennyu, s.choices.findIndex((c) => !c.correct), student);
  s = say(s, tennyu, s.choices.findIndex((c) => c.correct), student);
  s = show(s, tennyu, false, student);

  const again = comeAgain(s, tennyu, data.procedures, student);
  assert.equal(again.status, "purpose");
  assert.equal(again.attempts, 1);
  assert.equal(again.mistakes, 1, "言い間違えた回数は引き継ぐ");
  assert.deepEqual(again.log.length, 1, "会話は最初から");
});

test("聞かれる持ち物は、その人に必要なものだけ", () => {
  // カードを持っている人は暗証番号を聞かれる
  assert.deepEqual(questionsOf(tennyu, student).map((q) => q.itemId), ["juki-pin"]);

  // 持っていない人は、そもそも暗証番号が要らないので聞かれない
  assert.deepEqual(questionsOf(tennyu, worker).map((q) => q.itemId), []);
});

test("聞くことが無ければ、そのまま完了する", () => {
  let s = startCounter(tennyu, data.procedures, worker);
  s = say(s, tennyu, s.choices.findIndex((c) => c.correct), worker);
  assert.equal(s.status, "cleared");
});

test("鞄から出す。準備でそろえていなければ、その場で出直しになる", () => {
  let s = open();
  s = say(s, tennyu, s.choices.findIndex((c) => c.correct), student);
  assert.equal(s.asking?.itemId, "juki-pin");

  // 何も準備していない鞄
  const empty = emptyProgress();
  const failed = openBag(s, tennyu, empty, student);
  assert.equal(failed.status, "turnedAway", "持っていないのに あります とは言えない");

  // 暗証番号をそろえてから来た場合
  const ready = toggleBrought(emptyProgress(), "juki-pin");
  const ok = openBag(s, tennyu, ready, student);
  assert.equal(ok.status, "cleared");
});

test("準備の内容だけで結果が決まる（申告ではない）", () => {
  let s = open();
  s = say(s, tennyu, s.choices.findIndex((c) => c.correct), student);

  // 関係ない持ち物をいくら入れても、聞かれたものが無ければ通らない
  let progress = emptyProgress();
  for (const id of ["id-doc", "mynumber-card", "student-id-copy"]) {
    progress = toggleBrought(progress, id);
  }
  assert.equal(openBag(s, tennyu, progress, student).status, "turnedAway");
});
