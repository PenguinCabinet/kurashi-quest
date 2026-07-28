"use client";

import React, { useState } from "react";
import type { Board, Progress } from "@/lib/quest";
import { mergeBring } from "@/lib/quest";

interface QuestConquestSheetProps {
  board: Board;
  progress: Progress;
  onToggleQuest: (questId: string) => void;
}

export function QuestConquestSheet({
  board,
  onToggleQuest,
}: QuestConquestSheetProps) {
  // 市役所の手続き一覧（完了済みも含めて取得し、チェック後もシート項目が消えないように表示維持）
  const cityHallQuests = board.quests.filter(
    (q) => q.procedure.where.placeKey === "city-hall" || q.phase === "within14"
  );

  // 市役所の手続きに必要な持ち物を集計
  const bringItems = mergeBring(
    cityHallQuests.map((q) => q.procedure),
    board.profile
  );

  // 画像(quest-TODO.png)の初期状態に合わせて、本人確認書類とマイナンバーカードをチェック済み(✓)に設定
  const [checkedBringIds, setCheckedBringIds] = useState<Record<string, boolean>>({
    "id-doc": true,
    "honnin-kakunin": true,
    "mynumber-card": true,
  });

  const toggleBringItem = (id: string) => {
    setCheckedBringIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const readyCount = bringItems.filter((b) => checkedBringIds[b.id]).length;
  const totalCount = bringItems.length;

  return (
    <div className="w-full max-w-xl mx-auto bg-white border-2 border-[#5c738e] shadow-md font-sans text-slate-900 overflow-hidden my-6">
      {/* ヘッダー行 */}
      <div className="px-4 py-3 flex items-center justify-between border-b-2 border-[#5c738e] bg-white">
        <h1 className="text-xl font-bold tracking-tight text-slate-800">
          役所攻略シート
        </h1>
        <div className="text-base font-bold text-[#b32d2e] flex items-center gap-1.5">
          <span className="text-slate-900 font-bold mr-1">準備</span>
          <span className="text-lg font-bold">
            {readyCount} / {totalCount}
          </span>
          <span>そろった</span>
        </div>
      </div>

      {/* 【 持っていくもの 】 */}
      <div>
        <div className="px-4 py-2 bg-white text-base font-bold text-slate-900 border-b border-[#5c738e]">
          【 持っていくもの 】
        </div>
        <div className="divide-y divide-[#b8c9d9]">
          {bringItems.map((item) => {
            const isChecked = !!checkedBringIds[item.id];

            // quest-TODO.png の表示文言・装飾に合わせた注記の個別調整
            let customNote = item.note;
            if (item.id === "mynumber-card") {
              customNote = "← 転入届にも住所変更にも使う";
            } else if (item.id === "gakuseisho-copy") {
              customNote = "← これが無いと年金の窓口で止まる";
            } else if (item.id === "juki-pin") {
              customNote = "← 転入届にも要る。物ではないので忘れがち";
            }

            const isWarningNote =
              item.id === "gakuseisho-copy" || item.id === "juki-pin";

            return (
              <div
                key={item.id}
                onClick={() => toggleBringItem(item.id)}
                className="px-4 py-2.5 flex items-start gap-3 text-sm cursor-pointer hover:bg-slate-50 transition-colors select-none"
              >
                <span
                  className={`font-bold text-base leading-none pt-0.5 ${
                    isChecked ? "text-slate-800" : "text-[#b32d2e]"
                  }`}
                >
                  {isChecked ? "✓" : "✗"}
                </span>
                <div className="flex-1 flex flex-wrap items-baseline gap-x-2">
                  <span
                    className={`font-bold ${
                      isChecked ? "text-slate-800" : "text-slate-900"
                    }`}
                  >
                    {item.label}
                  </span>
                  {customNote && (
                    <span
                      className={`text-xs md:text-sm ${
                        isWarningNote
                          ? "text-[#b32d2e] font-medium"
                          : "text-[#486581]"
                      }`}
                    >
                      {customNote}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* 不要な持ち物・スキップ項目（転出証明書など） */}
          <div className="px-4 py-2.5 flex items-start gap-3 text-sm text-slate-400 bg-slate-50/50 select-none">
            <span className="font-bold text-base leading-none pt-0.5 text-slate-400">
              —
            </span>
            <div className="flex-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-slate-400">転出証明書</span>
              <span className="text-xs md:text-sm text-slate-400">
                ← カードがあるので、あなたは要りません
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 【 この順番で回る 】 */}
      <div className="border-t-2 border-[#5c738e]">
        <div className="px-4 py-2 bg-white text-base font-bold text-slate-900 border-b border-[#5c738e]">
          【 この順番で回る 】
        </div>
        <div className="divide-y divide-[#b8c9d9]">
          {cityHallQuests.map((quest, index) => {
            const stepNum = index + 1;

            let subNote = quest.what;
            let orderWarning: string | null = null;

            if (quest.id === "tennyu-todoke") {
              subNote = "住民票をこの市に移す";
              orderWarning = "↓ これを先にやらないと、下は受け付けてもらえない";
            } else if (quest.id === "mynumber-address") {
              subNote = "同じ日にできる。90日を過ぎると失効する";
            } else if (quest.id === "gakusei-nofu-tokurei") {
              subNote = "学生証が要る。出さないと未納になる";
            }

            return (
              <div key={quest.id} className="px-4 py-3 text-sm">
                <div
                  onClick={() => onToggleQuest(quest.id)}
                  className="font-bold text-base text-slate-900 flex items-center gap-3 cursor-pointer hover:text-blue-700 transition-colors select-none"
                >
                  <input
                    type="checkbox"
                    checked={quest.done}
                    onChange={() => onToggleQuest(quest.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer border-slate-400 mt-0.5"
                  />
                  <span className={quest.done ? "line-through text-slate-400" : ""}>
                    {stepNum}. {quest.name}
                  </span>
                  {quest.done && (
                    <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded ml-auto">
                      完了
                    </span>
                  )}
                </div>
                <div className="ml-7 mt-1 text-slate-600 text-xs md:text-sm">
                  {subNote}
                </div>
                {orderWarning && !quest.done && (
                  <div className="ml-7 mt-1 text-[#b32d2e] font-medium text-xs md:text-sm">
                    {orderWarning}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* フッター */}
      <div className="px-4 py-3 bg-[#edf3f8] border-t-2 border-[#5c738e] flex items-center justify-between">
        <span className="font-bold text-[#1c4a75] text-base md:text-lg">
          この{cityHallQuests.length}つが１回で終われば クリア
        </span>
      </div>
    </div>
  );
}
