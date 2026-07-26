// クエストログ画面がこれ1つで描ける、という関数。
//
//   const board = buildBoard(data, profile, progress, "2026-07-28");
//
// あとは board.phases を map してチェックボックスを並べれば、画面ができます。
// 計算は全部この中で終わっているので、画面側で期限や順番を考える必要はありません。

import type { Board, ProcedureFile, Profile, Progress } from "./types";
import {
  buildQuests,
  groupByPhase,
  notNeededQuests,
  pickNext,
  statsOf,
  visibleQuests,
} from "./quests";
import { buildRoute } from "./route";
import { missingAnswers } from "./profile";

export function buildBoard(
  data: ProcedureFile,
  profile: Profile,
  progress: Progress,
  today: string,
): Board {
  const quests = buildQuests(data, profile, progress, today);
  const shown = visibleQuests(quests);

  return {
    today,
    targetCity: data.targetCity,
    dataVersion: data.dataVersion,
    profile,
    missingAnswers: missingAnswers(profile),
    quests: shown,
    notNeeded: notNeededQuests(quests),
    phases: groupByPhase(shown),
    stats: statsOf(quests),
    next: pickNext(quests),
    route: buildRoute(quests, profile),
  };
}

/**
 * 「7個のうち2個は、知らないと調べようもない手続きです」の文。
 * 発表とトップ画面で使う一行。
 */
export function hiddenLine(board: Board): string | null {
  const { total, hidden } = board.stats;
  if (hidden === 0) return null;
  return `${total}個のうち${hidden}個は、知らないと調べようもない手続きです`;
}

/** 「役所は1回、家でできるものが2件」の文 */
export function routeLine(board: Board): string {
  const { trips, stops, minutes } = board.route;
  const atHome = stops.filter((s) => s.atHome).length;
  if (stops.length === 0) return "やることは全部終わっています";
  const parts = [trips === 0 ? "出かける用事はなし" : `出かけるのは${trips}回`];
  if (atHome > 0) parts.push(`家でできるものが${atHome}件`);
  parts.push(`合計の目安は${minutes}分`);
  return parts.join("、");
}
