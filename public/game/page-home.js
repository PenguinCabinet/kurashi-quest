// ① あなたのこと（キャラメイク）。
// 1問ずつ聞いて、答えるたびに「何が変わったか」を見せる。
// QUESTIONS / answer / buildBoard をそのまま呼んでいます。

import { app, data, el, $, header, uses, param, ways, forgetCode } from "./common.js";
import {
  addDays,
  QUESTIONS,
  answer,
  clearAnswer,
  buildBoard,
  labelOf,
  emptyProfile,
  emptyProgress,
} from "./quest/index.js";

header("chara.html");


// タイトルの「はじめから」で来たときは、前の記録を消して1問目にもどす。
// 答えだけ消すと、達成の判とかばんの中身が残って、
// 「何も答えていないのに6件ぜんぶ達成」という状態になってしまう。
//
// 合言葉も手放す。持ったままにすると、まっさらな状態で預け直したときに
// 前の合言葉の中身がからっぽで上書きされ、前の記録が消えてしまう。
// サーバに預けたものはそのまま残るので、合言葉を控えてあれば戻せる。
if (param("new")) {
  app.profile = emptyProfile();
  app.progress = emptyProgress();
  app.save();
  forgetCode();
}

let step = QUESTIONS.findIndex((q) => app.profile[q.key] === undefined);
if (step === -1) step = QUESTIONS.length; // 全部答え済み
let change = null; // 直前の答えで何が変わったか
let dateInput = null;

const boardFor = (profile) => buildBoard(data, profile, emptyProgress(), app.today);

/** 答える前と後で、何が確定したか */
function diff(before, after) {
  const b = boardFor(before);
  const a = boardFor(after);

  const statusOf = (board) =>
    new Map([...board.quests, ...board.notNeeded].map((q) => [q.id, { name: q.name, need: q.need.status }]));
  const bs = statusOf(b);
  const as = statusOf(a);

  const fixed = [];     // 判定できていなかったものが決まった
  const dropped = [];   // あなたには要らない、に回った
  for (const [id, now] of as) {
    const was = bs.get(id);
    if (!was || was.need === now.need) continue;
    if (now.need === "notNeeded") dropped.push(now.name);
    else if (was.need === "unsure" && now.need === "show") fixed.push(now.name);
  }

  // 持ち物の増減
  const bag = (board) => new Set(board.quests.flatMap((q) => q.bring.map((x) => x.label)));
  const bb = bag(b);
  const ab = bag(a);
  const bagAdded = [...ab].filter((x) => !bb.has(x));
  const bagRemoved = [...bb].filter((x) => !ab.has(x));

  // 期限が日付で出るようになったか
  const hasDate = (board) => board.quests.some((q) => q.deadline.dueOn);
  const dateOpened = !hasDate(b) && hasDate(a);

  return { fixed, dropped, bagAdded, bagRemoved, dateOpened, before: b.stats, after: a.stats };
}

/** 何問目か。クエストログの「達成」と同じ枡で出す */
function stepsBar() {
  const bar = el("div", "steps");
  QUESTIONS.forEach((q, i) => {
    const cell = el("i");
    if (i < step) cell.setAttribute("data-state", "done");
    if (i === step) cell.setAttribute("data-state", "now");
    cell.title = q.title;
    if (i < step) {
      cell.addEventListener("click", () => {
        step = i;
        change = null;
        render();
      });
    }
    bar.append(cell);
  });
  const n = el("span", "n", `${Math.min(step + 1, QUESTIONS.length)} / ${QUESTIONS.length}`);
  bar.append(n);
  return bar;
}

function sheet(title, right) {
  const box = el("div", "sheet");
  const head = el("div", "sheet-head");
  head.append(el("div", null, title));
  if (right) head.append(el("div", "count", right));
  box.append(head);
  const body = el("div", "sheet-body");
  box.append(body);
  return { box, body };
}

/** 選択肢の絵。ファイルが無ければ表示しない */
const ART = {
  occupation: { student: "pick-student.png", worker: "pick-worker.png" },
  hasMyNumberCard: { true: "pick-card-yes.png", false: "pick-card-no.png" },
  livingAlone: { true: "pick-alone.png", false: "pick-family.png" },
  vehicle: { none: "pick-walk.png", moped: "pick-moped.png", car: "pick-car.png" },
  age: { 20: "pick-20over.png", 19: "pick-under20.png" },
};

function artFor(key, value) {
  const file = ART[key]?.[String(value)];
  if (!file) return null;
  const img = el("img");
  img.src = `./characters/${file}?v=2`; // 差し替えたとき、前の絵が残らないように
  img.alt = "";
  img.addEventListener("error", () => img.remove());
  return img;
}

function pick(key, value, said) {
  const before = { ...app.profile };
  app.profile = answer(app.profile, key, value);
  app.save();

  const d = diff(before, app.profile);
  const something =
    d.fixed.length || d.dropped.length || d.bagAdded.length || d.bagRemoved.length || d.dateOpened;
  // 何も変わらなかったときは出さない（「変わりませんでした」は読む意味がないので）
  change = something ? { ...d, said } : null;

  step = Math.min(step + 1, QUESTIONS.length);
  render();
}

// ── 質問 ────────────────────────────────────────────────────
function renderQuestion() {
  const page = $("page");
  const q = QUESTIONS[step];

  page.append(stepsBar());

  const box = sheet("【 あなたのこと 】", `${step + 1} / ${QUESTIONS.length}`);
  box.body.append(el("div", "ask", q.title));
  if (q.help) box.body.append(el("div", "ask-why", q.help));

  const opts = el("div", "opts");
  if (q.kind === "date") {
    opts.className = "write";
    const input = el("input");
    input.type = "date";
    // 既定を「今日」にすると、引越しの1週間前が期限のものが
    // 答えた瞬間に期限切れになる。これから引越す人を既定にする
    input.value = app.profile[q.key] ?? addDays(app.today, 14);
    input.addEventListener("change", () => {
      if (input.value) {
        app.profile = answer(app.profile, q.key, input.value);
        app.save();
        render();
      }
    });
    opts.append(input);
    opts.append(el("span", "unit", "に引越す／引越した"));
    opts.append(
      el("div", "ask-why", "この日から、それぞれの期限を数えます。過ぎた日を入れると期限切れが出ます"),
    );
    dateInput = input;
  } else {
    opts.className = "opts cards";
    for (const o of q.options) {
      const b = el("button", "card");
      b.setAttribute("aria-pressed", String(app.profile[q.key] === o.value));
      const art = artFor(q.key, o.value);
      if (art) b.append(art);
      b.append(el("span", "cap", o.label));
      if (o.note) b.append(el("span", "sub", o.note));
      b.addEventListener("click", () => pick(q.key, o.value, o.label));
      opts.append(b);
    }
  }
  box.body.append(opts);
  page.append(box.box);

  if (change) page.append(changeBox());

  const cmds = el("div", "cmds");

  // 日付は「この日にする」で確定。選択肢は答え済みなら「次へ」
  if (q.kind === "date") {
    const next = el("button", null, "この日にする");
    next.addEventListener("click", () => {
      const value = dateInput?.value || addDays(app.today, 14);
      pick(q.key, value, `${value} に引越す`);
    });
    cmds.append(next);
  } else if (app.profile[q.key] !== undefined) {
    const next = el("button", null, "次の質問へ");
    next.addEventListener("click", () => {
      change = null;
      step = Math.min(step + 1, QUESTIONS.length);
      render();
    });
    cmds.append(next);
  }

  if (step > 0) {
    const back = el("button", null, "前の質問にもどる");
    back.addEventListener("click", () => {
      step -= 1;
      change = null;
      render();
    });
    cmds.append(back);
  }
  page.append(cmds);
  page.append(ways([["クエストログ", "quests.html"]]));
}

/** 直前の答えで何が決まったか */
function changeBox() {
  const box = el("div", "change");
  box.append(el("div", "k", change.said ? `「${change.said}」と答えたので` : "わかったこと"));
  for (const name of change.fixed) {
    box.append(el("div", "add", `${name}　は、あなたに必要です`));
  }
  for (const name of change.dropped) {
    box.append(el("div", "del", `${name}　は、あなたには要りません`));
  }
  for (const x of change.bagAdded) {
    box.append(el("div", "add", `持ち物に「${x}」が増えました`));
  }
  for (const x of change.bagRemoved) {
    box.append(el("div", "del", `持ち物の「${x}」は要らなくなりました`));
  }
  if (change.dateOpened) {
    box.append(el("div", "add", "期限が実際の日付で出るようになりました"));
  }
  if (change.before.unsure !== change.after.unsure) {
    box.append(
      el("div", null, `まだ判定できていないもの ${change.before.unsure}件 → ${change.after.unsure}件`),
    );
  }
  return box;
}

// ── できあがり ──────────────────────────────────────────────
function renderResult() {
  const page = $("page");
  page.append(stepsBar());

  const board = boardFor(app.profile);
  const p = app.profile;
  const who = [
    p.livingAlone === true ? "ひとり暮らし" : p.livingAlone === false ? "家族と同居" : null,
    p.occupation === "student" ? "学生" : p.occupation === "worker" ? "働いている人" : null,
    p.vehicle === "car" ? "車あり" : p.vehicle === "moped" ? "原付あり" : null,
    p.age !== undefined && p.age >= 20 ? "20歳以上" : null,
  ].filter(Boolean);

  const box = sheet("【 できあがり 】", board.targetCity);
  box.body.append(el("div", "card-name", `${board.targetCity}に引越してきた　${who.join("・")}`));

  const stat = (k, v, shu) => {
    const row = el("div", "stat");
    row.append(el("div", "k", k));
    const val = el("div", "v");
    if (shu) val.append(el("span", "shu", v));
    else val.append(el("span", null, v));
    row.append(val);
    box.body.append(row);
  };
  stat("やる手続き", `${board.stats.total}件`);
  stat("知らない人が多いもの", `${board.stats.hidden}件`, true);
  stat("あなたには要らないもの", `${board.notNeeded.length}件`);
  if (board.stats.overdue > 0) stat("もう期限が過ぎたもの", `${board.stats.overdue}件`, true);
  if (board.next) stat("まずやること", board.next.name);
  if (board.stats.unsure > 0) stat("判定できていないもの", `${board.stats.unsure}件`);

  page.append(box.box);

  if (board.notNeeded.length > 0) {
    const off = sheet("【 あなたには要らないもの 】", "");
    for (const q of board.notNeeded) {
      const row = el("div", "stat");
      row.append(el("div", "k", q.name));
      row.append(el("div", "v", q.need.message ?? ""));
      off.body.append(row);
    }
    page.append(off.box);
  }

  const cmds = el("div", "cmds");
  const go = el("a", null, "クエストログを見る");
  go.href = "quests.html";
  const counter = el("a", null, "出かける準備をする");
  counter.href = "counter.html";
  const redo = el("button", null, "最初から答え直す");
  redo.addEventListener("click", () => {
    app.profile = emptyProfile();
    app.save();
    step = 0;
    change = null;
    render();
  });
  cmds.append(go, counter, redo);
  page.append(cmds);
  page.append(ways([["回る順番", "route.html"]]));
}

function render() {
  $("page").replaceChildren();
  if (step >= QUESTIONS.length) renderResult();
  else renderQuestion();
}

render();

uses([
  ["QUESTIONS", "6問の中身。質問を足すときも画面は触らなくていい"],
  ["answer(profile, key, value)", "1問に答える。おかしい値なら元のまま返る"],
  ["clearAnswer / emptyProfile", "答え直す"],
  ["buildBoard(...).stats / notNeeded / next", "答えるたびに、何が増えて何が消えたか"],
  ["labelOf(key)", "項目名の日本語"],
]);
