import { clsx } from "clsx";

export default function Badge({
  children,
  color = "slate",
}: {
  children: React.ReactNode;
  color?: "green" | "yellow" | "red" | "slate" | "blue";
}) {
  const map: Record<string, string> = {
    green:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    yellow:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
    slate:
      "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
  };
  return (
    <span
      className={clsx("px-2 py-1 rounded-lg text-xs font-medium", map[color])}
    >
      {children}
    </span>
  );
}
