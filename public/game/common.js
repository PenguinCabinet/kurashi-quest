// 各ページで共通に使うもの。
// 状態（キャラメイクの答え・進捗・今日の日付）はここでだけ読み書きします。
//
// このプレビューは画面5枚を別々のページにしてあります。本番の画面構成と同じ並びです。
//   chara.html   キャラメイク（入口は index.html のタイトル画面）
//   quests.html  クエストログ
//   card.html    やり方カード（?id= で1件）
//   route.html   役所攻略シート
//   sim.html     窓口の練習（?id= で1件）

import raw from "./quest/procedures.js";
import { keys } from "./keys.js";
import { listen } from "./sound.js";
import {
  loadProcedures,
  buildBoard,
  browserStorage,
  loadProfile,
  loadProgress,
  saveProfile,
  saveProgress,
} from "./quest/index.js";

/** 手続きデータ。壊れていればここで例外になる（画面が黙って空になるより早い） */
export const data = loadProcedures(raw);

const store = browserStorage();
// 「今日」はプレビュー専用の値なので、ロジックが使うキーとは別にする
const TODAY_KEY = "kurashi-quest-preview.today";

/** ?today=2026-08-20 で「今日」を動かせる。期限切れの見え方を確かめる用 */
function todayFromUrl() {
  const raw = new URL(location.href).searchParams.get("today");
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

export const app = {
  profile: loadProfile(store),
  progress: loadProgress(store),
  today: todayFromUrl() || store?.getItem(TODAY_KEY) || new Date().toISOString().slice(0, 10),

  save() {
    saveProfile(store, this.profile);
    saveProgress(store, this.progress);
    try {
      store?.setItem(TODAY_KEY, this.today);
    } catch {
      // 保存できなくても動く
    }
  },

  board() {
    return buildBoard(data, this.profile, this.progress, this.today);
  },
};

// ── 小物 ────────────────────────────────────────────────────

export function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

export function $(id) {
  return document.getElementById(id);
}

export function param(name) {
  return new URL(location.href).searchParams.get(name);
}

/**
 * 台帳の一区切り。見出しと中身を返す。
 * icon を渡すと、見出しの横に小さな絵が付く（絵が無ければ何も出ない）。
 * 見出しの文字は消さない。絵だけにすると、どこに何があるか読めなくなるため。
 */
export function sheet(title, right, icon) {
  const box = el("div", "sheet");
  const head = el("div", "sheet-head");
  const left = el("div", "headline");
  if (icon) {
    const img = el("img", "headicon");
    img.src = `./characters/${icon}.png`;
    img.alt = "";
    img.addEventListener("error", () => img.remove());
    left.append(img);
  }
  left.append(el("span", null, title));
  head.append(left);
  if (right !== undefined && right !== null) head.append(el("div", "count", right));
  box.append(head);
  const body = el("div", "sheet-body");
  box.append(body);
  return { box, body };
}

/** 「項目名：中身」の行をまとめて作る */
export function rows(pairs) {
  const box = el("div", "rows");
  for (const [k, v, note] of pairs) {
    if (v === null || v === undefined || v === "") continue;
    const row = el("div", "r");
    row.append(el("div", "k", k));
    const val = el("div", "v");
    val.append(el("div", null, v));
    if (note) val.append(el("div", "note", note));
    row.append(val);
    box.append(row);
  }
  return box;
}

/** 画面の下に並べるコマンド。[文字, 行き先 or 関数] */
export function commands(list) {
  const box = el("div", "cmds");
  for (const [label, target, small] of list) {
    if (!target) continue;
    const node = typeof target === "string" ? el("a", null, label) : el("button", null, label);
    if (typeof target === "string") node.href = target;
    else node.addEventListener("click", target);
    if (small) node.append(el("span", "small", small));
    box.append(node);
  }
  return box;
}

/**
 * 画面のいちばん下に置く、小さな行き先。
 * 上のバーを出さないので、どの画面からもタイトルへ戻れるようにここで担保します。
 */
export function ways(list) {
  const box = el("div", "ways");
  for (const [label, href] of list) {
    if (!href) continue;
    const a = el("a", null, label);
    a.href = href;
    box.append(a);
  }
  const title = el("a", null, "タイトルにもどる");
  title.href = "index.html";
  box.append(title);
  return box;
}

/**
 * 職員のことばに出てきた役所の言葉を、意味つきで下に並べる。
 *
 * 前はブラウザの吹き出し（title）に入れていたが、
 * 出るまで待たされる・消えると読み返せない・触らないと気づかない、で
 * この作品のいちばんの売りが伝わらなかった。
 */
export function termNotes(text, marked) {
  const found = [];
  for (const part of marked) {
    if (typeof part === "string") continue;
    const t = part.term;
    if (t.plain === t.word) continue;              // 言いかえが無いものは出さない
    if (found.some((x) => x.word === t.word)) continue;
    found.push(t);
  }
  if (found.length === 0) return null;

  const box = el("div", "terms");
  box.append(el("div", "k", "この言葉は"));
  for (const t of found) {
    const row = el("div", "t");
    row.append(el("div", "w", t.word));
    row.append(el("div", "p", t.plain));
    box.append(row);
  }
  return box;
}

/**
 * 案内役の柴犬のひとこと。
 * 画面の隅に貼り付けると、サイトのチャットの吹き出しになってしまうので、
 * その画面の説明文を、そのまま犬に言わせる形にしています。
 */
export function guide(text) {
  const box = el("div", "guide");
  const img = el("img", "guideface");
  img.src = "./characters/shiba-face.png";
  img.alt = "";
  img.addEventListener("error", () => img.remove());
  box.append(img);
  box.append(el("div", "say", text));
  return box;
}

export const URGENCY_LABEL = {
  overdue: "期限切れ",
  today: "今日まで",
  soon: "もうすぐ",
  later: "まだ余裕",
  waiting: "前の手続き待ち",
  anytime: "期限なし",
  unknown: "引越し日しだい",
};

/** クエストの状態を小さな札にする */
export function tagsFor(q) {
  const box = el("div", "tags");
  if (q.hidden) box.append(el("span", "tag hidden", "知らない人が多い"));
  box.append(el("span", `tag ${q.deadline.urgency}`, URGENCY_LABEL[q.deadline.urgency]));
  if (q.need.status === "unsure") box.append(el("span", "tag unsure", "判定できていない"));
  if (q.lock.locked) box.append(el("span", "tag lock", `先に「${q.lock.blockedByNames[0]}」`));
  // 出典をまだ確かめていない項目。数だけ出して、中身はマウスを乗せると見える
  if (q.unverified.length > 0) {
    const t = el("span", "tag todo", `未確認 ${q.unverified.length}`);
    t.title = q.unverified.join(" / ");
    box.append(t);
  }
  return box;
}

/**
 * 上のバーは出しません。ゲームの画面に確認用の帯が乗っていると、
 * それだけで「作りかけの管理画面」に見えてしまうため。
 *
 * 日付を動かして期限切れを見たいときは、アドレスの後ろに付けてください。
 *   quests.html?today=2026-08-20
 */
export function header(_current) {}

/**
 * このページがロジックのどの関数を使っているか。
 * UI担当が「この画面では何を呼べばいいか」を見るための欄です。
 */
export function uses(pairs) {
  const box = el("div", "uses folded");
  const title = el("h2", null, "この画面が呼んでいるもの");
  title.addEventListener("click", () => box.classList.toggle("folded"));
  box.append(title);
  const table = el("table");
  for (const [name, why] of pairs) {
    const tr = el("tr");
    tr.append(el("td", null, name), el("td", null, why));
    table.append(tr);
  }
  box.append(table);
  document.querySelector("main").append(box);
}

/** ?id= のクエストを取り出す。無ければ案内を出して null */
export function questFromUrl(board) {
  const id = param("id");
  const all = [...board.quests, ...board.notNeeded];
  const quest = all.find((q) => q.id === id);
  if (quest) return quest;

  const main = document.querySelector("main");
  main.append(el("h1", null, "その手続きが見つかりません"));
  const back = el("a", "btn", "クエストログにもどる");
  back.href = "quests.html";
  main.append(back);
  return null;
}

// 矢印キー・Enter と 音。全ページ共通なのでここで1回だけ
function boot() {
  keys();
  listen();
}
if (typeof document !== "undefined" && document.body) boot();
else if (typeof document !== "undefined") addEventListener("DOMContentLoaded", boot);
