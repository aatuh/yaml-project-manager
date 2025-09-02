import type { Project } from "@/lib/schema";

export default function Kpis({ projects }: { projects: Project[] }) {
  const total = projects.length;
  const active = projects.filter((p) => p.status === "active").length;
  const inc = projects.filter((p) => p.status === "incubate").length;
  const done = projects.filter((p) => p.status === "done").length;

  const Chip = ({
    label,
    value,
  }: {
    label: string;
    value: number | string;
  }) => (
    <div className="rounded-2xl px-4 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-soft">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Chip label="Total" value={total} />
      <Chip label="Active" value={active} />
      <Chip label="Incubate" value={inc} />
      <Chip label="Done" value={done} />
    </div>
  );
}
