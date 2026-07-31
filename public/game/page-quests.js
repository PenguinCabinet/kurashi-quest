// ② クエストログ。受けている依頼の一覧。
//
// 1枚の依頼札に「何を得るか（result）」と「放っておくとどうなるか（ifNot）」を出します。
// この2つがロジックには入っているのに、一覧では捨てられていました。

import { app, el, $, header, uses, sheet, commands, ways, tagsFor, guide } from "./common.js";
import { sfx } from "./sound.js";
import { toggle, dismiss, restore, hiddenLine, formatDaysLeft } from "./quest/index.js";

header("quests.html");

const KANJI = ["一", "二", "三", "四", "五", "六", "七", "八"];

/** いま開いている依頼。最初は「つぎにやること」を開いておく */
let open = null;

/** 前に描いたとき、全部終わっていたか。終わった瞬間だけ上へ運ぶために持つ */
let wasCleared = null;

/** 左に出す位。急ぐ・知られていない・前提待ちの順で強いものを出す */
function rankOf(q) {
  if (q.done) return { kind: "済", sub: "おわり", art: "done" };
  if (q.deadline.urgency === "overdue") return { kind: "急", sub: "期限切れ", art: "hurry" };
  if (q.deadline.urgency === "today" || q.deadline.urgency === "soon") {
    return { kind: "急", sub: "まもなく", art: "hurry" };
  }
  if (q.lock.locked) return { kind: "封", sub: "前提あり", art: "locked" };
  if (q.hidden) return { kind: "秘", sub: "見落としがち", art: "hidden" };
  return { kind: "要", sub: "やる", art: "normal" };
}

/** 絵があれば出す。無ければ何も出さない（文字だけで成り立つように作ってある） */
function art(src, cls) {
  const img = el("img", cls);
  img.loading = "lazy";
  img.src = src;
  img.alt = "";
  img.addEventListener("error", () => img.remove());
  return img;
}

function jobCard(q) {
  const card = el("div", "job");
  card.setAttribute("data-done", String(q.done));
  const isOpen = open === q.id;
  card.setAttribute("data-open", String(isOpen));

  // 位。看板を持ったキャラの絵があれば、四角い判子の代わりに出す
  const rank = rankOf(q);
  const left = el("div", "rank");
  const badge = el("div", "badge", rank.kind);
  badge.setAttribute("data-kind", rank.kind);
  badge.append(art(`./characters/rank-${rank.art}.png`, "rankart"));
  left.append(badge);
  if (rank.sub) left.append(el("div", "sub", rank.sub));
  card.append(left);

  const body = el("div", "body");

  // 手続きそのものの絵。右側に置く
  card.append(art(`./characters/quest-${q.id}.png`, "jart"));

  const name = el("div", "jname", q.name);
  name.addEventListener("click", () => {
    open = isOpen ? null : q.id;
    render();
  });
  body.append(name);

  const when = el("div", "jwhen");
  when.append(el("span", null, q.deadline.dueOn ? `${q.deadline.label}　${q.deadline.dueOn} まで` : q.deadline.label));
  const left2 = formatDaysLeft(q.deadline.daysLeft);
  if (left2) when.append(el("span", "left", left2));
  body.append(when);

  if (q.lock.locked) {
    body.append(el("div", "jlock", `先に「${q.lock.blockedByNames.join("」「")}」が終わると、できるようになります`));
  }

  // 開いたときだけ、中身を出す
  if (isOpen) {
    const d = el("div", "detail");
    const row = (k, v, cls) => {
      if (!v) return;
      const r = el("div", `d ${cls ?? ""}`);
      r.append(el("div", "k", k));
      r.append(el("div", `v ${cls === "say" ? "say" : ""}`, v));
      d.append(r);
    };
    row("依頼の中身", q.what);
    row("どこで", q.where);
    row("何て言う", `「${q.sayThis}」`, "say");
    row("得るもの", q.result, "gain");
    row("放っておくと", q.ifNot, "risk");
    if (q.hidden && q.hiddenReason) row("見落とす理由", q.hiddenReason);
    if (q.deadline.note) row("期限のこと", q.deadline.note);
    if (q.need.message) row("あなたの場合", q.need.message);
    if (q.lock.ignoredNames.length > 0) {
      row("待たなくていい", `「${q.lock.ignoredNames.join("」「")}」は要らない判断なので、待たずに進めます`);
    }
    if (q.bring.length > 0) row("持ち物", q.bring.map((b) => b.label).join("　／　"));
    if (q.unverified.length > 0) row("未確認", q.unverified.join(" / "));
    body.append(d);

    const cmd = el("div", "jcmd");
    const done = el("button", null, q.done ? "達成を取り消す" : "達成にする");
    if (q.lock.locked && !q.done) {
      // 前提が終わっていないものを達成にはできない。
      // disabled を使わないのは、押したときに音で伝えたいため
      done.setAttribute("aria-disabled", "true");
      done.className = "no";
      done.title = `先に「${q.lock.blockedByNames.join("」「")}」`;
    } else {
      done.addEventListener("click", () => {
        app.progress = toggle(app.progress, q.id, app.today);
        app.save();
        render();
      });
    }
    cmd.append(done);

    const card2 = el("a", null, "やり方を見る");
    card2.href = `card.html?id=${encodeURIComponent(q.id)}`;
    cmd.append(card2);

    if (q.procedure.steps.length > 0) {
      const sim = el("a", null, "窓口を練習する");
      sim.href = `sim.html?id=${encodeURIComponent(q.id)}`;
      cmd.append(sim);
    }

    const drop = el("button", "quiet", "一覧から外す");
    drop.addEventListener("click", () => {
      app.progress = dismiss(app.progress, q.id);
      app.save();
      open = null;
      render();
    });
    cmd.append(drop);
    body.append(cmd);
  }

  card.append(body);
  return card;
}

/** ぜんぶ終わったときの画面。新しいデータは使わず、いまある数字だけで出す */
function clearPanel(board) {
  const s = board.stats;
  const box = el("div", "clear");

  const dog = el("img", "cleardog");
  dog.src = "./characters/clear-shiba.png";
  dog.alt = "";
  // 専用の絵が無ければ、済の札を持った柴犬をそのまま使う
  dog.addEventListener("error", () => {
    if (dog.src.includes("clear-shiba")) dog.src = "./characters/rank-done.png";
    else dog.remove();
  });
  box.append(dog);

  const body = el("div", "clearbody");
  body.append(el("div", "stampbig", "完"));
  body.append(el("div", "big", "ぜんぶ終わりました"));

  const rows = el("div", "clearrows");
  const counters = [];
  const row = (k, n, shu) => {
    const r = el("div", "r");
    r.append(el("div", "k", k));
    const v = el("div", shu ? "v shu" : "v", "0件");
    counters.push({ node: v, to: n });
    r.append(v);
    rows.append(r);
  };
  row("やった手続き", s.done);
  row("知らないと調べようもなかったもの", s.hidden, s.hidden > 0);
  if (board.notNeeded.length > 0) row("あなたには要らなかったもの", board.notNeeded.length);
  row("期限を過ぎたもの", s.overdue, s.overdue > 0);
  body.append(rows);
  box.append(body);

  // 動きを減らす設定の人には、いきなり出す
  const still =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) {
    for (const c of counters) c.node.textContent = `${c.to}件`;
    return box;
  }

  box.setAttribute("data-anime", "on");

  // 判が押される → 数字が数え上がる → 紙吹雪
  setTimeout(() => sfx.stamp(), 260);
  setTimeout(() => {
    sfx.clear();
    confetti(box);
    for (const c of counters) countUp(c.node, c.to);
  }, 620);

  return box;
}

/** 0 から数え上げる。結果の画面は、数字が動くだけで手応えが変わる */
function countUp(node, to) {
  if (to === 0) {
    node.textContent = "0件";
    return;
  }
  const step = Math.max(1, Math.round(to / 12));
  let n = 0;
  const tick = () => {
    n = Math.min(to, n + step);
    node.textContent = `${n}件`;
    if (n < to) setTimeout(tick, 45);
  };
  tick();
}

/** 紙吹雪。絵は使わず、小さな四角を降らせるだけ */
function confetti(box) {
  const colors = ["#b32d2e", "#2b4a6f", "#e2a52b"];
  const sheet = el("div", "confetti");
  for (let i = 0; i < 40; i++) {
    const bit = el("i");
    bit.style.left = `${Math.random() * 100}%`;
    bit.style.background = colors[i % colors.length];
    bit.style.animationDelay = `${Math.random() * 0.8}s`;
    bit.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
    bit.style.transform = `rotate(${Math.random() * 360}deg)`;
    sheet.append(bit);
  }
  box.append(sheet);
  setTimeout(() => sheet.remove(), 3600);
}

function render() {
  const page = $("page");
  page.replaceChildren();
  const board = app.board();
  const s = board.stats;

  if (open === null && board.next) open = board.next.id;

  const cleared = s.total > 0 && s.remaining === 0;
  if (cleared) page.append(clearPanel(board));

  // 最後の1件を達成した瞬間だけ、いちばん上まで運ぶ。
  // 結果は上に出るので、下の方を見ていると気づけない
  const justCleared = cleared && wasCleared === false;
  wasCleared = cleared;

  // 達成の数を、枡で。終わったあとは結果が主役なので出さない
  const prog = el("div", cleared ? "progress hidden" : "progress");
  prog.append(el("div", "k", "達成"));
  const masu = el("div", "masu");
  const total = s.done + s.remaining;
  for (let i = 0; i < total; i++) {
    const cell = el("i");
    cell.setAttribute("data-on", String(i < s.done));
    masu.append(cell);
  }
  prog.append(masu);
  const n = el("div", "n");
  n.append(el("b", null, String(s.done)));
  n.append(el("span", null, ` / ${total}`));
  prog.append(n);
  page.append(prog);

  if (s.overdue > 0) {
    page.append(el("div", "warn", `期限を過ぎている依頼が ${s.overdue}件あります`));
  }
  const line = hiddenLine(board);
  if (line && !cleared) page.append(guide(line));
  if (board.missingAnswers.length > 0) {
    const a = el("a", "lead", "あなたのことを答えるほど、要るものだけに絞られます →");
    a.href = "chara.html";
    a.style.display = "block";
    page.append(a);
  }

  // 章ごと
  board.phases.forEach((group, i) => {
    const doneCount = group.quests.filter((q) => q.done).length;
    const head = el("div", "chapter");
    head.append(el("div", "no", `${KANJI[i] ?? i + 1} 章`));
    head.append(el("div", "name", group.label));
    head.append(el("div", "count", `${doneCount} / ${group.quests.length} 達成`));
    page.append(head);
    for (const q of group.quests) page.append(jobCard(q));
  });

  // あなたには要らないもの
  if (board.notNeeded.length > 0) {
    const box = sheet("【 あなたには要らないもの 】", String(board.notNeeded.length));
    box.body.className = "sheet-body off";
    for (const q of board.notNeeded) {
      const row = el("div", "row");
      row.append(el("div", "n", q.name));
      const right = el("div", "r");
      right.append(el("div", null, q.need.message ?? "自分で一覧から外したもの"));
      const back = el("button", null, "やっぱり一覧に出す");
      back.addEventListener("click", () => {
        app.progress = restore(app.progress, q.id);
        app.save();
        render();
      });
      right.append(back);
      row.append(right);
      box.body.append(row);
    }
    page.append(box.box);
  }

  // 答えていないうちは市役所へ行けない。先に答えてもらう
  const ready = board.missingAnswers.length === 0;
  page.append(
    commands([
      cleared
        ? ["はじめから", "chara.html?new=1", "答えも達成も消して、まっさらから"]
        : ready
        ? ["出かける準備をする", "counter.html", "かばんを用意して、市役所へ向かう"]
        : ["あなたのことを答える", "chara.html", `あと ${board.missingAnswers.length}問。答えると、この一覧があなた用になります`],
      ["回る順番を見る", "route.html"],
      ready ? ["持ち物メモを出す", "list.html", "スクショして、当日そのまま見られる1枚"] : [],
      ready ? ["あなたのことを答え直す", "chara.html"] : [],
    ]),
  );
  page.append(ways([]));

  if (justCleared) toTop();
}

/** いちばん上へ運ぶ。キーのカーソル移動より後に動かす */
function toTop() {
  const still =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(() => {
    scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
  }, 60);
}

render();

uses([
  ["buildBoard(data, profile, progress, today)", "この画面ぜんぶ。phases / stats / next / notNeeded が入っている"],
  ["board.phases", "期限別のまとまり。ここでは「章」として出しています"],
  ["board.next", "最初に開く1件。鍵がかかっていないうち一番急ぐもの"],
  ["quest.result / quest.ifNot", "得るもの / 放っておくとどうなるか"],
  ["board.notNeeded", "あなたには要らないもの。消さずに理由つきで残す"],
  ["toggle(progress, id, today)", "達成の付け外し。終わった日を日付で持つ"],
  ["dismiss / restore", "本人が一覧から外す・戻す"],
  ["hiddenLine(board)", "「6個のうち4個は…」の一行"],
  ["formatDaysLeft(daysLeft)", "「あと8日」「3日すぎている」"],
]);
