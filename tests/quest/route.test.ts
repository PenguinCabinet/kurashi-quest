import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRoute } from "../../src/lib/quest/route";
import { buildQuests } from "../../src/lib/quest/quests";
import { complete, emptyProgress } from "../../src/lib/quest/progress";
import { TODAY, realData, student } from "./fixture";

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
  assert.match(text, /転入届を出す.*先に/s);
  assert.match(text, /期限/);
});
