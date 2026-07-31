// トップは、ゲーム本体（public/game）へ送ります。
//
// 作品の入口を1つに決めるためです。
// もともとここにあった攻略シートの画面は、消さずに /sheet に残してあります。

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/game/index.html");
}
