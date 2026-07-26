// 役所攻略シート。
//
// 「同じ場所でやれるものをまとめて、この順番で回れば1回で終わる」を作ります。
// ゲーム性の中心がここなので、順番・持ち物・所要時間・つまずく箇所を全部この関数から出します。
//
// 順番の決め方
//   1. 前提のある手続きを先に置く（転入届 → マイナンバーカードの住所変更 → 年金）
//   2. 同じ場所（placeKey）のものを1か所にまとめる
//   3. 家でできるもの（Web・電話）は最後に置く。出かける回数に数えない

import type { Procedure, Profile, Quest, RouteSheet, RouteStop } from "./types";
import { mergeBring, nonPhysical } from "./bring";
import { visibleQuests } from "./quests";
import { formatJa } from "./dates";

/** 家でできる場所の placeKey。データ側でこれを付けてもらう */
const AT_HOME_KEYS = new Set(["online", "phone", "web"]);

/**
 * 場所の表示名。窓口ではなく建物の名前を出す。
 * 市民課と国民年金の窓口は別でも、同じ市役所なので1回の外出でまとめたい。
 * ここに無い placeKey は「どこで」の1文目で代用する。
 */
const PLACE_LABELS: Record<string, string> = {
  "city-hall": "市役所",
  "prev-city-hall": "前に住んでいた市の市役所",
  "post-office": "郵便局",
  online: "家（Webか電話）",
  phone: "家（電話）",
  web: "家（Web）",
};

/**
 * 攻略シートを作る。
 * 終わったもの・要らないものは入れません（これから回る順番なので）。
 */
export function buildRoute(quests: Quest[], me: Profile): RouteSheet {
  const todo = sortByRequires(visibleQuests(quests).filter((q) => !q.done));

  const stops: RouteStop[] = [];
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

  // 家でできるものは後ろへ（出かける用事を先に片付ける）
  stops.sort((a, b) => Number(a.atHome) - Number(b.atHome));

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

  return {
    stops,
    trips: stops.filter((s) => !s.atHome).length,
    minutes: stops.reduce((sum, s) => sum + s.minutes, 0),
    bring: all,
    warnings: warningsFor(stops, todo, all),
  };
}

/**
 * 前提を満たす順に並べる。
 * 同じ条件なら phase（引越し前 → 当日 → 14日以内）→ order の順。
 */
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

function byPhaseThenOrder(a: Quest, b: Quest): number {
  const rank = { before: 0, moveDay: 1, within14: 2 } as const;
  const phase = rank[a.phase] - rank[b.phase];
  if (phase !== 0) return phase;
  if (a.order !== b.order) return a.order - b.order;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * 同じ場所かどうかの判定キー。
 * データに placeKey があればそれを使う。無ければ「どこで」の1文目で代用する
 * （"市役所の市民課。転入届と同じ窓口" と "市役所の市民課" を同じ場所とみなすため）。
 */
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

function isAtHome(key: string, p: Procedure): boolean {
  // placeKey が入っていれば、それだけで判断する。
  // 「郵便局の窓口。または e転居（オンライン）」のように、
  // 本文にオンラインの話が混ざっていても場所は郵便局なので、文字で判断すると間違う。
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

  // 未確認
  const unverified = todo.filter((q) => q.unverified.length > 0);
  if (unverified.length > 0) {
    out.push(
      `窓口の名前や持ち物のうち、まだ確認できていない項目が${unverified.length}件の手続きにあります。行く前に自治体のサイトで確認してください`,
    );
  }

  return out;
}
