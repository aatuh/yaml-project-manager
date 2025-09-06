export const runtime = "nodejs";

import Link from "next/link";
import {
  readSeason,
  readProjectsYaml,
  findInitiativeForProject,
} from "@/lib/server/data";
import {
  addSeasonInitiative,
  removeSeasonInitiativeAction,
  saveInitiativeOutcomes,
  setSeasonWeeklyPicks,
  deleteSeasonAction,
} from "@/app/actions";
import DeleteSeasonButton from "../DeleteSeasonButton";
import InitiativesPicker from "../InitiativesPicker";
import OutcomesAutoSave from "@/app/seasons/OutcomesAutoSave";
import SubmitButton from "../SubmitButton";
import { updateSeasonMeta } from "@/app/actions";

function isMonday(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.getUTCDay() === 1;
}

function mondayOf(dateIso: string) {
  const d = new Date(dateIso + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export default async function SeasonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const season = await readSeason(id);
  if (!season) {
    return (
      <div>
        <h1 className="text-2xl font-semibold mb-2">Season not found</h1>
        <Link href="/seasons" className="underline">
          Back to seasons
        </Link>
      </div>
    );
  }

  const projects = await readProjectsYaml();

  const STATUS_ORDER: Array<
    "active" | "incubate" | "archive" | "graveyard" | "hypo" | "done"
  > = ["active", "incubate", "archive", "graveyard", "hypo", "done"];
  const STATUS_LABEL: Record<string, string> = {
    active: "Active",
    incubate: "Incubate",
    archive: "Archive",
    graveyard: "Graveyard",
    hypo: "Hypothetical",
    done: "Done",
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">
            {id} — {season.theme || "Untitled"}
          </h1>
          <div className="text-sm text-neutral-500">
            {season.start} to {season.end}
          </div>
        </div>
        <Link
          href="/seasons"
          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm"
        >
          All seasons
        </Link>
      </div>

      {/* Season meta */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h2 className="font-semibold mb-3">Season details</h2>
        <form
          action={async (formData) => {
            "use server";
            const newId = (formData.get("id") as string).trim();
            const theme = (formData.get("theme") as string).trim();
            await updateSeasonMeta({ oldId: id, newId, theme });
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <div className="md:col-span-1">
            <label className="block text-xs text-neutral-500 mb-1">ID</label>
            <input
              name="id"
              defaultValue={id}
              className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs text-neutral-500 mb-1">Title</label>
            <input
              name="theme"
              defaultValue={season.theme || ""}
              placeholder="e.g. My new season"
              className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full"
            />
          </div>
          <div className="md:col-span-1 flex items-end">
            <button
              type="submit"
              className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 w-full"
            >
              Save
            </button>
          </div>
        </form>
      </div>

      {!season.initiatives.some((i) => i.role === "lead") && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-200 p-3 text-sm">
          No lead set for this season yet. Add a lead in the Initiatives section
          below.
        </div>
      )}

      {/* Initiatives */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h2 className="font-semibold mb-3">Initiatives</h2>

        <form
          action={async (formData) => {
            "use server";
            const ids = (formData.getAll("pids") as string[])
              .map((s) => s.trim())
              .filter(Boolean);
            const role =
              (formData.get("role") as "lead" | "supporting") || "supporting";
            for (const projectId of ids) {
              await addSeasonInitiative({ seasonId: id, projectId, role });
            }
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4"
        >
          <InitiativesPicker projects={projects} name="pids" />
          <select
            name="role"
            className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
          >
            <option value="supporting">supporting</option>
            <option value="lead">lead</option>
          </select>
          <button
            type="submit"
            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Add selected
          </button>
        </form>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...season.initiatives]
            .sort((a, b) => (a.role === "lead" ? -1 : 1))
            .map((i) => {
              const p = projects.find((x) => x.id === i.project_id);
              return (
                <div
                  key={i.project_id}
                  className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">
                      {p ? p.title : i.project_id}
                    </div>
                    <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
                      {i.role}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-neutral-500">
                    /{i.project_id}
                  </div>

                  <form
                    action={async (formData) => {
                      "use server";
                      const o1 = (formData.get("o1") as string).trim();
                      const o2 = (formData.get("o2") as string).trim();
                      const o3 = (formData.get("o3") as string).trim();
                      const outcomes = [o1, o2, o3].filter(Boolean);
                      await saveInitiativeOutcomes({
                        seasonId: id,
                        projectId: i.project_id,
                        outcomes,
                      });
                    }}
                    className="mt-3 space-y-2"
                  >
                    <label className="block text-xs text-neutral-500">
                      Outcomes (up to 3)
                    </label>
                    <OutcomesAutoSave
                      names={["o1", "o2", "o3"]}
                      defaults={[
                        i.outcomes[0] || "",
                        i.outcomes[1] || "",
                        i.outcomes[2] || "",
                      ]}
                    />
                    <div className="flex items-center gap-2">
                      <SubmitButton
                        className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                        pendingText="Saving…"
                      >
                        Save outcomes
                      </SubmitButton>
                      <button
                        type="submit"
                        formAction={async () => {
                          "use server";
                          await removeSeasonInitiativeAction(id, i.project_id);
                        }}
                        className="px-3 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                      >
                        Remove
                      </button>
                      {p && (
                        <Link
                          href={`/projects/${p.id}`}
                          className="ml-auto text-sm underline"
                        >
                          Open project
                        </Link>
                      )}
                    </div>
                  </form>
                </div>
              );
            })}
        </div>
      </div>

      {/* Weekly picks */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h2 className="font-semibold mb-3">Weekly picks</h2>
        <form
          action={async (formData) => {
            "use server";
            const iso = (formData.get("week") as string).trim();
            const weekStart = isMonday(iso) ? iso : mondayOf(iso);
            const picks = Array.from(
              { length: 6 },
              (_, i) => (formData.get(`p${i + 1}`) as string) || ""
            )
              .map((s) => s.trim())
              .filter(Boolean);
            await setSeasonWeeklyPicks({
              seasonId: id,
              weekStart,
              picks,
            });
          }}
          className="grid grid-cols-1 md:grid-cols-4 gap-3"
        >
          <div className="md:col-span-1">
            <label className="block text-xs text-neutral-500 mb-1">
              Week (Monday)
            </label>
            <input
              name="week"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full"
            />
          </div>
          <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <input
                key={i}
                name={`p${i + 1}`}
                placeholder={`Pick ${i + 1}`}
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

        {season.weekly.length > 0 && (
          <div className="mt-4 text-sm">
            <div className="font-medium mb-2">Saved weeks</div>
            <ul className="space-y-1">
              {season.weekly
                .slice()
                .sort((a, b) => b.week_start.localeCompare(a.week_start))
                .map((w) => (
                  <li key={w.week_start}>
                    <span className="font-mono">{w.week_start}</span>:{" "}
                    {w.picks.join(", ")}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {/* Danger zone */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Danger Zone</div>
            <div className="text-sm text-neutral-500">
              Delete this season and its folder.
            </div>
          </div>
          <form
            action={async () => {
              "use server";
              await deleteSeasonAction(id);
            }}
          >
            <DeleteSeasonButton />
          </form>
        </div>
      </div>
    </section>
  );
}
