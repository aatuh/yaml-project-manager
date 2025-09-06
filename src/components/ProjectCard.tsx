import Link from "next/link";
import { summarizeJEVM } from "@/lib/jevm";
import Badge from "@/components/Badge";

export default function ProjectCard({
  id,
  title,
  category,
  status,
  jevm,
  pivot_cost,
  statusColor,
}: {
  id: string;
  title: string;
  category: string;
  status: string;
  jevm?: { joy: number; energy: number; value: number; market: number };
  pivot_cost?: "low" | "medium" | "high" | null;
  statusColor: "green" | "yellow" | "blue" | "red" | "slate";
}) {
  const { sum } = summarizeJEVM(jevm);
  return (
    <Link href={`/projects/${id}`} className="block group">
      <div className="rounded-2xl shadow-soft border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900 transition hover:shadow-md">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Badge color={statusColor}>{status}</Badge>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-sm text-neutral-500">
          <Badge>{category}</Badge>
          {pivot_cost && <Badge color="slate">{`pivot: ${pivot_cost}`}</Badge>}
          {jevm ? (
            <Badge color="blue">{`JEVM ${sum}`}</Badge>
          ) : (
            <Badge color="slate">No JEVM</Badge>
          )}
        </div>
        {jevm ? (
          <div className="mt-3 grid grid-cols-4 gap-1 text-xs text-neutral-600 dark:text-neutral-300">
            <div>Joy: {jevm.joy}</div>
            <div>Energy: {jevm.energy}</div>
            <div>Value: {jevm.value}</div>
            <div>Market: {jevm.market}</div>
          </div>
        ) : (
          <div className="mt-3 text-xs text-neutral-400 italic">
            No JEVM assessment given
          </div>
        )}
        <div className="mt-3 text-neutral-400 text-xs">/{id}</div>
      </div>
    </Link>
  );
}
