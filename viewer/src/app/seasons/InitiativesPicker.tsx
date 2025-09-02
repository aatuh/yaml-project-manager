"use client";

import { useEffect, useRef, useState } from "react";

type Project = {
  id: string;
  title: string;
  status: "active" | "incubate" | "archive" | "graveyard" | "hypo" | "done";
};

const STATUS_ORDER: Project["status"][] = [
  "active",
  "incubate",
  "archive",
  "graveyard",
  "hypo",
  "done",
];
const STATUS_LABEL: Record<Project["status"], string> = {
  active: "Active",
  incubate: "Incubate",
  archive: "Archive",
  graveyard: "Graveyard",
  hypo: "Hypothetical",
  done: "Done",
};

export default function InitiativesPicker({
  projects,
  name = "pids",
  defaultSelected = [],
}: {
  projects: Project[];
  name?: string;
  defaultSelected?: string[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(defaultSelected);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const label =
    selected.length === 0
      ? "Attach project…"
      : selected.length === 1
      ? projects.find((p) => p.id === selected[0])?.title || "1 selected"
      : `${selected.length} selected`;

  return (
    <div className="relative md:col-span-2" ref={ref}>
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-left"
      >
        {label}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 max-h-96 overflow-auto shadow-lg">
          <div className="p-1">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects…"
              className="w-full px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm"
            />
          </div>
          {STATUS_ORDER.map((status) => {
            const group = projects
              .filter((p) => p.status === status)
              .filter((p) =>
                query
                  ? p.title.toLowerCase().includes(query.toLowerCase())
                  : true
              )
              .sort((a, b) => a.title.localeCompare(b.title));
            if (!group.length) return null;
            return (
              <div key={status} className="mb-2 last:mb-0">
                <div className="px-2 py-1 text-xs font-semibold text-neutral-500">
                  {STATUS_LABEL[status]}
                </div>
                <ul>
                  {group.map((p) => (
                    <li key={p.id} className="px-2 py-1">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selected.includes(p.id)}
                          onChange={() => toggle(p.id)}
                          className="accent-blue-600"
                        />
                        <span>{p.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
