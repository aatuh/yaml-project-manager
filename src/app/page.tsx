export const runtime = "nodejs";

import Kpis from "@/components/Kpis";
import CreateProject from "@/components/CreateProject";
import ClientFiltered from "@/components/ClientFiltered";
import {
  readProjectsYaml,
  readCurrentSeason,
  readStatusMetaList,
  deriveCategories,
} from "@/lib/server/data";
import Link from "next/link";

export default async function Page() {
  const projects = await readProjectsYaml();
  const season = await readCurrentSeason();
  const statuses = await readStatusMetaList();
  const categories = await deriveCategories();

  return (
    <section className="space-y-6">
      {season && (
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-gradient-to-br from-blue-50 to-white dark:from-blue-950/20 dark:to-neutral-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs text-neutral-500">Current season</div>
              <div className="text-lg font-semibold">
                {season.id} — {season.theme || "Untitled"}
              </div>
              <div className="text-xs text-neutral-500">
                {season.start} to {season.end}
              </div>
            </div>
            <Link
              href={`/seasons/${season.id}`}
              className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-sm"
            >
              Open
            </Link>
          </div>
        </div>
      )}

      <Kpis projects={projects} />
      <CreateProject statuses={statuses} categories={categories} />
      <ClientFiltered
        projects={projects}
        statuses={statuses}
        categories={categories}
      />
    </section>
  );
}
