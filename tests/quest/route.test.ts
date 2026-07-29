import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRoute } from "../../src/lib/quest/route.ts";
import { mergeBring, notNeededBring } from "../../src/lib/quest/bring.ts";
import { buildQuests } from "../../src/lib/quest/quests.ts";
import { complete, emptyProgress } from "../../src/lib/quest/progress.ts";
import { TODAY, realData, student, worker } from "./fixture.ts";

const data = realData();
const questsFor = (progress = emptyProgress()) => buildQuests(data, student, progress, TODAY);

test("同じ市役所でやるものが1か所にまとまる", () => {
  const route = buildRoute(questsFor(), student);
  const cityHall = route.stops.find((s) => s.placeKey === "city-hall")!;
  assert.deepEqual(
    cityHall.quests.map((q) => q.id),
    ["tennyu-todoke", "mynumber-address", "gakusei-nofu-tokurei"],
  );
  assert.equal(cityHall.place, "市役所");
});

test("市役所の中は、転入届が先になる（順番が守られていないと受け付けてもらえない）", () => {
  const route = buildRoute(questsFor(), student);
  const ids = route.stops.flatMap((s) => s.quests.map((q) => q.id));
  assert.ok(ids.indexOf("tennyu-todoke") < ids.indexOf("mynumber-address"));
  assert.ok(ids.indexOf("tennyu-todoke") < ids.indexOf("gakusei-nofu-tokurei"));
});

test("家でできるものは最後に回り、出かける回数に数えない", () => {
  const route = buildRoute(questsFor(), student);
  assert.equal(route.stops[route.stops.length - 1].placeKey, "online");
  assert.equal(route.stops.find((s) => s.placeKey === "online")!.atHome, true);
  // 出かけるのは 前の市役所・郵便局・市役所 の3回
  assert.equal(route.trips, 3);
});

test("郵便局はオンラインでもできると書いてあるが、場所としては郵便局のまま", () => {
  const route = buildRoute(questsFor(), student);
  const post = route.stops.find((s) => s.placeKey === "post-office")!;
  assert.equal(post.atHome, false);
});

test("持ち物は手続きをまたいでまとめられ、何のために持つかが残る", () => {
  const route = buildRoute(questsFor(), student);
  const cityHall = route.stops.find((s) => s.placeKey === "city-hall")!;
  const pin = cityHall.bring.filter((b) => b.id === "juki-pin");
  assert.equal(pin.length, 1, "暗証番号が2行に分かれてはいけない");
  assert.deepEqual(pin[0].neededFor.sort(), ["mynumber-address", "tennyu-todoke"]);
});

test("持ち物は物が先、暗証番号のような物でないものが後ろ", () => {
  const route = buildRoute(questsFor(), student);
  const cityHall = route.stops.find((s) => s.placeKey === "city-hall")!;
  const lastItem = cityHall.bring[cityHall.bring.length - 1];
  assert.equal(lastItem.physical, false);
});

test("所要時間の合計が出る", () => {
  const route = buildRoute(questsFor(), student);
  const cityHall = route.stops.find((s) => s.placeKey === "city-hall")!;
  assert.equal(cityHall.minutes, 15 + 10 + 10);
  assert.equal(
    route.minutes,
    route.stops.reduce((sum, s) => sum + s.minutes, 0),
  );
});

test("終わったものは攻略シートから消える", () => {
  const progress = complete(emptyProgress(), "tennyu-todoke", TODAY);
  const route = buildRoute(questsFor(progress), student);
  const cityHall = route.stops.find((s) => s.placeKey === "city-hall")!;
  assert.ok(!cityHall.quests.some((q) => q.id === "tennyu-todoke"));
});

test("忘れやすいもの・順番・期限切れが注意として出る", () => {
  const route = buildRoute(questsFor(), student);
  const text = route.warnings.join("\n");
  assert.match(text, /暗証番号/);
  // 改行をまたいで探すので [\s\S] を使う（/s フラグは古い target だと型チェックで落ちる）
  assert.match(text, /転入届を出す[\s\S]*先に/);
  assert.match(text, /期限/);
});

test("家でできる手続きでも、他の前提になっていればその前に置く", () => {
  // ライフラインの停止（家）を、転出届（前の市の市役所）の前提にする
  const modified = structuredClone(data);
  modified.procedures.find((p) => p.id === "tenshutsu-todoke")!.requires = ["lifeline"];

  const route = buildRoute(buildQuests(modified, student, emptyProgress(), TODAY), student);
  const keys = route.stops.map((s) => s.placeKey);
  assert.ok(
    keys.indexOf("online") < keys.indexOf("prev-city-hall"),
    "「家は最後」を優先して前提を後ろに送ってはいけない",
  );
});

test("前提が無い家の用事は、これまでどおり最後に回る", () => {
  const route = buildRoute(questsFor(), student);
  assert.equal(route.stops[route.stops.length - 1].placeKey, "online");
});

test("同じものが別の id で入っていても、攻略シートでは1行にまとまる", () => {
  const route = buildRoute(questsFor(), student);
  const cityHall = route.stops.find((s) => s.placeKey === "city-hall")!;

  const cards = cityHall.bring.filter((b) => b.id === "mynumber-card");
  assert.equal(cards.length, 1, "マイナンバーカードが2行に見えてはいけない");
  assert.equal(cards[0].label, "マイナンバーカード", "まとめたときは本来の言い方を出す");
  assert.ok(cards[0].neededFor.includes("gakusei-nofu-tokurei"), "年金の分もこの1行が担う");
  assert.match(cards[0].note ?? "", /基礎年金番号通知書/, "代わりになるものの説明は消さない");
  assert.ok(!cityHall.bring.some((b) => b.id === "pension-number"));
});

test("1つの手続きだけを見るときは、その手続きの言い方のままにする", () => {
  const gakusei = questsFor().find((q) => q.id === "gakusei-nofu-tokurei")!;
  const card = gakusei.bring.find((b) => b.id === "mynumber-card")!;
  assert.equal(card.label, "マイナンバーカード（または基礎年金番号通知書）");
});

test("その人には要らない持ち物が、理由付きで取れる", () => {
  // 学生はカードを持っているので、転出証明書は交付されない＝持っていく必要がない
  const procedures = data.procedures;
  const skipped = notNeededBring(procedures, student);

  assert.deepEqual(skipped.map((b) => b.id), ["tenshutsu-shomeisho"]);
  assert.match(skipped[0].reason, /マイナンバーカードを持っていない人/);

  // 持っていく方の一覧には入っていない
  assert.ok(!mergeBring(procedures, student).some((b) => b.id === "tenshutsu-shomeisho"));
});

test("カードを持っていない人では、要る・要らないが逆になる", () => {
  // 画面は場所ごとに呼ぶので、市役所の分だけで見る
  const route = buildRoute(buildQuests(data, worker, emptyProgress(), TODAY), worker);
  const cityHall = route.stops.find((s) => s.placeKey === "city-hall")!;
  const procedures = cityHall.quests.map((q) => q.procedure);

  assert.ok(
    cityHall.bring.some((b) => b.id === "tenshutsu-shomeisho"),
    "カードが無い人は転出証明書が要る",
  );

  const skipped = notNeededBring(procedures, worker);
  assert.deepEqual(skipped.map((b) => b.id), ["mynumber-card", "juki-pin"]);
  assert.match(skipped[0].reason, /マイナンバーカードを持っている人/);
});

test("答えていない項目があるうちは、「要らない」に入れない（迷ったら出す）", () => {
  const skipped = notNeededBring(data.procedures, { occupation: "student" });
  assert.deepEqual(skipped, [], "判定できないものを勝手に外さない");
});

test("チェックしても行が消えない形にできる（includeDone）", () => {
  const progress = complete(emptyProgress(), "tennyu-todoke", TODAY);
  const quests = questsFor(progress);

  // 既定は「これから回る順番」なので、終わったものは消える
  const walking = buildRoute(quests, student);
  const walkingStop = walking.stops.find((s) => s.placeKey === "city-hall")!;
  assert.ok(!walkingStop.quests.some((q) => q.id === "tennyu-todoke"));

  // チェックリストとして見せるときは残す
  const checklist = buildRoute(quests, student, { includeDone: true });
  const stop = checklist.stops.find((s) => s.placeKey === "city-hall")!;
  assert.deepEqual(
    stop.quests.map((q) => q.id),
    ["tennyu-todoke", "mynumber-address", "gakusei-nofu-tokurei"],
    "チェックを付けても並びが変わらない",
  );
  assert.equal(stop.quests[0].done, true);
});

test("終わったものを残しても、回数と時間と注意は残りの分だけ", () => {
  const all = data.procedures.map((p) => p.id);
  let progress = emptyProgress();
  for (const id of all) progress = complete(progress, id, TODAY);

  const route = buildRoute(questsFor(progress), student, { includeDone: true });

  assert.ok(route.stops.length > 0, "行は残る");
  assert.equal(route.trips, 0, "全部終わっていれば、出かける回数は0");
  assert.equal(route.minutes, 0);
  assert.deepEqual(
    route.warnings.filter((w) => w.includes("期限")),
    [],
    "終わった手続きに期限切れの注意を出さない",
  );
});
