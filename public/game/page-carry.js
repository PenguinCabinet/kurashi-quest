// 合言葉。
//
// パソコンで準備して、スマホを持って窓口へ行く。それだけのための画面です。
// ログインはありません。合言葉が鍵そのものなので、なくすと戻せません。

import { app, el, $, sheet, commands, ways, guide, myCode, rememberCode, forgetCode } from "./common.js";
import { sfx } from "./sound.js";
import {
  PASSPHRASE_LENGTH,
  formatPassphrase,
  normalizePassphrase,
  isPassphrase,
  pullSave,
  pushSave,
  syncLine,
} from "./quest/index.js";

const page = $("page");

page.append(el("div", "title", "べつの端末でつづける"));
page.append(
  guide(
    "合言葉をひとつ受け取って、もう一方の端末で打ちこみます。" +
      "一度受け取れば、あとは進めるたびに自動で預けます。ログインはありません。",
  ),
);

// ── ① 合言葉を受け取る ──
const give = sheet("【 この端末の続きを預ける 】", null);
const said = el("div", "said");
const code = el("div", "code");
const codeNote = el("div", "code-note");

const has = myCode();
if (has) {
  code.textContent = formatPassphrase(has);
  codeNote.textContent = "この端末は、進めるたびに自動でここへ預けています";
}

const getBtn = el("button", null, has ? "いまの続きを預け直す" : "合言葉を受け取る");
// 前の合言葉を残したまま、新しい方に移りたいとき用。
// 預け直すと前の合言葉の中身が入れ替わるので、分けられる道が要る
const newBtn = el("button", null, "別の合言葉にする");

const giveRow = el("div", "enter");
giveRow.append(getBtn);
if (has) giveRow.append(newBtn);

/** 預ける。fresh なら、いまの合言葉を使わずに新しくもらう */
async function deposit(fresh) {
  sfx.select();
  getBtn.disabled = true;
  newBtn.disabled = true;
  said.removeAttribute("data-ng");
  said.textContent = "預けています…";

  const r = await pushSave(fetch, app.profile, app.progress, fresh ? null : myCode());
  getBtn.disabled = false;
  newBtn.disabled = false;

  if (!r.ok) {
    said.setAttribute("data-ng", "true");
    said.textContent = syncLine(r);
    sfx.buzz();
    return;
  }
  rememberCode(r.code);
  code.textContent = formatPassphrase(r.code);
  codeNote.textContent = "この6文字を、もう一方の端末で打ちこんでください";
  said.textContent = fresh ? "新しい合言葉にしました" : "いまの続きを預けました";
  getBtn.textContent = "いまの続きを預け直す";
  if (!giveRow.contains(newBtn)) giveRow.append(newBtn);
  sfx.stamp();
}

getBtn.addEventListener("click", () => deposit(false));
newBtn.addEventListener("click", () => deposit(true));

give.body.append(code, codeNote, giveRow, said);
if (has) {
  give.body.append(
    el(
      "div",
      "have",
      "ふだんは押さなくて構いません。進めるたびに自動で預けています。" +
        "「別の合言葉にする」を押すと、前の合言葉はそのまま残り、この端末は新しい方に移ります。",
    ),
  );
}
page.append(give.box);

// ── ② 合言葉を打ちこむ ──
const take = sheet("【 合言葉で続きを読みこむ 】", null);
const took = el("div", "said");
const input = el("input");
input.type = "text";
input.inputMode = "latin";
input.autocapitalize = "characters";
input.autocomplete = "off";
input.spellcheck = false;
input.maxLength = PASSPHRASE_LENGTH + 2; // 空白ぶんの余裕
input.placeholder = "＿＿＿＿＿＿";
input.setAttribute("aria-label", "合言葉");

const takeBtn = el("button", null, "読みこむ");
takeBtn.disabled = true;

input.addEventListener("input", () => {
  const cleaned = normalizePassphrase(input.value);
  if (input.value.toUpperCase() !== cleaned) input.value = cleaned;
  takeBtn.disabled = !isPassphrase(cleaned);
  took.removeAttribute("data-ng");
  took.textContent = "";
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !takeBtn.disabled) takeBtn.click();
});

takeBtn.addEventListener("click", async () => {
  sfx.select();
  takeBtn.disabled = true;
  took.removeAttribute("data-ng");
  took.textContent = "読みこんでいます…";

  const r = await pullSave(fetch, input.value);
  if (!r.ok) {
    took.setAttribute("data-ng", "true");
    took.textContent = syncLine(r);
    takeBtn.disabled = false;
    sfx.buzz();
    return;
  }

  // この端末の中身を、読みこんだもので置き換える
  app.profile = r.data.profile;
  app.progress = r.data.progress;
  app.save();
  rememberCode(normalizePassphrase(input.value));

  took.textContent = "読みこみました。クエストログへ移ります";
  sfx.clear();
  setTimeout(() => {
    location.href = "quests.html";
  }, 700);
});

const takeRow = el("div", "enter");
takeRow.append(input, takeBtn);
take.body.append(takeRow, took);
take.body.append(
  el(
    "div",
    "have",
    "読みこむと、この端末のいまの内容は上書きされます。先に上で預けておくと、戻せます。",
  ),
);
page.append(take.box);

// 下に出る「もどる」と重なるので、ここではタイトルを出さない
page.append(commands([["クエストログにもどる", "quests.html"]]));
page.append(ways([["タイトル", "index.html"]]));
