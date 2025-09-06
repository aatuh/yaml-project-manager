export const runtime = "nodejs";

import Link from "next/link";
import {
  listSeasonIds,
  readSeason,
  readCurrentSeasonId,
  readProjectsYaml,
} from "@/lib/server/data";
import {
  createSeason,
  setCurrentSeason,
  addSeasonInitiative,
} from "@/app/actions";
import CreateSeasonForm from "./CreateSeasonForm";

function nextQuarterFromToday() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return { year: y, q };
}

function quarterDates(year: number, q: number) {
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0));
  const iso = (dt: Date) => dt.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}

export default async function SeasonsPage() {
  const ids = await listSeasonIds();
  const current = await readCurrentSeasonId();
  const projs = await readProjectsYaml();

  const { year, q } = nextQuarterFromToday();
  const { start: quarterStart, end } = quarterDates(year, q);
  const suggestId = `${year}Q${q}`;
  const todayIso = new Date().toISOString().slice(0, 10);
  const startDefault = todayIso;
  const endDefault = end;

  return (
    <section className="space-y-8">
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h2 className="font-semibold mb-3">Create a season</h2>
        <CreateSeasonForm
          defaultId={suggestId}
          defaultStart={startDefault}
          defaultEnd={endDefault}
          action={async (formData) => {
            "use server";
            const id = (formData.get("id") as string).trim();
            const theme = (formData.get("theme") as string).trim();
            const start = (formData.get("start") as string).trim();
            const end = (formData.get("end") as string).trim();
            await createSeason({ id, theme, start, end });
          }}
        />
      </div>

      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h2 className="font-semibold mb-3">Seasons</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {await Promise.all(
            ids.map(async (id) => {
              const s = await readSeason(id);
              if (!s) return null;
              const lead = s.initiatives.find((i) => i.role === "lead");
              return (
                <div
                  key={id}
                  className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <Link
                    href={`/seasons/${id}`}
                    aria-label={`Open season ${id}`}
                    className="absolute inset-0 z-0"
                  />
                  <div className="relative z-10 flex items-center justify-between pointer-events-none">
                    <div className="text-lg font-semibold">{id}</div>
                    {current === id ? (
                      <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
                        current
                      </span>
                    ) : (
                      <form
                        action={async () => {
                          "use server";
                          await setCurrentSeason(id);
                        }}
                        className="relative z-10 pointer-events-auto"
                      >
                        <button
                          className="text-xs px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          type="submit"
                        >
                          Set current
                        </button>
                      </form>
                    )}
                  </div>
                  <div className="relative z-10 text-sm text-neutral-500 pointer-events-none">
                    {s.theme || "Untitled"} — {s.start} to {s.end}
                  </div>
                  <div className="relative z-10 mt-2 text-sm pointer-events-none">
                    Lead: <strong>{lead ? lead.project_id : "not set"}</strong>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
