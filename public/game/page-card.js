// ③ やり方カード（1手続き1ページ）。
// クエスト1件の中身を、そのまま並べているだけです。

import { app, el, $, header, tagsFor, uses, questFromUrl, sheet, rows, commands, ways, guide } from "./common.js";
import { toggle, dismiss, formatDaysLeft, stuckPoints } from "./quest/index.js";

header(null);

const board = app.board();
const quest = questFromUrl(board);
if (quest) render(quest);

function render(q) {
  const page = $("page");
  page.replaceChildren();

  const back = el("a", "back", "← クエストログにもどる");
  back.href = "quests.html";
  page.append(back);

  const head0 = el("div", "title titleart");
  const qart = el("img", "titleicon");
  qart.src = `./characters/quest-${q.id}.png`;
  qart.alt = "";
  qart.addEventListener("error", () => qart.remove());
  head0.append(qart);
  head0.append(el("span", null, q.name));
  page.append(head0);
  page.append(tagsFor(q));
  page.append(guide(`${q.what}。やらないと ${q.ifNot}`));
  if (q.hidden && q.hiddenReason) page.append(el("div", "warn", q.hiddenReason));

  // ── どこで、何て言う ──
  const head = sheet("【 この手続きのこと 】", `${q.minutes}分`);
  head.body.append(
    rows([
      ["どこで", q.where],
      ["何て言う", `「${q.sayThis}」`],
      ["終わると", q.result],
      [
        "期限",
        q.deadline.label,
        q.deadline.dueOn ? `${q.deadline.dueOn}　${formatDaysLeft(q.deadline.daysLeft)}` : q.deadline.note,
      ],
    ]),
  );
  if (q.deadline.dueOn && q.deadline.note) head.body.append(el("div", "lead", q.deadline.note));
  if (q.need.message) head.body.append(el("div", "lead", q.need.message));
  page.append(head.box);

  // ── 先にやること ──
  if (q.lock.locked) {
    const box = el("div", "warn");
    box.append(el("span", null, "先にこれを終わらせてください　"));
    for (const [i, id] of q.lock.blockedBy.entries()) {
      const a = el("a", null, `「${q.lock.blockedByNames[i]}」`);
      a.href = `card.html?id=${encodeURIComponent(id)}`;
      box.append(a);
    }
    page.append(box);
  }
  if (q.lock.ignoredNames.length > 0) {
    page.append(
      el("div", "lead", `「${q.lock.ignoredNames.join("」「")}」は要らない判断なので、待たずに進めます`),
    );
  }

  // ── 持ち物 ──
  const bag = sheet("【 持ち物 】", q.bring.length > 0 ? `${q.bring.length}` : null);
  if (q.bring.length === 0) {
    bag.body.append(el("div", "lead", "とくにありません"));
  } else {
    for (const b of q.bring) {
      const row = el("div", "bring");
      row.append(el("div", "box"));
      const bart = el("img", "itemart");
      bart.loading = "lazy";
      bart.src = `./characters/item-${b.id}.png`;
      bart.alt = "";
      bart.addEventListener("error", () => bart.remove());
      row.append(bart);
      const body = el("div");
      body.append(el("div", "label", b.label));
      if (!b.physical) body.append(el("div", "kind", "物ではありません。忘れやすい"));
      if (b.note) body.append(el("div", "note", b.note));
      if (!b.verified) body.append(el("div", "note", "出典をまだ確かめていません"));
      row.append(body);
      bag.body.append(row);
    }
  }
  page.append(bag.box);

  // ── 窓口での手順 ──
  const points = stuckPoints(q.procedure);
  const steps = sheet(
    "【 窓口での手順 】",
    points.length > 0 ? `詰まりやすい ${points.length}か所` : null,
  );
  if (q.procedure.steps.length === 0) {
    steps.body.append(el("div", "lead", "手順がまだ入っていません"));
  } else {
    for (const s of q.procedure.steps) {
      const line = el("div", "step");
      line.append(el("div", "n", String(s.n)));
      const t = el("div", "t", s.text);
      if (s.stuckIf) t.append(el("div", "caution", `ここで止まることがあります：${s.stuckIf.message}`));
      line.append(t);
      steps.body.append(line);
    }
  }
  page.append(steps.box);

  // ── 出典 ──
  if (q.procedure.sources.length > 0) {
    const src = sheet("【 出典 】", null);
    for (const s of q.procedure.sources) {
      const line = el("div", "src");
      const a = el("a", null, s.name);
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      line.append(a, el("span", null, `${s.fetchedAt} 取得${s.verified ? "" : "・未確認"}`));
      src.body.append(line);
    }
    page.append(src.box);
  }

  if (q.unverified.length > 0) {
    page.append(
      el("div", "lead", `出典をまだ確かめていない項目：${q.unverified.join(" / ")}`),
    );
  }

  // ── コマンド ──
  page.append(
    commands([
      q.procedure.steps.length > 0
        ? ["窓口を練習する", `sim.html?id=${encodeURIComponent(q.id)}`, "行く前に、ここで一度ためす"]
        : [],
      [
        q.done ? "終わっていないことにする" : "終わったことにする",
        () => {
          app.progress = toggle(app.progress, q.id, app.today);
          app.save();
          location.reload();
        },
      ],
      !q.dismissed
        ? [
            "一覧から外す",
            () => {
              app.progress = dismiss(app.progress, q.id);
              app.save();
              location.href = "quests.html";
            },
          ]
        : [],
    ]),
  );

  page.append(ways([["クエストログ", "quests.html"], ["回る順番", "route.html"]]));

  uses([
    ["board.quests / board.notNeeded", "クエスト1件。ここにある値をそのまま並べるだけ"],
    ["quest.bring", "その人に必要な持ち物だけ。物でないもの（暗証番号）は physical:false"],
    ["quest.lock", "前提が終わっていないと locked。ignoredNames は待たない前提"],
    ["quest.unverified", "未確認の項目名。画面に「未確認」の札を出す用"],
    ["quest.procedure.steps", "窓口の手順。stuckIf があるところで止まる"],
    ["stuckPoints(procedure)", "詰まりやすい箇所の数"],
    ["toggle / dismiss", "チェックと「要らない」"],
  ]);
}
