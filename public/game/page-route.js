// ④ 回る順番。
//
// 「どこを、どの順で回るか」の話なので、双六の盤の形にしています。
// 上に道順の帯、その下に1か所ずつの札。

import { app, el, $, header, uses, sheet, commands, ways, guide } from "./common.js";
import { routeLine } from "./quest/index.js";

header("route.html");

const board = app.board();
const page = $("page");
const route = board.route;

/** 絵があれば出す。無ければ何も出さない */
function art(src, cls) {
  const img = el("img", cls);
  img.src = src;
  img.alt = "";
  img.addEventListener("error", () => img.remove());
  return img;
}

page.append(el("div", "title", "回る順番"));
page.append(guide(`${routeLine(board)}　まとめて回れるところは、まとめてあります。`));

// ── 道順の帯（双六の盤） ──
if (route.stops.length > 0) {
  const strip = el("div", "route");
  route.stops.forEach((stop, i) => {
    if (i > 0) strip.append(el("div", "leg"));

    const spot = el("div", "spot");
    if (stop.atHome) spot.setAttribute("data-home", "true");
    const mark = el("div", "pin");
    mark.append(art(`./characters/place-${stop.placeKey}.png`, "pinart"));
    mark.append(el("span", "no", String(i + 1)));
    spot.append(mark);
    spot.append(el("div", "nm", stop.place));
    spot.append(el("div", "mn", `${stop.minutes}分`));
    strip.append(spot);
  });
  page.append(strip);

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

// ── 行く前の注意 ──
// 前は朱色の段落が5本並んでいて、そこだけで画面の半分を使っていた。
// 数だけ出して、押したときに開く。
if (route.warnings.length > 0) {
  const box = el("div", "cautions folded");
  const head = el("div", "k", `行く前に読むこと　${route.warnings.length}件`);
  head.addEventListener("click", () => box.classList.toggle("folded"));
  box.append(head);
  for (const w of route.warnings) box.append(el("div", "c", w));
  page.append(box);
}

// ── 1か所ずつ ──
for (const [i, stop] of route.stops.entries()) {
  const box = sheet(`【 ${i + 1}か所目 】`, `${stop.minutes}分`);

  const head = el("div", "stop-head");
  head.append(el("div", "no", String(i + 1)));
  head.append(art(`./characters/place-${stop.placeKey}.png`, "placeart"));
  head.append(el("div", null, stop.place));
  if (stop.atHome) head.append(el("div", "min", "出かけなくていい"));
  box.body.append(head);

  for (const q of stop.quests) {
    const row = el("div", "do");
    row.append(art(`./characters/quest-${q.id}.png`, "doart"));

    const body = el("div", "body");
    const a = el("a", null, q.name);
    a.href = `card.html?id=${encodeURIComponent(q.id)}`;
    body.append(a);
    const line = el("div", "line");
    line.append(el("span", "q", `「${q.sayThis}」`), el("span", null, ` と言う　→　${q.result}`));
    body.append(line);
    if (q.lock.locked) {
      body.append(el("div", "warn-min", `先に「${q.lock.blockedByNames.join("」「")}」`));
    }
    row.append(body);
    box.body.append(row);
  }

  box.body.append(el("div", "sub-head", "ここで出すもの"));
  for (const b of stop.bring) {
    const row = el("div", "bring");
    row.append(el("div", "box"));
    row.append(art(`./characters/item-${b.id}.png`, "itemart"));
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

// ── その日ぜんぶの持ち物 ──
if (route.bring.length > 0) {
  const all = sheet("【 この日ぜんぶで持っていくもの 】", String(route.bring.length), "icon-bag");
  for (const b of route.bring) {
    const row = el("div", "bring");
    row.append(el("div", "box"));
    row.append(art(`./characters/item-${b.id}.png`, "itemart"));
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
      : [
          "あなたのことを答える",
          "chara.html",
          `あと ${board.missingAnswers.length}問。答えると、この順番があなた用になります`,
        ],
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
