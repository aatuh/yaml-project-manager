"use client";

import { useEffect, useMemo, useState } from "react";

type Weekly = { week_start: string; picks: string[] };

function mondayOf(dateIso: string) {
  const d = new Date(dateIso + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export default function WeeklyPicksForm(props: {
  saved: Weekly[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const { saved, action } = props;
  const today = new Date().toISOString().slice(0, 10);
  const [week, setWeek] = useState<string>(today);
  const [picks, setPicks] = useState<string[]>(["", "", "", "", "", ""]);

  const map = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const w of saved) m.set(w.week_start, w.picks || []);
    return m;
  }, [saved]);

  useEffect(() => {
    const mon = mondayOf(week);
    const existing = map.get(mon) || [];
    setPicks([
      existing[0] || "",
      existing[1] || "",
      existing[2] || "",
      existing[3] || "",
      existing[4] || "",
      existing[5] || "",
    ]);
  }, [week, map]);

  return (
    <form action={action} className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div className="md:col-span-1">
        <label className="block text-xs text-neutral-500 mb-1">
          Week (Monday)
        </label>
        <input type="hidden" name="week" value={week} />
        <input
          type="date"
          value={week}
          onChange={(e) => setWeek(e.target.value)}
          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full"
        />
        {saved.length > 0 && (
          <div className="mt-2">
            <label className="block text-xs text-neutral-500 mb-1">
              Load existing week
            </label>
            <select
              value={mondayOf(week)}
              onChange={(e) => setWeek(e.target.value)}
              className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full"
            >
              <option value={today}>Current week ({mondayOf(today)})</option>
              {saved
                .slice()
                .sort((a, b) => b.week_start.localeCompare(a.week_start))
                .map((w) => (
                  <option key={w.week_start} value={w.week_start}>
                    {w.week_start}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
      <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-2">
        {picks.map((val, i) => (
          <input
            key={i}
            name={`p${i + 1}`}
            value={val}
            placeholder={`Pick ${i + 1}`}
            onChange={(e) => {
              const next = picks.slice();
              next[i] = e.target.value;
              setPicks(next);
            }}
            className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
          />
        ))}
      </div>
      <div className="md:col-span-4">
        <button
          type="submit"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        >
          Save week picks
        </button>
      </div>
    </form>
  );
}
