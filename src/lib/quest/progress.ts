// 進捗。全部この形の値を作り直して返すだけの関数です（元の値は書き換えません）。
// React の useState / useReducer にそのまま入ります。
//
// 「終わった日」を日付で持っているのは、
// マイナンバーカードの住所変更のように「転入届をした日から90日」で期限が決まるものがあるためです。
// true / false で持つと、この期限が計算できなくなります。

import type { Progress, Quest } from "./types";
import { isDateString } from "./dates";

export function emptyProgress(): Progress {
  return { doneAt: {}, dismissed: [] };
}

/** 保存されていた値を読む。壊れていたら捨てて空にする（古い形で画面が落ちないように） */
export function normalizeProgress(raw: unknown): Progress {
  const out = emptyProgress();
  if (typeof raw !== "object" || raw === null) return out;
  const r = raw as Record<string, unknown>;

  if (typeof r.doneAt === "object" && r.doneAt !== null) {
    for (const [id, date] of Object.entries(r.doneAt as Record<string, unknown>)) {
      if (typeof id === "string" && id !== "" && isDateString(date)) out.doneAt[id] = date;
    }
  }
  if (Array.isArray(r.dismissed)) {
    for (const id of r.dismissed) {
      if (typeof id === "string" && id !== "" && !out.dismissed.includes(id)) out.dismissed.push(id);
    }
  }
  return out;
}

/** 終わったことにする。today は呼ぶ側が渡す（期限の起算日になるので、実際に終えた日を入れる） */
export function complete(progress: Progress, id: string, today: string): Progress {
  if (!isDateString(today)) return progress;
  return { ...progress, doneAt: { ...progress.doneAt, [id]: today } };
}

/** 終わっていないことに戻す */
export function uncomplete(progress: Progress, id: string): Progress {
  if (progress.doneAt[id] === undefined) return progress;
  const doneAt = { ...progress.doneAt };
  delete doneAt[id];
  return { ...progress, doneAt };
}

/** チェックボックスの ON / OFF */
export function toggle(progress: Progress, id: string, today: string): Progress {
  return isDone(progress, id) ? uncomplete(progress, id) : complete(progress, id, today);
}

/** 本人が「これは要らない」と消す。データからは消さないので、あとで戻せる */
export function dismiss(progress: Progress, id: string): Progress {
  if (progress.dismissed.includes(id)) return progress;
  return { ...progress, dismissed: [...progress.dismissed, id] };
}

/** 消したものを戻す */
export function restore(progress: Progress, id: string): Progress {
  if (!progress.dismissed.includes(id)) return progress;
  return { ...progress, dismissed: progress.dismissed.filter((x) => x !== id) };
}

export function reset(): Progress {
  return emptyProgress();
}

export function isDone(progress: Progress, id: string): boolean {
  return progress.doneAt[id] !== undefined;
}

/**
 * チェックを付けていいか。
 * 鍵がかかっているものにチェックを付けるのは止めません（本人が別ルートで済ませた場合があるため）。
 * 代わりに、確認を出すべきかどうかをここで返します。
 */
export function confirmBeforeComplete(quest: Quest): string | null {
  if (!quest.lock.locked) return null;
  return `「${quest.lock.blockedByNames.join("」「")}」が終わっていません。それでも終わったことにしますか？`;
}

/** 進捗のうち、いま出ているクエストに無い id を捨てる（データから手続きが消えたとき用） */
export function pruneProgress(progress: Progress, knownIds: string[]): Progress {
  const known = new Set(knownIds);
  const doneAt: Progress["doneAt"] = {};
  for (const [id, date] of Object.entries(progress.doneAt)) {
    if (known.has(id)) doneAt[id] = date;
  }
  return { doneAt, dismissed: progress.dismissed.filter((id) => known.has(id)) };
}
