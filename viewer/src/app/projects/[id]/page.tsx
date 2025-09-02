export const runtime = "nodejs";

import { notFound } from "next/navigation";
import Badge from "@/components/Badge";
import {
  readProjectsYaml,
  readProjectDetail,
  readCurrentSeason,
  findInitiativeForProject,
  readStatusMetaList,
  deriveCategories,
} from "@/lib/server/data";
import { summarizeJEVM } from "@/lib/jevm";
import Editor from "./Editor";

export async function generateStaticParams() {
  const all = await readProjectsYaml();
  return all.map((p) => ({ id: p.id }));
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const all = await readProjectsYaml();
  const p = all.find((x) => x.id === id);
  if (!p) return notFound();
  const statuses = await readStatusMetaList();
  const categories = await deriveCategories();

  const { detail, notes } = await readProjectDetail(p.id);
  const jevm = p.jevm ?? detail.jevm;
  const { sum } = summarizeJEVM(jevm);

  /* Prefer season outcomes if in current season */
  const season = await readCurrentSeason();
  const initiative = findInitiativeForProject(season, p.id);
  const seasonOutcomes = initiative?.outcomes ?? [];
  const fallbackOutcomes = detail.focus?.outcomes ?? [];
  const outcomes = seasonOutcomes.length ? seasonOutcomes : fallbackOutcomes;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <div className="flex flex-wrap gap-2">
          <Badge>{p.category}</Badge>
          <Badge
            color={
              (statuses.find((s) => s.key === p.status)?.color || "slate") as
                | "green"
                | "yellow"
                | "red"
                | "slate"
            }
          >
            {p.status}
          </Badge>
          {p.pivot_cost && <Badge>{`pivot: ${p.pivot_cost}`}</Badge>}
          {jevm ? (
            <Badge color="blue">{`JEVM ${sum}`}</Badge>
          ) : (
            <Badge color="slate">No JEVM</Badge>
          )}
        </div>
      </div>

      {outcomes.length > 0 && (
        <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
          <h2 className="font-semibold mb-2">
            Focus outcomes{seasonOutcomes.length ? " (this season)" : ""}
          </h2>
          <ul className="list-disc pl-5 space-y-1">
            {outcomes.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </section>
      )}

      <Editor
        id={p.id}
        initial={notes}
        project={p}
        statuses={statuses}
        categories={categories}
      />
    </div>
  );
}
