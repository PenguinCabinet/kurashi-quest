// 場所を移るときに挟む、歩いている画面。
//
// 押した瞬間に切り替わると、家と窓口が別の場所だと伝わりません。
// 「歩いて行った」という間を置くための、1.6秒だけの画面です。

import { sfx } from "./sound.js";

/**
 * 主人公の絵を入れる。
 * 歩いている2コマ（walk-◯-a / -b）があれば交互に出し、
 * 無ければキャラメイクの上半身の絵をそのまま出す。
 */
function setHero(box, name, a, b) {
  let ready = 0;
  const check = () => {
    if (++ready === 2) box.classList.add("has-legs");
  };
  a.addEventListener("load", check);
  b.addEventListener("load", check);
  a.addEventListener("error", () => {
    a.src = `./characters/pick-${name}.png`;
    b.remove();
  }, { once: true });
  b.addEventListener("error", () => b.remove(), { once: true });

  a.src = `./characters/walk-${name}-a.png?v=2`;
  b.src = `./characters/walk-${name}-b.png?v=2`;
}

/** キャラメイクの答えから、主人公を決める */
function who(profile) {
  return profile?.occupation === "worker" ? "worker" : "student";
}

/**
 * @param {object} opts
 *   to       行き先の名前（「市役所」「家」）
 *   from     いまいる場所の背景（"home" | "counter"）
 *   into     着いた先の背景
 *   profile  主人公の絵を選ぶのに使う
 *   done     着いたときに呼ぶ
 */
/** 歩いている時間。CSS の動きもこの値から作るので、ここだけ直せばいい */
const MS = 3200;

export function walkTo({ to, from = "home", into = "counter", profile, done }) {
  const finish = () => {
    box.remove();
    done?.();
  };

  // 動きを減らす設定の人には見せない
  const still =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) {
    done?.();
    return;
  }

  const box = document.createElement("div");
  box.className = "walk";
  // 帰りは、行きと逆に進む
  box.dataset.dir = into === "home" ? "back" : "go";
  box.style.setProperty("--ms", `${MS}ms`);
  box.innerHTML = `
    <div class="walk-bg" data-place="${from}"></div>
    <div class="walk-bg into" data-place="${into}"></div>
    <div class="walk-street"></div>
    <div class="walk-road"></div>
    <div class="walk-hero">
      <img class="a" alt="" />
      <img class="b" alt="" />
    </div>
    <div class="walk-say">
      <div class="to">${to} へ向かっています</div>
      <div class="line"><i></i></div>
    </div>
  `;
  // 歩いている2コマがあれば、それを交互に出す。
  // 無ければ、キャラメイクで使っている上半身の絵をそのまま出す。
  const name = who(profile);
  const a = box.querySelector("img.a");
  const b = box.querySelector("img.b");
  if (a && b) setHero(box, name, a, b);
  document.body.append(box);

  // 道の絵が用意できていれば、背景を流して、主人公はその場で歩く。
  // 無ければ、家と窓口を入れ替えるだけの見せ方になる
  if (typeof Image === "function") {
    const street = new Image();
    street.addEventListener("load", () => box.classList.add("has-street"));
    street.src = "./characters/bg-street.jpg";
  }

  // 足音。歩幅に合わせて、着くまで鳴らす
  const steps = [];
  for (let ms = 120; ms < MS - 200; ms += 400) {
    steps.push(setTimeout(() => sfx.step(), ms));
  }

  // とばせません。ここは「家と役所は別の場所だ」と伝えるための間なので、
  // 飛ばせるようにすると、押した人には最初から無いのと同じになります。
  setTimeout(finish, MS);
}
