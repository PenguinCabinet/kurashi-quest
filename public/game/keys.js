// 矢印キーとEnterで、どの画面も動かせるようにする。
//
// 画面ごとに書くと、直し忘れたページだけキーが効かなくなります。
// なので common.js から1回だけ呼んで、押せるものを画面から拾います。
//
// 画面は作り直されるので（replaceChildren）、DOMの変化を見て拾い直します。

import { sfx } from "./sound.js";

const PICKABLE = [
  ".cmds button",
  ".cmds a",
  ".opts button",
  ".item",
  ".alt",
  ".jname",
  ".jcmd button",
  ".jcmd a",
  ".ways a",
  ".back",
].join(", ");

/** 実際に押せるものか。見るだけのものは、押しても何も起きない */
function actionable(el) {
  if (el.hasAttribute("disabled") || el.getAttribute("aria-disabled") === "true") return false;
  if (el.tagName === "A") return Boolean(el.getAttribute("href"));
  if (el.tagName === "BUTTON") return true;
  return el.classList.contains("item") || el.classList.contains("alt") || el.classList.contains("jname");
}

let items = [];
let at = -1;
// キーで動かしているときだけ枠を出す。マウスのときは :hover に任せる
let byKey = false;
let used = false;
let hint = null;

/** 歩いている間は、後ろの画面を動かさない */
function busy() {
  return document.querySelector(".walk") !== null;
}

function inInput() {
  const el = document.activeElement;
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
}

function collect() {
  const found = [...document.querySelectorAll(PICKABLE)].filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  );
  // 前に選んでいたものが残っていれば、そこに留まる
  const keep = items[at];
  items = found;
  const again = keep ? found.indexOf(keep) : -1;
  at = again >= 0 ? again : Math.min(at, found.length - 1);
  paint();
}

function paint() {
  for (const el of items) el.removeAttribute("data-key");
  const now = items[at];
  if (!now || !byKey) return;
  now.setAttribute("data-key", "on");
  now.scrollIntoView({ block: "nearest" });
}

function move(step) {
  if (items.length === 0) return;
  byKey = true;
  at = at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length;
  paint();
  sfx.move();
  showHint(false);
}

function showHint(on) {
  if (!hint) return;
  if (on) hint.removeAttribute("hidden");
  else hint.setAttribute("hidden", "");
  used = !on;
}

export function keys() {
  // ブラウザ以外（確認用の実行）では何もしない
  if (typeof MutationObserver === "undefined" || typeof document.querySelectorAll !== "function") return;
  // タイトル画面は自前で持っているので、そちらに任せる
  if (document.body.dataset?.keys === "off") return;

  hint = document.createElement("div");
  hint.className = "keyhint";
  hint.textContent = "↑ ↓ でえらぶ　Enter でけってい";
  document.body.append(hint);

  const watch = new MutationObserver(() => requestAnimationFrame(collect));
  watch.observe(document.body, { childList: true, subtree: true });
  requestAnimationFrame(collect);

  addEventListener("keydown", (e) => {
    if (inInput() || busy()) return;
    if (e.key === "ArrowDown" || e.key === "j") {
      move(1);
      e.preventDefault();
    } else if (e.key === "ArrowUp" || e.key === "k") {
      move(-1);
      e.preventDefault();
    } else if (e.key === "Enter" || e.key === " ") {
      const now = items[at];
      if (!now) return;
      // 押せないものは、押せないと分かるように鳴らすだけ
      if (actionable(now)) now.click();
      else sfx.buzz();
      e.preventDefault();
    }
  });

  // マウスで触ったときも、カーソルをそこへ移す
  document.addEventListener("pointerover", (e) => {
    const el = e.target instanceof Element ? e.target.closest(PICKABLE) : null;
    if (!el) return;
    const i = items.indexOf(el);
    if (i < 0) return;
    // マウスで触ったら枠は消す。どちらが今の位置か分からなくなるため
    byKey = false;
    at = i;
    paint();
  });

  // 一度でも使ったら、案内は出さない
  setTimeout(() => {
    if (!used) hint.removeAttribute("hidden");
  }, 1200);
}
