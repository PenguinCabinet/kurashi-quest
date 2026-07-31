// 役所攻略シート。同じ場所のものをまとめて、前提のある順に並べる。
// 家でできるもの（Web・電話）は最後で、出かける回数に数えない。

import type { Procedure, Profile, Quest, RouteSheet, RouteStop } from "./types.ts";
import { mergeBring, nonPhysical } from "./bring.ts";
import { visibleQuests } from "./quests.ts";
import { formatJa } from "./dates.ts";

/** 家でできる場所の placeKey。データ側でこれを付けてもらう */
const AT_HOME_KEYS = new Set(["online", "phone", "web"]);

/** 場所の表示名。窓口名ではなく建物名（市民課と年金窓口は同じ市役所なのでまとめたい） */
const PLACE_LABELS: Record<string, string> = {
  "city-hall": "市役所",
  "prev-city-hall": "前に住んでいた市の市役所",
  "post-office": "郵便局",
  online: "家（Webか電話）",
  phone: "家（電話）",
  web: "家（Web）",
};

export type RouteOptions = {
  /**
   * 終わったものも残す。既定は false（これから回る順番なので消える）。
   * チェックリストとして見せる画面では true にする（チェックしても行が消えない）。
   */
  includeDone?: boolean;
};

/** 攻略シートを作る。要らないものは入れない。終わったものは既定では入れない */
export function buildRoute(quests: Quest[], me: Profile, options: RouteOptions = {}): RouteSheet {
  const visible = visibleQuests(quests);
  const todo = sortByRequires(options.includeDone ? visible : visible.filter((q) => !q.done));

  let stops: RouteStop[] = [];
  const indexByKey = new Map<string, number>();

  for (const q of todo) {
    const key = placeKeyOf(q.procedure);
    const found = indexByKey.get(key);
    if (found === undefined) {
      indexByKey.set(key, stops.length);
      stops.push({
        placeKey: key,
        place: placeNameOf(q.procedure),
        atHome: isAtHome(key, q.procedure),
        quests: [q],
        minutes: q.minutes,
        bring: [],
        say: [q.sayThis],
      });
      continue;
    }
    const stop = stops[found];
    stop.quests.push(q);
    stop.minutes += q.minutes;
    stop.say.push(q.sayThis);
  }

  // 家でできるものは後ろへ。ただし前提になっているものは、それを待つ場所より前に置く
  stops = orderStops(stops);

  for (const stop of stops) {
    stop.bring = mergeBring(
      stop.quests.map((q) => q.procedure),
      me,
    );
  }

  const all = mergeBring(
    todo.map((q) => q.procedure),
    me,
  );

  // 終わったものを残す場合でも、回数・時間・注意は「これからやる分」だけで出す
  // （終わった手続きに「期限を過ぎています」と出しても意味がないため）
  const remaining = todo.filter((q) => !q.done);
  const remainingBring = mergeBring(
    remaining.map((q) => q.procedure),
    me,
  );

  return {
    stops,
    trips: stops.filter((s) => !s.atHome && s.quests.some((q) => !q.done)).length,
    minutes: remaining.reduce((sum, q) => sum + q.minutes, 0),
    bring: all,
    warnings: warningsFor(stops, remaining, remainingBring),
  };
}

/** 前提を満たす順に並べる。同じ条件なら phase → order の順 */
export function sortByRequires(quests: Quest[]): Quest[] {
  const inList = new Set(quests.map((q) => q.id));
  const rest = [...quests].sort(byPhaseThenOrder);
  const placed = new Set<string>();
  const out: Quest[] = [];

  while (rest.length > 0) {
    // 前提が「リスト内にまだ置かれていない」ものを待つ。
    // リストに無い前提（すでに終わっている手続きなど）は待たない。
    const i = rest.findIndex((q) =>
      q.procedure.requires.every((r) => !inList.has(r) || placed.has(r)),
    );
    if (i === -1) {
      // 循環しているので、残りはそのまま出す（画面が空になるより出す方がいい）
      out.push(...rest);
      break;
    }
    const [q] = rest.splice(i, 1);
    placed.add(q.id);
    out.push(q);
  }
  return out;
}

/**
 * 回る場所の順番。前提を満たした場所の中から、外出 → 家 の順に選ぶ。
 * 単純に「家は最後」にすると、家でやる手続きが他の前提のとき順番が壊れる。
 */
function orderStops(stops: RouteStop[]): RouteStop[] {
  const stopOfQuest = new Map<string, number>();
  stops.forEach((stop, i) => stop.quests.forEach((q) => stopOfQuest.set(q.id, i)));

  // その場所より先に済ませておく必要がある場所
  const dependsOn = stops.map(() => new Set<number>());
  stops.forEach((stop, i) => {
    for (const q of stop.quests) {
      for (const required of q.procedure.requires) {
        const j = stopOfQuest.get(required);
        if (j !== undefined && j !== i) dependsOn[i].add(j);
      }
    }
  });

  const placed = new Set<number>();
  const out: RouteStop[] = [];

  while (out.length < stops.length) {
    const ready = stops
      .map((_, i) => i)
      .filter((i) => !placed.has(i) && [...dependsOn[i]].every((d) => placed.has(d)));

    if (ready.length === 0) {
      // 前提が循環している。残りは元の順で出す（画面が空になるより出す方がいい）
      stops.forEach((stop, i) => {
        if (!placed.has(i)) {
          placed.add(i);
          out.push(stop);
        }
      });
      break;
    }

    ready.sort((a, b) => {
      const home = Number(stops[a].atHome) - Number(stops[b].atHome);
      return home !== 0 ? home : a - b;
    });
    placed.add(ready[0]);
    out.push(stops[ready[0]]);
  }

  return out;
}

function byPhaseThenOrder(a: Quest, b: Quest): number {
  const rank = { before: 0, moveDay: 1, within14: 2 } as const;
  const phase = rank[a.phase] - rank[b.phase];
  if (phase !== 0) return phase;
  if (a.order !== b.order) return a.order - b.order;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** 同じ場所かの判定キー。placeKey が無ければ「どこで」の1文目で代用する */
export function placeKeyOf(p: Procedure): string {
  if (p.where.placeKey) return p.where.placeKey;
  return firstSentence(p.where.text);
}

function placeNameOf(p: Procedure): string {
  const key = p.where.placeKey;
  if (key && PLACE_LABELS[key]) return PLACE_LABELS[key];
  return firstSentence(p.where.text);
}

function firstSentence(text: string): string {
  const cut = text.split(/[。．\n]/)[0].trim();
  return cut === "" ? text.trim() : cut;
}

/**
 * 家でできる手続きか（Web・電話）。
 * 窓口の会話は職員とのやり取りなので、こちらは出さない。
 */
export function isAtHomeProcedure(p: Procedure): boolean {
  return isAtHome(placeKeyOf(p), p);
}

function isAtHome(key: string, p: Procedure): boolean {
  // placeKey があればそれだけで判断する（本文にオンラインの話が混ざると文字では誤判定する）
  if (p.where.placeKey) return AT_HOME_KEYS.has(key);
  return /Web|web|ウェブ|サイト|オンライン|電話|マイナポータル/.test(p.where.text);
}

function warningsFor(stops: RouteStop[], todo: Quest[], allBring: RouteSheet["bring"]): string[] {
  const out: string[] = [];

  // 物でない持ち物（暗証番号など）。これで出直す人がいちばん多い
  for (const item of nonPhysical(allBring)) {
    out.push(`${item.label}は持ち物ではありません。行く前に思い出しておいてください`);
  }

  // 順番（同じ場所の中／別の場所）
  for (const q of todo) {
    if (!q.lock.locked) continue;
    for (let i = 0; i < q.lock.blockedBy.length; i++) {
      const blockerId = q.lock.blockedBy[i];
      const blockerName = q.lock.blockedByNames[i] ?? blockerId;
      const sameStop = stops.some(
        (s) => s.quests.some((x) => x.id === q.id) && s.quests.some((x) => x.id === blockerId),
      );
      const where = sameStop ? "同じ窓口で続けてできます" : "先に別の場所で終わらせてください";
      out.push(`「${blockerName}」を先に終わらせないと、「${q.name}」はできません。${where}`);
    }
  }

  // 期限
  for (const q of todo) {
    if (q.deadline.urgency === "overdue" && q.deadline.dueOn) {
      out.push(`「${q.name}」は期限（${formatJa(q.deadline.dueOn)}）を過ぎています。すぐ行ってください`);
    }
  }

  // 行く前の注意。
  //
  // 前は「未確認が◯件あります」と出していたが、これは作り手の都合。
  // 使う人に要るのは「窓口は変わることがあるので、行く前に見てください」だけ。
  // 件数に関係なく、いつも出す
  if (todo.length > 0) {
    out.push(
      "窓口の場所や持ち物は変わることがあります。行く前に渋谷区のサイトでも確かめてください",
    );
  }

  return out;
}
