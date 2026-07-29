// ロジック層の入口。画面側はここからだけ import する。
//   import { loadProcedures, buildBoard, toggle } from "@/lib/quest";

export type {
  Benefit,
  BenefitBoard,
  BenefitCard,
  BenefitFile,
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
} from "./types.ts";

export type { DataProblem, ValidationResult } from "./data.ts";
export { loadProcedures, validateProcedures } from "./data.ts";

export type { Choice, Match, Question } from "./profile.ts";
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
} from "./profile.ts";

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
} from "./quests.ts";

export type { SkippedBringLine } from "./bring.ts";
export { bringFor, mergeBring, nonPhysical, notNeededBring, unverifiedBring } from "./bring.ts";
export type { RouteOptions } from "./route.ts";
export { buildRoute, placeKeyOf, sortByRequires } from "./route.ts";

export {
  broughtCount,
  clearBrought,
  complete,
  confirmBeforeComplete,
  dismiss,
  emptyProgress,
  isBrought,
  isDone,
  normalizeProgress,
  pruneProgress,
  reset,
  restore,
  toggle,
  toggleBrought,
  uncomplete,
} from "./progress.ts";

export type { StorageLike } from "./storage.ts";
export {
  KEYS,
  browserStorage,
  clearAll,
  loadProfile,
  loadProgress,
  memoryStorage,
  saveProfile,
  saveProgress,
} from "./storage.ts";

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
} from "./simulation.ts";

export { addDays, diffDays, formatDaysLeft, formatJa, isDateString } from "./dates.ts";

export { buildBoard, hiddenLine, routeLine } from "./board.ts";

export {
  benefitLine,
  buildBenefitBoard,
  decideEligibility,
  loadBenefits,
  toCard,
  validateBenefits,
} from "./benefits.ts";
