"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { DEFAULT_LIST_FORM } from "@/lib/constants";
import { createList, getCurrentUser } from "@/lib/local-store";
import { useSpeechInput } from "@/lib/use-speech-input";
import type { CreateListPayload, UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

export function ListCreator() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<CreateListPayload>(DEFAULT_LIST_FORM);
  const [isPending, startTransition] = useTransition();
  const speech = useSpeechInput((transcript) => {
    setForm((current) => ({
      ...current,
      name: current.name ? `${current.name} ${transcript}`.trim() : transcript,
    }));
    setMessage(null);
  });

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  if (!user) {
    return (
      <section className="panel">
        <p className="eyebrow">Login Required</p>
        <h2>リスト作成にはログインが必要です</h2>
      </section>
    );
  }

  return (
    <form
      className="panel form-panel"
      action={() => {
        startTransition(async () => {
          try {
            const list = await createList(user, form);
            router.push(`/lists/${list.id}`);
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "リスト作成に失敗しました。");
          }
        });
      }}
    >
      <div className="compact-heading">
        <p className="eyebrow">Create List</p>
        <h2>新しい共有リスト</h2>
      </div>
      <label>
        リスト名
        <div className="input-with-action">
          <input value={form.name} maxLength={50} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          {speech.isSupported ? (
            <button
              type="button"
              className={cn("voice-button", speech.isListening && "voice-button-live")}
              onClick={() => {
                if (speech.isListening) {
                  speech.stopListening();
                  return;
                }
                speech.startListening();
              }}
              aria-label={speech.isListening ? "音声入力を停止" : "音声入力を開始"}
            >
              {speech.isListening ? "録音中" : "音声"}
            </button>
          ) : null}
        </div>
      </label>
      {speech.isSupported ? <p className="field-hint">リスト名も音声で入力できます。</p> : null}
      <label>
        説明
        <textarea value={form.description} maxLength={140} onChange={(event) => setForm({ ...form, description: event.target.value })} />
      </label>
      <label>
        買い物予定日
        <input
          type="date"
          value={form.plannedDate ?? ""}
          onChange={(event) => setForm({ ...form, plannedDate: event.target.value || null })}
        />
      </label>
      <label>
        公開範囲
        <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as CreateListPayload["visibility"] })}>
          <option value="private">自分のみ</option>
          <option value="shared">共有メンバーと使う</option>
          <option value="public_link">公開リンクを使う</option>
        </select>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={form.dailyReminderEnabled}
          onChange={(event) => setForm({ ...form, dailyReminderEnabled: event.target.checked })}
        />
        毎日のまとめリマインドを使う
      </label>
      <label>
        毎日通知する時刻
        <input value={form.dailyReminderHour} type="time" onChange={(event) => setForm({ ...form, dailyReminderHour: event.target.value })} />
      </label>
      {speech.error ? <p className="notice-inline">{speech.error}</p> : null}
      {message ? <p className="notice-inline">{message}</p> : null}
      <button type="submit" className="primary-button" disabled={isPending}>
        {isPending ? "作成中..." : "リストを作る"}
      </button>
    </form>
  );
}
