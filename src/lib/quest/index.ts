// 引越しクエスト ロジック層の入口。
// 画面側はこのファイルからだけ import してください。
//
//   import { loadProcedures, buildBoard, toggle } from "@/lib/quest";
//
// 中の分け方（変わることがあります）
//   types.ts       型。画面もこの型を使う
//   data.ts        procedures.json の読み込みと検証
//   profile.ts     キャラメイクの5問と、答えの正規化
//   quests.ts      出し分け・期限・順番（本体）
//   bring.ts       持ち物
//   route.ts       役所攻略シート
//   progress.ts    チェックの付け外し
//   storage.ts     ブラウザへの保存
//   simulation.ts  窓口の練習
//   dates.ts       日付の計算

export type {
  Board,
  BoardStats,
  BringItem,
  BringLine,
  Checked,
  Deadline,
  DeadlineInfo,
  LockInfo,
  Need,
  Phase,
  PhaseGroup,
  Procedure,
  ProcedureFile,
  Profile,
  ProfileKey,
  Progress,
  Quest,
  RouteSheet,
  RouteStop,
  SimQuestion,
  SimState,
  SimStatus,
  Source,
  Step,
  Urgency,
  WhereField,
} from "./types";

export type { DataProblem, ValidationResult } from "./data";
export { loadProcedures, validateProcedures } from "./data";

export type { Choice, Match, Question } from "./profile";
export {
  ASKED_KEYS,
  QUESTIONS,
  answer,
  clearAnswer,
  emptyProfile,
  isComplete,
  labelOf,
  matchCond,
  missingAnswers,
  normalizeProfile,
  unknownKeys,
} from "./profile";

export {
  PHASE_LABELS,
  buildQuests,
  decideNeed,
  describeCond,
  groupByPhase,
  lockOf,
  notNeededQuests,
  pickNext,
  resolveDeadline,
  sortQuests,
  statsOf,
  toQuest,
  visibleQuests,
} from "./quests";

export { bringFor, mergeBring, nonPhysical, unverifiedBring } from "./bring";
export { buildRoute, placeKeyOf, sortByRequires } from "./route";

export {
  complete,
  confirmBeforeComplete,
  dismiss,
  emptyProgress,
  isDone,
  normalizeProgress,
  pruneProgress,
  reset,
  restore,
  toggle,
  uncomplete,
} from "./progress";

export type { StorageLike } from "./storage";
export {
  KEYS,
  browserStorage,
  clearAll,
  loadProfile,
  loadProgress,
  memoryStorage,
  saveProfile,
  saveProgress,
} from "./storage";

export {
  advance,
  answerItem,
  predictStuck,
  ratio,
  resetSimulation,
  restart,
  startSimulation,
  stuckPoints,
  totalSteps,
} from "./simulation";

export { addDays, diffDays, formatDaysLeft, formatJa, isDateString } from "./dates";

export { buildBoard, hiddenLine, routeLine } from "./board";
