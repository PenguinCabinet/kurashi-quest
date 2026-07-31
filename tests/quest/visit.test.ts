import { test } from "node:test";
import assert from "node:assert/strict";
import {
  afterCounter,
  currentProcedure,
  goAgain,
  predictVisit,
  startVisit,
  visitLine,
} from "../../src/lib/quest/visit.ts";
import { say, show } from "../../src/lib/quest/counter.ts";
import { buildQuests } from "../../src/lib/quest/quests.ts";
import { buildRoute } from "../../src/lib/quest/route.ts";
import { emptyProgress, toggleBrought } from "../../src/lib/quest/progress.ts";
import { realData, student, TODAY } from "./fixture.ts";

const data = realData();

function cityHall(progress = emptyProgress()) {
  const quests = buildQuests(data, student, progress, TODAY);
  const stop = buildRoute(quests, student).stops.find((s) => s.placeKey === "city-hall")!;
  return { stop, quests };
}

function open() {
  const { stop } = cityHall();
  return startVisit(stop.quests, data.procedures, student, {
    placeKey: stop.placeKey,
    place: stop.place,
  });
}

/** 用件を正しく言う */
function sayRight(visit: ReturnType<typeof open>) {
  const p = currentProcedure(visit, data.procedures)!;
  const i = visit.counter.choices.findIndex((c) => c.correct);
  return { p, counter: say(visit.counter, p, i, student) };
}

/** 用件を言って、聞かれた持ち物を全部そろえて出す（1件を最後まで終わらせる） */
function clearOne(visit: ReturnType<typeof open>) {
  const { p, counter } = sayRight(visit);
  let s = counter;
  while (s.status === "item") s = show(s, p, true, student);
  return { p, counter: s };
}

test("その日の予定は、攻略シートの1か所ぶん（前提の順）", () => {
  const visit = open();
  assert.deepEqual(visit.plan, ["tennyu-todoke", "mynumber-address", "gakusei-nofu-tokurei"]);
  assert.equal(visit.status, "atCounter");
  assert.equal(currentProcedure(visit, data.procedures)!.id, "tennyu-todoke");
  assert.match(visitLine(visit), /1件目 \/ 3件/);
});

test("1件終わると、次の手続きの窓口に進む", () => {
  let visit = open();
  const { counter } = clearOne(visit);
  visit = afterCounter(visit, counter, data.procedures, student);

  assert.equal(visit.status, "atCounter");
  assert.deepEqual(visit.done, ["tennyu-todoke"]);
  assert.equal(currentProcedure(visit, data.procedures)!.id, "mynumber-address");
  assert.match(visit.counter.clerk, /ご用件/, "次の窓口は用件を聞くところから");
});

test("持ち物が足りないと、その日はそこで終わり", () => {
  let visit = open();
  const { p, counter } = sayRight(visit);
  visit = afterCounter(visit, show(counter, p, false, student), data.procedures, student);

  assert.equal(visit.status, "wentHome");
  assert.deepEqual(visit.done, [], "1件も終わっていない");
  assert.match(visitLine(visit), /残り3件/);
});

test("途中まで進んでから詰まると、済んだ分は残る", () => {
  let visit = open();
  visit = afterCounter(visit, clearOne(visit).counter, data.procedures, student);

  const second = sayRight(visit);
  visit = afterCounter(visit, show(second.counter, second.p, false, student), data.procedures, student);

  assert.equal(visit.status, "wentHome");
  assert.deepEqual(visit.done, ["tennyu-todoke"], "1件目は終わったまま");
});

test("出直すと、残りだけをやり直す", () => {
  let visit = open();
  visit = afterCounter(visit, clearOne(visit).counter, data.procedures, student);
  const second = sayRight(visit);
  visit = afterCounter(visit, show(second.counter, second.p, false, student), data.procedures, student);

  visit = goAgain(visit, data.procedures, student);

  assert.equal(visit.status, "atCounter");
  assert.equal(visit.trips, 1);
  assert.deepEqual(visit.plan, ["mynumber-address", "gakusei-nofu-tokurei"], "終わった分は予定から外れる");
  assert.equal(currentProcedure(visit, data.procedures)!.id, "mynumber-address");
});

test("全部終わると、何回で終わったかが出る", () => {
  let visit = open();
  for (let i = 0; i < 3 && visit.status === "atCounter"; i++) {
    visit = afterCounter(visit, clearOne(visit).counter, data.procedures, student);
  }

  assert.equal(visit.status, "finished");
  assert.equal(visit.done.length, 3);
  assert.match(visitLine(visit), /1回で終わりました（3件）/);
});

test("行く前に、何が足りなくて どこで止まるかが分かる", () => {
  const { stop } = cityHall();

  // 何もそろえていない状態
  const nothing = predictVisit(stop.quests, emptyProgress());
  assert.equal(nothing.stopAt!.id, "tennyu-todoke");
  assert.ok(nothing.missing.length > 0);

  // 全部そろえた状態
  let progress = emptyProgress();
  for (const item of stop.bring) progress = toggleBrought(progress, item.id);
  const ready = predictVisit(stop.quests, progress);
  assert.equal(ready.stopAt, null, "止まらない");
  assert.deepEqual(ready.missing, []);
});

test("暗証番号だけ足りないと、そこで止まると分かる", () => {
  const { stop } = cityHall();
  let progress = emptyProgress();
  for (const item of stop.bring) {
    if (item.id !== "juki-pin") progress = toggleBrought(progress, item.id);
  }

  const p = predictVisit(stop.quests, progress);
  assert.equal(p.stopAt!.id, "tennyu-todoke", "最初に暗証番号を使う手続きで止まる");
  assert.ok(p.missing.every((m) => m.label.includes("暗証番号")));
});

test("その日の予定が無ければ、行く必要はない", () => {
  const visit = startVisit([], data.procedures, student, { placeKey: "city-hall", place: "市役所" });
  assert.equal(visit.status, "finished");
});

test("「どちらか一方でよい」持ち物は、片方あれば止まらない", () => {
  // 学生納付特例は「学生証の写し」でも「在学証明書の原本」でもよい。
  // 片方だけ持って行った人を、もう片方が無いからと止めてしまわないか
  const { stop } = cityHall();
  const gakusei = stop.quests.find((q) => q.id === "gakusei-nofu-tokurei")!;
  const copy = gakusei.bring.find((b) => b.id === "student-id-copy")!;
  const original = gakusei.bring.find((b) => b.id === "zaigaku-shomei")!;

  assert.equal(original.insteadOf, "student-id-copy", "代わりになる相手が分かる");

  // 学生証の写しだけ持っている
  let progress = emptyProgress();
  for (const item of stop.bring) {
    if (item.id !== "zaigaku-shomei") progress = toggleBrought(progress, item.id);
  }
  const withCopy = predictVisit(stop.quests, progress);
  assert.equal(withCopy.stopAt, null, "学生証の写しがあれば、在学証明書は要らない");

  // 在学証明書だけ持っている
  progress = emptyProgress();
  for (const item of stop.bring) {
    if (item.id !== "student-id-copy") progress = toggleBrought(progress, item.id);
  }
  const withOriginal = predictVisit(stop.quests, progress);
  assert.equal(withOriginal.stopAt, null, "在学証明書があれば、学生証の写しは要らない");

  // どちらも持っていない
  progress = emptyProgress();
  for (const item of stop.bring) {
    if (item.id !== "student-id-copy" && item.id !== "zaigaku-shomei") {
      progress = toggleBrought(progress, item.id);
    }
  }
  const withNeither = predictVisit(stop.quests, progress);
  assert.equal(withNeither.stopAt!.id, "gakusei-nofu-tokurei", "両方無ければ、そこで止まる");
  assert.ok(copy.label && original.label);
});
