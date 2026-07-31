// ⑤ 窓口の練習（1件だけ）。
//
// ⑥「1回の来庁」と同じ会話（counter.ts）を使います。
// 違いは、⑥が複数の手続きを続けて回るのに対し、こちらは1件だけということ。
// 持ち物も、練習なのでその場で「出す・持っていない」を答えます。

import { app, data, el, $, header, uses, questFromUrl, sheet, ways, termNotes } from "./common.js";
import { sfx } from "./sound.js";
import {
  startCounter,
  say,
  show,
  comeAgain,
  questionsOf,
  buildGlossary,
  markTerms,
  toggle,
} from "./quest/index.js";

header(null);

const glossary = buildGlossary(data);
const board = app.board();
const quest = questFromUrl(board);

if (quest) {
  const target = quest.procedure;
  const others = data.procedures;
  const me = app.profile;

  let s = startCounter(target, others, me);
  render();

  /** 役所の言葉に、意味が出る印を付ける */
  function withTerms(text) {
    const box = el("span");
    for (const part of markTerms(text, glossary)) {
      if (typeof part === "string") {
        box.append(el("span", null, part));
      } else {
        box.append(el("span", "term", part.term.word));
      }
    }
    return box;
  }

  function clerkArt(sorry) {
    const img = el("img");
    img.src = `./characters/clerk-${sorry ? "sorry" : "normal"}-bust.png`;
    img.alt = "";
    img.addEventListener("error", () => img.remove());
    return img;
  }

  function render() {
    const page = $("page");
    page.replaceChildren();

    const back = el("a", "back", "← やり方カードにもどる");
    back.href = `card.html?id=${encodeURIComponent(quest.id)}`;
    page.append(back);

    page.append(el("div", "title", `${quest.name}　の練習`));
    page.append(
      el("div", "lead", "本番と同じ会話です。持ち物が足りないと、その場で出直しになります。"),
    );

    // 聞かれる持ち物のうち、どこまで進んだか
    const asked = questionsOf(target, me);
    if (asked.length > 0) {
      const at =
        s.status === "cleared"
          ? asked.length
          : Math.max(asked.findIndex((q) => q.itemId === s.asking?.itemId), 0);
      const gauge = el("div", "gauge");
      const fill = el("i");
      fill.style.width = `${Math.round((at / asked.length) * 100)}%`;
      gauge.append(fill);
      page.append(gauge);
    }

    const tally = el("div", "tally");
    const num = (k, v, shu) => {
      const cell = el("span", shu ? "shu" : null, k);
      cell.append(el("b", null, String(v)));
      tally.append(cell);
    };
    num("出直した回数", s.attempts, s.attempts > 0);
    if (s.mistakes > 0) num("言い間違い", s.mistakes, true);
    page.append(tally);

    // ── 職員のことば ──
    if (s.status === "turnedAway") sfx.deny();
    else if (s.status === "cleared") sfx.clear();

    const win = el("div", "window");
    const stage = el("div", "stage");
    stage.append(clerkArt(s.status === "turnedAway"));
    const talk = el("div", "say");
    talk.append(el("span", "who", `${target.displayName} の窓口`));
    talk.append(withTerms(s.clerk));
    stage.append(talk);
    win.append(stage);

    const notes = termNotes(s.clerk, markTerms(s.clerk, glossary));
    if (notes) win.append(notes);

    // ── こちらのコマンド ──
    const cmds = el("div", "cmds");
    if (s.status === "purpose") {
      s.choices.forEach((c, i) => {
        const b = el("button", null, c.text);
        b.addEventListener("click", () => {
          s = say(s, target, i, me);
          render();
        });
        cmds.append(b);
      });
      cmds.append(el("div", "hint", "似た言い方が混ざっています"));
    } else if (s.status === "item") {
      const yes = el("button", null, "出す");
      yes.addEventListener("click", () => {
        s = show(s, target, true, me);
        render();
      });
      const no = el("button", null, "持っていない");
      no.addEventListener("click", () => {
        s = show(s, target, false, me);
        render();
      });
      cmds.append(yes, no);
      if (s.asking?.note) cmds.append(el("div", "hint", s.asking.note));
    } else if (s.status === "turnedAway") {
      const again = el("button", null, "出直す");
      again.append(el("span", "small", "もう一度はじめから並び直します"));
      again.addEventListener("click", () => {
        s = comeAgain(s, target, others, me);
        render();
      });
      cmds.append(again);
    } else if (s.status === "cleared") {
      const done = el("button", null, "達成にして一覧へ");
      done.addEventListener("click", () => {
        if (!quest.done) app.progress = toggle(app.progress, quest.id, app.today);
        app.save();
        location.href = "quests.html";
      });
      const retry = el("button", null, "もう一度やる");
      retry.addEventListener("click", () => {
        s = startCounter(target, others, me);
        render();
      });
      cmds.append(done, retry);
    }
    win.append(cmds);
    page.append(win);

    // ── やり取りの記録 ──
    const log = sheet("【 やり取り 】", null);
    log.body.className = "sheet-body log";
    for (const l of s.log) {
      log.body.append(
        el("div", l.who === "me" ? "me" : null, l.who === "me" ? l.text : `職員　${l.text}`),
      );
    }
    page.append(log.box);

    page.append(
      ways([
        ["クエストログ", "quests.html"],
        ["やり方カード", `card.html?id=${encodeURIComponent(quest.id)}`],
      ]),
    );

    uses([
      ["startCounter(手続き, 全部, プロフィール)", "窓口に立つ。用件の選択肢もここで作る"],
      ["purposeChoices", "間違いの選択肢は、他の手続きの「何て言う」から作る"],
      ["say(s, 手続き, 番号, プロフィール)", "用件を言う。間違えると言い直しになる"],
      ["show(s, 手続き, 出せたか, プロフィール)", "持ち物を出す。無ければ turnedAway"],
      ["comeAgain(s, 手続き, 全部, プロフィール)", "出直して並び直す"],
      ["questionsOf(手続き, プロフィール)", "窓口で聞かれる持ち物"],
      ["buildGlossary / markTerms", "役所の言葉に意味を出す"],
    ]);
  }
}
