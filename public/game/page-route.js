// ④ 回る順番（役所攻略シート）。
// 同じ場所でやれるものをまとめて、前提のある順に並べたものです。

import { app, el, $, header, uses, sheet, commands, ways } from "./common.js";
import { routeLine } from "./quest/index.js";

header("route.html");

const board = app.board();
const page = $("page");
const route = board.route;

page.append(el("div", "title", "回る順番"));
page.append(el("div", "lead", routeLine(board)));

if (route.stops.length > 0) {
  const tally = el("div", "tally");
  const num = (k, v) => {
    const cell = el("span", null, k);
    cell.append(el("b", null, String(v)));
    tally.append(cell);
  };
  num("出かける回数", `${route.trips}回`);
  num("合計の目安", `${route.minutes}分`);
  page.append(tally);
}

for (const w of route.warnings) page.append(el("div", "warn", w));

for (const [i, stop] of route.stops.entries()) {
  const box = sheet(`【 ${i + 1}か所目 】`, `${stop.minutes}分`);

  const head = el("div", "stop-head");
  head.append(el("div", "no", String(i + 1)));
  head.append(el("div", null, stop.place));
  if (stop.atHome) head.append(el("div", "min", "出かけなくていい"));
  box.body.append(head);

  for (const q of stop.quests) {
    const row = el("div", "do");
    const a = el("a", null, q.name);
    a.href = `card.html?id=${encodeURIComponent(q.id)}`;
    row.append(a);
    const line = el("div", "line");
    line.append(el("span", "q", `「${q.sayThis}」`), el("span", null, ` と言う　→　${q.result}`));
    row.append(line);
    if (q.lock.locked) {
      row.append(el("div", "warn-min", `先に「${q.lock.blockedByNames.join("」「")}」`));
    }
    box.body.append(row);
  }

  box.body.append(el("div", "sub-head", "ここで出すもの"));
  for (const b of stop.bring) {
    const row = el("div", "bring");
    row.append(el("div", "box"));
    const body = el("div");
    body.append(el("div", null, b.label));
    if (!b.physical) body.append(el("div", "note", "物ではありません。忘れやすい"));
    if (b.note) body.append(el("div", "note", b.note));
    body.append(el("div", "for", `${b.neededFor.length}件の手続きで使います`));
    if (!b.verified) body.append(el("div", "note", "出典をまだ確かめていません"));
    row.append(body);
    box.body.append(row);
  }

  page.append(box.box);
}

if (route.bring.length > 0) {
  const all = sheet("【 この日ぜんぶで持っていくもの 】", String(route.bring.length));
  for (const b of route.bring) {
    const row = el("div", "bring");
    row.append(el("div", "box"));
    const body = el("div");
    body.append(el("div", null, b.label));
    if (!b.physical) body.append(el("div", "note", "物ではありません"));
    row.append(body);
    all.body.append(row);
  }
  page.append(all.box);
}

// 答えていないうちは市役所へ行けない。②と同じ扱いにする
const ready = board.missingAnswers.length === 0;
page.append(
  commands([
    ready
      ? ["出かける準備をする", "counter.html"]
      : ["あなたのことを答える", "chara.html", `あと ${board.missingAnswers.length}問。答えると、この順番があなた用になります`],
    ["クエストログにもどる", "quests.html"],
  ]),
);
page.append(ways(ready ? [["あなたのこと", "chara.html"]] : []));

uses([
  ["board.route.stops", "回る場所の順。同じ placeKey は1か所にまとまる"],
  ["stop.bring", "その場所の持ち物。手続きをまたいで1行にまとめたもの"],
  ["bring.neededFor", "何のために持つか（まとめた元の手続き）"],
  ["board.route.trips / minutes", "出かける回数と合計時間。家でできるものは回数に数えない"],
  ["board.route.warnings", "暗証番号・順番・期限切れ・未確認の注意"],
  ["routeLine(board)", "「出かけるのは3回、家でできるものが1件」の一行"],
]);
