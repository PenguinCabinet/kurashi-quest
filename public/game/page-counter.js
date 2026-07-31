// 窓口（確認用）。
// 家で準備 → 市役所へ → 受付で手続き → 足りなければ家に帰る。
// visit.ts / counter.ts / glossary.ts をそのまま呼んでいます。

import { app, data, el, $, header, uses, sheet, ways, termNotes, guide } from "./common.js";
import { sfx } from "./sound.js";
import { walkTo } from "./walk.js";
import {
  buildBoard,
  buildRoute,
  startVisit,
  currentProcedure,
  afterCounter,
  goAgain,
  predictVisit,
  say,
  openBag,
  buildGlossary,
  markTerms,
  toggleBrought,
  isBrought,
  broughtCount,
  toggle,
} from "./quest/index.js";

header(null);

const glossary = buildGlossary(data);
let visit = null; // null のあいだは家にいる

// 誰なのか分からないまま窓口には立てない。
// 前は答えが無いと「20歳の学生」で埋めていたが、
// それだとキャラメイクを飛ばしても最後まで遊べてしまい、答える意味が無くなる。
const me = () => app.profile;
const notAnswered = () => buildBoard(data, app.profile, app.progress, app.today).missingAnswers.length;

const board = () => buildBoard(data, me(), app.progress, app.today);

/**
 * その日に寄る場所。終わったものは含めない。
 * 含めてしまうと、全部終わったあとも「0件を終わらせる」と出て、
 * 済んだ手続きの持ち物まで並んでしまう。
 */
function stopOf(placeKey = "city-hall") {
  return buildRoute(board().quests, me()).stops.find((s) => s.placeKey === placeKey);
}

const KANJI = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const kanji = (n) => KANJI[n] ?? String(n);

/** 絵があれば出す。無ければ何も出さない */
function art(src, cls) {
  const img = el("img", cls);
  img.src = src;
  img.alt = "";
  img.addEventListener("error", () => img.remove());
  return img;
}

/** 「どちらか一方でよい」持ち物を1行にまとめる */
function groupBring(lines) {
  const alt = new Map();   // 代わりの id → 本体の id
  for (const p of data.procedures) {
    for (const b of p.bring) if (b.insteadOf) alt.set(b.sameAs ?? b.id, b.insteadOf);
  }
  const rows = [];
  for (const line of lines) {
    const target = alt.get(line.id);
    if (target) {
      const host = rows.find((r) => r.main.id === target);
      if (host) { host.others.push(line); continue; }
    }
    rows.push({ main: line, others: [] });
  }
  return rows;
}

/** その持ち物が、どの手続きで要るか */
function neededForNames(line) {
  return line.neededFor
    .map((id) => data.procedures.find((p) => p.id === id)?.displayName)
    .filter(Boolean);
}

/** 役所の言葉に、意味が出る印を付ける */
function withTerms(text) {
  const box = el("span");
  for (const part of markTerms(text, glossary)) {
    if (typeof part === "string") box.append(el("span", null, part));
    else box.append(el("span", "term", part.term.word));
  }
  return box;
}

// ── 家（準備） ──────────────────────────────────────────────
function renderHome() {
  const page = $("page");
  page.replaceChildren();

  // まだ誰か分かっていないとき
  const left = notAnswered();
  if (left > 0) {
    page.append(el("div", "title", "出かける準備"));
    const box = sheet("【 今日の目的 】", "市役所", "place-city-hall");
    box.body.append(el("div", "goal", "先に、あなたのことを答えてください"));
    box.body.append(
      el(
        "div",
        "note",
        `あと ${left}問です。答えないと、誰の持ち物を用意すればいいのか決まりません`,
      ),
    );
    page.append(box.box);

    const cmds = el("div", "cmds");
    const go = el("a", null, "あなたのことを答える");
    go.href = "chara.html";
    const log = el("a", null, "クエストログを見る");
    log.href = "quests.html";
    cmds.append(go, log);
    page.append(cmds);
    page.append(ways([]));
    return;
  }

  const stop = stopOf();
  const todo = stop ? stop.quests.filter((q) => !q.done) : [];

  // 市役所でやることが残っていないとき
  if (todo.length === 0) {
    page.append(el("div", "title", "出かける準備"));
    const box = sheet("【 今日の目的 】", "市役所", "place-city-hall");
    box.body.append(el("div", "goal", "市役所でやることは、もう残っていません"));
    box.body.append(
      el("div", "note", "終わっていない手続きが出てくると、またここに並びます"),
    );
    page.append(box.box);

    const cmds = el("div", "cmds");
    const log = el("a", null, "クエストログを見る");
    log.href = "quests.html";
    const route = el("a", null, "回る順番を見る");
    route.href = "route.html";
    cmds.append(log, route);
    page.append(cmds);
    page.append(ways([["あなたのこと", "chara.html"]]));
    return;
  }

  const rows = groupBring(stop.bring);
  const ready = rows.filter((r) => [r.main, ...r.others].some((l) => isBrought(app.progress, l.id)));

  // ① 何をしに行くのか
  //
  // 同じことを何度も書かない。1件のときは、手続きの名前をそのまま目的にする。
  // （前は「この一件を片づける」と書いた下に、その一件の名前をまた並べていた）
  const head = el("div", "title titleart");
  head.append(art("./characters/place-home.png", "titleicon"));
  head.append(el("span", null, "出かける準備"));
  page.append(head);
  page.append(guide("かばんに入れたものだけ、窓口で出せます。押して入れてください。"));

  const hours = stop.quests[0]?.procedure.where.hours;
  const goal = sheet("【 今日の目的 】", stop.place, `place-${stop.placeKey}`);

  if (todo.length === 1) {
    const only = todo[0];
    goal.body.append(el("div", "goal", only.name));
    goal.body.append(el("div", "note", only.what));
    goal.body.append(
      el(
        "div",
        "note",
        [only.deadline.label, only.deadline.dueOn ? `${only.deadline.dueOn} まで` : null]
          .filter(Boolean)
          .join("　"),
      ),
    );
  } else {
    goal.body.append(el("div", "goal", `一度で ${kanji(todo.length)}件ぜんぶ片づける`));
    todo.forEach((q, i) => {
      const row = el("div", "item");
      row.style.cursor = "default";
      row.append(el("div", "mark", kanji(i + 1)));
      const body = el("div");
      body.append(el("div", "label", q.name));
      body.append(
        el(
          "div",
          "note",
          [q.deadline.label, q.deadline.dueOn ? `${q.deadline.dueOn} まで` : null]
            .filter(Boolean)
            .join("　"),
        ),
      );
      row.append(body);
      goal.body.append(row);
    });
  }
  if (hours) goal.body.append(el("div", "note hint", `開いているのは ${hours}`));
  page.append(goal.box);

  // ② そのために何を持っていくか
  const bring = sheet("【 かばん 】", `${ready.length} / ${rows.length} そろった`, "icon-bag");
  for (const { main, others } of rows) {
    const all = [main, ...others];
    const on = all.some((l) => isBrought(app.progress, l.id));
    const row = el("div", `item ${on ? "on" : "off"}`);
    row.append(el("div", "mark", on ? "■" : "□"));
    row.append(art(`./characters/item-${main.id}.png`, "itemart"));

    const body = el("div");
    const title = el("div", "label", main.label);
    // 物でないものは、行を増やさずに札で示す
    if (!main.physical) title.append(el("span", "kind", "物ではない"));
    body.append(title);

    // 何のために持つのかは、手続きが2件以上のときだけ。
    // 1件しかない日は、全部その1件のために持つので書く意味がない
    if (todo.length > 1) {
      const names = neededForNames(main);
      if (names.length > 0) body.append(el("div", "for", `${names.join("・")}　で使う`));
    }
    if (main.note) body.append(el("div", "note", main.note));

    // どちらか一方でよいもの
    for (const other of others) {
      const alt = el("div", "alt");
      alt.append(el("span", "altmark", isBrought(app.progress, other.id) ? "■" : "□"));
      alt.append(el("span", null, `または ${other.label}`));
      if (other.note) alt.append(el("div", "note", other.note));
      alt.addEventListener("click", (e) => {
        e.stopPropagation();
        app.progress = toggleBrought(app.progress, other.id);
        app.save();
        render();
      });
      body.append(alt);
    }

    row.append(body);
    row.addEventListener("click", () => {
      app.progress = toggleBrought(app.progress, main.id);
      app.save();
      render();
    });
    bring.body.append(row);
  }
  page.append(bring.box);

  // ③ このまま行くとどうなるか
  //
  // 足りないものの名前は、すぐ上の □ で見えている。ここでは繰り返さず、数だけ言う
  const forecast = predictVisit(todo, app.progress);
  const short = [...new Set(forecast.missing.map((m) => m.label))];
  const verdict = el("div", `verdict ${forecast.stopAt ? "ng" : ""}`);
  if (forecast.stopAt) {
    verdict.append(el("div", "big", `かばんに ${short.length}つ足りません`));
    verdict.append(
      el("div", "note", `このまま行くと「${forecast.stopAt.name}」の途中で帰されます`),
    );
  } else {
    verdict.append(el("span", "stamp", "準備 完了"));
    verdict.append(el("div", "note", "このまま行けば、一度で終わります"));
  }

  const cmds = el("div", "cmds");
  const go = el("button", null, `${stop.place}へ行く`);
  if (forecast.stopAt) go.append(el("span", "small", "足りないまま行くこともできます"));
  go.addEventListener("click", () => {
    walkTo({
      to: stop.place,
      from: "home",
      into: "counter",
      profile: me(),
      done: () => {
        visit = startVisit(todo, data.procedures, me(), {
          placeKey: stop.placeKey,
          place: stop.place,
        });
        render();
      },
    });
  });
  cmds.append(go);
  // 上のバーを出さないので、戻り道はこの画面に置く
  const back = el("a", null, "クエストログにもどる");
  back.href = "quests.html";
  cmds.append(back);
  verdict.append(cmds);
  page.append(verdict);
  page.append(ways([["回る順番", "route.html"], ["あなたのこと", "chara.html"]]));
}

// ── 受付 ────────────────────────────────────────────────────
function renderCounter() {
  const page = $("page");
  page.replaceChildren();

  const target = currentProcedure(visit, data.procedures);
  const s = visit.counter;

  // 受付に入ると出口が無くなっていたので、いつでも帰れるようにする
  const leave = el("a", "back", "← 家にもどる");
  leave.href = "#";
  leave.addEventListener("click", (e) => {
    e.preventDefault();
    walkTo({
      to: "家",
      from: "counter",
      into: "home",
      profile: me(),
      done: () => {
        visit = null;
        render();
      },
    });
  });
  page.append(leave);

  page.append(el("div", "title", `${visit.place}の窓口`));
  if (visit.status === "wentHome") {
    page.append(guide("足りないものをそろえて、もう一度いきましょう。"));
  } else if (visit.status === "finished") {
    page.append(guide("おつかれさまでした。これで終わりです。"));
  }

  const head = sheet(
    "【 受付 】",
    visit.status === "atCounter" ? `${visit.index + 1}件目 / ${visit.plan.length}件` : "",
  );
  const win = el("div", "window");
  const stage = el("div", "stage");

  // 断られた・全部終わった、は音でも分かるようにする
  if (s.status === "turnedAway") sfx.deny();
  else if (visit.status === "finished") sfx.clear();

  const img = el("img");
  img.src = `./characters/clerk-${s.status === "turnedAway" ? "sorry" : "normal"}-bust.png`;
  img.alt = "窓口の職員";
  stage.append(img);

  const talk = el("div", "say");
  talk.append(el("span", "who", target ? `${target.displayName} の窓口` : "受付"));
  talk.append(withTerms(s.clerk));
  stage.append(talk);
  win.append(stage);

  // 出てきた役所の言葉は、その場で意味を出す
  const notes = termNotes(s.clerk, markTerms(s.clerk, glossary));
  if (notes) win.append(notes);

  const cmds = el("div", "cmds");
  if (visit.status === "atCounter" && s.status === "purpose") {
    s.choices.forEach((c, i) => {
      const b = el("button", null, c.text);
      b.addEventListener("click", () => {
        visit = afterCounter(visit, say(s, target, i, me()), data.procedures, me());
        render();
      });
      cmds.append(b);
    });
  } else if (visit.status === "atCounter" && s.status === "item") {
    const b = el("button", null, "かばんから出す");
    b.addEventListener("click", () => {
      visit = afterCounter(
        visit,
        openBag(s, target, app.progress, me()),
        data.procedures,
        me(),
      );
      render();
    });
    cmds.append(b);
    // 入れてあるかどうかは、ここでは言わない。
    // 先に答えを見せると、出すまでの緊張が消えるうえ、押せる文に見えてしまう
  }
  win.append(cmds);
  head.body.append(win);
  page.append(head.box);

  if (visit.status === "wentHome") {
    const v = el("div", "verdict ng");
    v.append(el("div", null, "持ち物が足りず、今日は帰ることになりました"));
    v.append(
      el("div", "note", `終わった手続き ${visit.done.length}件 / 残り ${visit.plan.length - visit.done.length}件`),
    );
    const cmd = el("div", "cmds");
    const again = el("button", null, "並び直して、残りをやる");
    again.addEventListener("click", () => {
      visit = goAgain(visit, data.procedures, me());
      render();
    });
    const home = el("button", null, "家に戻って準備し直す");
    home.addEventListener("click", () => {
      walkTo({
        to: "家",
        from: "counter",
        into: "home",
        profile: me(),
        done: () => {
          visit = null;
          render();
        },
      });
    });
    cmd.append(again, home);
    v.append(cmd);
    page.append(v);
  }

  if (visit.status === "finished") {
    const v = el("div", "verdict");
    v.append(el("span", "stamp", visit.trips === 0 ? "一度で完了" : `完了（${visit.trips + 1}回目）`));
    v.append(el("div", "note", `${visit.place}での手続き ${visit.done.length}件が終わりました`));
    const cmd = el("div", "cmds");
    const done = el("button", null, "終わったことにして一覧へ");
    done.addEventListener("click", () => {
      for (const id of visit.done) {
        if (!app.progress.doneAt[id]) app.progress = toggle(app.progress, id, app.today);
      }
      app.save();
      location.href = "quests.html";
    });
    const retry = el("button", null, "もう一度やる");
    retry.addEventListener("click", () => {
      visit = null;
      render();
    });
    cmd.append(done, retry);
    v.append(cmd);
    page.append(v);
  }

  const log = sheet("【 やり取り 】", "");
  log.body.className = "log";
  for (const l of s.log) {
    log.body.append(
      el("div", l.who === "me" ? "me" : null, l.who === "me" ? l.text : `職員　${l.text}`),
    );
  }
  page.append(log.box);
  page.append(ways([["クエストログ", "quests.html"], ["回る順番", "route.html"]]));
}

function render() {
  // 場所によって背景を変える
  document.body.setAttribute("data-place", visit && visit.status !== "wentHome" ? "counter" : "home");
  if (visit) renderCounter();
  else renderHome();
}

render();

uses([
  ["buildRoute(..., { includeDone: true })", "その日に回る場所と持ち物"],
  ["broughtCount / toggleBrought / isBrought", "家での準備"],
  ["predictVisit(予定, progress)", "このまま行くとどこで止まるか"],
  ["startVisit / afterCounter / goAgain", "来庁と、続けて回る処理"],
  ["say(s, 手続き, 番号, プロフィール)", "用件を選ぶ"],
  ["openBag(s, 手続き, progress, プロフィール)", "持ち物を出す。準備した分だけ出せる"],
  ["buildGlossary / markTerms", "役所の言葉に意味を出す"],
]);
