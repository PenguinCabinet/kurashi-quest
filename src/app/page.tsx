"use client";

import React, { useEffect, useState } from "react";
import raw from "@/data/procedures.json";
import { loadProcedures, buildBoard, toggle,toggleBrought } from "@/lib/quest";
import { useLocalStorage } from "usehooks-ts";
import type { Progress, Profile } from "@/lib/quest/types";
import { QuestConquestSheet } from "@/components/QuestConquestSheet";

export default function Home() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [progress, setProgress] = useLocalStorage<Progress>(
    "quest_progress",
    {
      doneAt: {},
      dismissed: [],
      brought: [],
    }
  );

  const [profile] = useLocalStorage<Profile>(
    "quest_profile",
    {
      occupation: "student",
      hasMyNumberCard: true,
      livingAlone: true,
    }
  );

  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Tokyo",
  }).format(new Date());

  const data = loadProcedures(raw);
  const board = buildBoard(data, profile, progress, today);

  const handleToggleQuest = (questId: string) => {
    setProgress(toggle(progress, questId, today));
  };

  const handleToggleItem = (itemId: string) => {
    setProgress(toggleBrought(progress, itemId))
  };

  if (!isMounted) {
    return (
      <main className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl mx-auto bg-white border-2 border-[#5c738e] shadow-md p-8 text-center text-slate-500 font-sans">
          読み込み中...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 py-8 px-4 flex flex-col items-center justify-center">
      {/* 役所攻略シートを表示 */}
      <QuestConquestSheet
        board={board}
        progress={progress}
        notNeeded={raw.notNeeded}
        onToggleQuest={handleToggleQuest}
        onToggleItem={handleToggleItem}
      />
    </main>
  );
}
