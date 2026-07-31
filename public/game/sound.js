// 効果音。音源ファイルは使わず、その場で作っています。
// 素材の用意が要らず、読み込み待ちも起きません。
//
// BGM は入れていません。手続きの文章を読ませる画面なので、
// 鳴り続ける音は邪魔になります。押したときだけ鳴らします。

const KEY = "kurashi-quest-preview.sound";

let ctx = null;
let master = null;
let toggle = null;

const canPlay = () =>
  typeof window !== "undefined" &&
  (window.AudioContext !== undefined || window.webkitAudioContext !== undefined);

function saved() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export const sound = {
  get on() {
    return saved();
  },
  set on(v) {
    try {
      localStorage.setItem(KEY, v ? "on" : "off");
    } catch {
      // 保存できなくても鳴る
    }
    if (master) master.gain.value = v ? 1 : 0;
    paintToggle();
  },
};

function ready() {
  if (ctx) return ctx;
  if (!canPlay()) return null;
  const Ctx = window.AudioContext ?? window.webkitAudioContext;
  ctx = new Ctx();
  master = ctx.createGain();
  master.gain.value = saved() ? 1 : 0;
  master.connect(ctx.destination);
  return ctx;
}

/**
 * 1音。木を軽く叩いたような音にする。
 * 矩形波・鋸波は使いません。あれを使うと、それだけで昔のゲーム機の音になります。
 */
function note(freq, { at = 0, len = 0.2, vol = 0.1, type = "sine", to = null, cut = 2600 } = {}) {
  const c = ready();
  if (!c) return;
  const t = c.currentTime + at;

  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + len);

  // 高いところを削って、耳に刺さらないようにする
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = cut;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + len);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + len + 0.03);
}

/** 音程のない音。判を押す・紙をめくる */
function noise({ len = 0.12, vol = 0.14, hz = 1400 } = {}) {
  const c = ready();
  if (!c) return;
  const frames = Math.floor(c.sampleRate * len);
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = hz;
  filter.Q.value = 0.7;

  const gain = c.createGain();
  gain.gain.value = vol;

  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(c.currentTime);
}

// ── 場面ごとの音 ──────────────────────────────────────────────
// 役所の机の上で鳴る音、という考え方。
// 紙をめくる・木を叩く・判を押す。電子音にはしません。
export const sfx = {
  /** カーソルが動いた。ここだけ昔のゲームの音（矩形波）にする。
      たくさん鳴る音なので、はっきり短い方が押している手応えになる */
  move: () => note(880, { len: 0.05, vol: 0.05, type: "square", cut: 6000 }),

  /** 決めた。やわらかいポン */
  select: () => note(700, { len: 0.09, vol: 0.1, type: "triangle", cut: 2400 }),

  /** もどる・取り消す。決めた音を低くしたもの */
  back: () => note(440, { len: 0.1, vol: 0.09, type: "triangle", cut: 1800 }),

  /** かばんに入れる。紙を置く */
  put: () => {
    noise({ len: 0.05, vol: 0.07, hz: 1900 });
    note(600, { len: 0.1, vol: 0.04, cut: 1400 });
  },

  /** かばんから出す。紙を取る */
  take: () => noise({ len: 0.06, vol: 0.06, hz: 2900 }),

  /** 判を押す */
  stamp: () => {
    noise({ len: 0.05, vol: 0.16, hz: 700 });
    note(150, { len: 0.16, vol: 0.16, to: 85, cut: 500 });
  },

  /** 断られた。一度だけ低く沈む */
  deny: () => note(150, { len: 0.3, vol: 0.12, to: 120, cut: 500 }),

  /** 押せないものを押した。断られた音を短く、2回 */
  buzz: () => {
    note(170, { len: 0.07, vol: 0.09, cut: 500 });
    note(170, { at: 0.1, len: 0.07, vol: 0.09, cut: 500 });
  },

  /** 歩く音 */
  step: () => noise({ len: 0.06, vol: 0.06, hz: 300 }),

  /** 終わった。やわらかく上がる */
  clear: () => {
    [392, 523, 659].forEach((f, i) =>
      note(f, { at: i * 0.12, len: 0.5, vol: 0.07, type: "triangle", cut: 2000 }),
    );
  },
};

// ── 画面につなぐ ────────────────────────────────────────────
function paintToggle() {
  if (!toggle) return;
  toggle.textContent = sound.on ? "音　入" : "音　切";
  toggle.setAttribute("data-on", String(sound.on));
}

/**
 * 全画面に音をつける。
 * ページごとに書かずに済むよう、押されたものの見た目で音を選びます。
 */
export function listen() {
  if (!canPlay()) return;

  toggle = document.createElement("button");
  toggle.className = "soundtoggle";
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    sound.on = !sound.on;
  });
  document.body.append(toggle);
  paintToggle();

  // ブラウザは、人が触るまで音を出させてくれない
  const wake = () => {
    ready()?.resume?.();
  };
  addEventListener("pointerdown", wake, { once: true });
  addEventListener("keydown", wake, { once: true });

  document.addEventListener(
    "click",
    (e) => {
      if (e.target instanceof Element && e.target.closest(".walk")) return;
      const el = e.target instanceof Element ? e.target.closest("button, a, .item, .alt, .jname") : null;
      if (!el || el === toggle) return;
      if (el.getAttribute("aria-disabled") === "true" || el.hasAttribute("disabled")) {
        sfx.buzz();
        return;
      }
      const text = el.textContent ?? "";

      if (el.classList.contains("mark") || text.startsWith("達成にする")) sfx.stamp();
      else if (el.classList.contains("item") || el.classList.contains("alt")) {
        if (el.classList.contains("on")) sfx.take();
        else sfx.put();
      } else if (/もどる|取り消|外す|やり直|出直|前の質問/.test(text)) sfx.back();
      else sfx.select();
    },
    true,
  );
}
