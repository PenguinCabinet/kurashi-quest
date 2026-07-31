// 持ち物メモ。
//
// 当日ほんとうに窓口へ持っていくための1枚。
// スクリーンショットを撮るか、印刷して使います。
//
// 新しいロジックは足していません。④回る順番と同じ route.bring を並べているだけです。

import { app, el, $, header, ways, commands } from "./common.js";

header(null);

const board = app.board();
const route = board.route;
const page = $("page");

function art(src, cls) {
  const img = el("img", cls);
  img.loading = "lazy";
  img.src = src;
  img.alt = "";
  img.addEventListener("error", () => img.remove());
  return img;
}

// ── 見出し ──
const head = el("div", "memo-head");
head.append(el("div", "t", "持ち物メモ"));
head.append(
  el(
    "div",
    "s",
    board.missingAnswers.length > 0
      ? "まだ答えていない質問があります。答えるほど、このメモは正確になります"
      : "この画面をスクリーンショットして、当日そのまま見てください",
  ),
);
page.append(head);

// ── どこへ行くか ──
for (const stop of route.stops) {
  if (stop.atHome) continue; // 家でできるものは、持ち物を持っていく必要がない

  const box = el("div", "where");
  box.append(el("div", "k", `${route.stops.filter((s) => !s.atHome).indexOf(stop) + 1} か所目`));
  box.append(el("div", "v", stop.place));
  const hours = stop.quests[0]?.procedure.where.hours;
  if (hours) box.append(el("div", "h", `開いているのは ${hours}`));
  box.append(el("div", "h", stop.quests.map((q) => q.name).join(" ／ ")));
  page.append(box);
}

// ── 持っていくもの ──
if (route.bring.length === 0) {
  page.append(el("div", "lead", "持っていくものはありません"));
} else {
  const list = el("div", "memo-list");
  for (const b of route.bring) {
    const row = el("div", "li");
    row.append(el("div", "box"));
    row.append(art(`./characters/item-${b.id}.png`, null));

    const body = el("div");
    const label = el("div", "label", b.label);
    if (!b.physical) label.append(el("span", "kind", "物ではない"));
    body.append(label);
    if (b.note) body.append(el("div", "note", b.note));
    row.append(body);
    list.append(row);
  }
  page.append(list);
}

// ── 窓口で何て言うか ──
const lines = route.stops.flatMap((stop) =>
  stop.quests.map((q) => ({ place: stop.place, name: q.name, say: q.sayThis })),
);
if (lines.length > 0) {
  const say = el("div", "say");
  say.append(el("div", "k", "窓口で言うこと"));
  for (const l of lines) {
    const row = el("div", "row");
    row.append(el("b", null, `「${l.say}」`));
    row.append(el("span", null, `${l.place}　${l.name}`));
    say.append(row);
  }
  page.append(say);
}

page.append(
  el(
    "div",
    "foot",
    `${board.targetCity}　／　窓口の場所や持ち物は変わることがあります。行く前に渋谷区のサイトでも確かめてください`,
  ),
);

// ── 操作（印刷したときは消える） ──
const cmds = commands([
  ["この紙を印刷する", () => print()],
  ["回る順番にもどる", "route.html"],
]);
cmds.classList.add("noprint");
page.append(cmds);

const back = ways([["クエストログ", "quests.html"]]);
back.classList.add("noprint");
page.append(back);
