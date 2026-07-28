"use client"
import Image from "next/image";
import raw from "@/data/procedures.json";
import { loadProcedures, buildBoard, toggle, emptyProgress } from "@/lib/quest";
import { useLocalStorage } from "usehooks-ts";
import type { Board, ProcedureFile, Profile, Progress } from "@/lib/quest/types";

export default function Home() {

  const [progress, setProgress] = useLocalStorage<Progress>(
    "quest_progress", 
    {
      doneAt: {},
      dismissed: []
    }
  );

  const data = loadProcedures(raw);              // 1回だけでいい

  const board = buildBoard(data, {}, progress, "2026-07-28");
  console.log(board)

  return board.phases.map((group) => (
    <section key={group.phase}>
      <h2>{group.label}</h2>                     {/* 引越し前 / 14日以内 */}
      {group.quests.map((q) => (
        <label key={q.id}>
          <input
            type="checkbox"
            checked={q.done}
            disabled={false}
            onChange={() => setProgress(toggle(progress, q.id, "2026-07-28"))}
          />
          {q.name}
          {q.hidden && <span>隠しクエスト</span>}
          {q.lock.locked && <span>先に「{q.lock.blockedByNames[0]}」</span>}
          <small>{q.deadline.label}（{q.deadline.dueOn} / あと{q.deadline.daysLeft}日）</small>
        <br/>
        </label>
      ))}
    </section>
  ));
}
