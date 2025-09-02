"use client";

import { useRef } from "react";

export default function CreateSeasonForm({
  defaultId,
  defaultStart,
  defaultEnd,
  action,
}: {
  defaultId: string;
  defaultStart: string;
  defaultEnd: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const idRef = useRef<HTMLInputElement | null>(null);
  const startRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLInputElement | null>(null);

  function parseYear(): number {
    const raw = idRef.current?.value || "";
    const m = raw.match(/^(\d{4})/);
    if (m) return parseInt(m[1], 10);
    return new Date().getUTCFullYear();
  }

  function setQuarter(q: 1 | 2 | 3 | 4) {
    const y = parseYear();
    const start =
      q === 1
        ? `${y}-01-01`
        : q === 2
        ? `${y}-04-01`
        : q === 3
        ? `${y}-07-01`
        : `${y}-10-01`;
    const end =
      q === 1
        ? `${y}-03-31`
        : q === 2
        ? `${y}-06-30`
        : q === 3
        ? `${y}-09-30`
        : `${y}-12-31`;
    if (startRef.current) startRef.current.value = start;
    if (endRef.current) endRef.current.value = end;
  }

  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-5 gap-3">
      <input
        name="id"
        ref={idRef}
        defaultValue={defaultId}
        placeholder="2025Q3"
        className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
      />
      <input
        name="theme"
        placeholder="Theme (e.g., SaaS / Study / Creative)"
        className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 md:col-span-2"
      />
      <input
        type="date"
        name="start"
        ref={startRef}
        defaultValue={defaultStart}
        className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
      />
      <input
        type="date"
        name="end"
        ref={endRef}
        defaultValue={defaultEnd}
        className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
      />
      <div className="md:col-span-5 flex items-center gap-2 flex-wrap">
        <div className="text-xs text-neutral-500">Quick set:</div>
        <button
          type="button"
          onClick={() => setQuarter(1)}
          className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs"
        >
          Q1
        </button>
        <button
          type="button"
          onClick={() => setQuarter(2)}
          className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs"
        >
          Q2
        </button>
        <button
          type="button"
          onClick={() => setQuarter(3)}
          className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs"
        >
          Q3
        </button>
        <button
          type="button"
          onClick={() => setQuarter(4)}
          className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-xs"
        >
          Q4
        </button>
        <div className="ml-auto">
          <button
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            type="submit"
          >
            Create season
          </button>
        </div>
      </div>
    </form>
  );
}
