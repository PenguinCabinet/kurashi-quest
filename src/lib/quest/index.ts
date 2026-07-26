// ロジック層の入口。画面側はここからだけ import する。
//   import { loadProcedures, buildBoard, toggle } from "@/lib/quest";

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
