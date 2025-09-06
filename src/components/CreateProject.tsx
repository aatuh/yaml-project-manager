"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/app/actions";
import type { Project, StatusMeta } from "@/lib/schema";

export default function CreateProject({
  statuses,
  categories,
}: {
  statuses: StatusMeta[];
  categories: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Project["category"]>(
    categories[0] || "exploration"
  );
  const initialStatus =
    statuses.find((s) => s.key === "incubate")?.key || statuses[0]?.key || "";
  const [status, setStatus] = useState<Project["status"]>(initialStatus);
  const [pivot, setPivot] = useState<Project["pivot_cost"]>(null);
  const [error, setError] = useState<string | null>(null);
  const [useCustomCategory, setUseCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState("");
  const customCatInputRef = useRef<HTMLInputElement | null>(null);

  const submit = async () => {
    setError(null);
    start(async () => {
      try {
        const res = await createProject({
          title,
          category,
          status,
          pivot_cost: pivot ?? undefined,
        });
        if (res?.id) router.push(`/projects/${res.id}`);
      } catch (e: any) {
        setError(e?.message || "Failed to create project");
      }
    });
  };

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
      <h2 className="font-semibold mb-3">New Project</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
        />
        <div className="space-y-2">
          <select
            value={useCustomCategory ? "__custom__" : category}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__custom__") {
                setUseCustomCategory(true);
                setTimeout(() => customCatInputRef.current?.focus(), 0);
                return;
              }
              setUseCustomCategory(false);
              setCategory(v as Project["category"]);
            }}
            className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full"
          >
            {!categories.includes(category) && category && (
              <option value={category}>{category} (current)</option>
            )}
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__custom__">Other…</option>
          </select>
          {useCustomCategory && (
            <input
              ref={customCatInputRef}
              placeholder="Type a custom category"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (!customCategory.trim()) return;
                  setCategory(customCategory as Project["category"]);
                  setUseCustomCategory(false);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setUseCustomCategory(false);
                  setCustomCategory("");
                }
              }}
              onBlur={() => {
                if (!customCategory.trim()) return;
                setCategory(customCategory as Project["category"]);
                setUseCustomCategory(false);
              }}
              className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full"
            />
          )}
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Project["status"])}
          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
        >
          {statuses.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={pivot ?? ""}
          onChange={(e) =>
            setPivot((e.target.value || null) as Project["pivot_cost"] | null)
          }
          className="px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800"
        >
          <option value="">pivot: none</option>
          <option value="low">pivot: low</option>
          <option value="medium">pivot: medium</option>
          <option value="high">pivot: high</option>
        </select>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={pending || !title.trim()}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? "Creating..." : "Create"}
        </button>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </div>
  );
}
