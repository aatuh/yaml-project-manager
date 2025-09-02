"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/Badge";
import type { StatusMeta } from "@/lib/schema";

export type FilterState = {
  q: string;
  status: string;
  category: string;
  minJEVM: number;
};

export default function Filters({
  onChange,
  statuses,
  categories,
}: {
  onChange: (f: FilterState) => void;
  statuses: StatusMeta[];
  categories: string[];
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [minJEVM, setMinJEVM] = useState(0);

  // ✅ Notify parent AFTER render commit
  useEffect(() => {
    onChange({ q, status, category, minJEVM });
  }, [q, status, category, minJEVM, onChange]);

  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-soft">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-neutral-500 mb-1">Search</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="id or title"
            className="w-full rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={["", ...statuses.map((s) => s.key)]}
        />
        <Select
          label="Category"
          value={category}
          onChange={setCategory}
          options={["", ...categories]}
        />

        <div>
          <label className="block text-xs text-neutral-500 mb-1">
            Min JEVM sum
          </label>
          <input
            type="number"
            min={0}
            max={16}
            value={minJEVM}
            onChange={(e) => setMinJEVM(Number(e.target.value) || 0)}
            className="w-24 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        <button
          onClick={() => {
            setQ("");
            setStatus("");
            setCategory("");
            setMinJEVM(0);
          }}
          className="ml-auto px-3 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          Reset
        </button>
      </div>

      <div className="mt-3 text-xs text-neutral-500 flex gap-2 items-center">
        {statuses.map((s) => (
          <Badge key={s.key} color={s.color}>
            {s.key}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <div>
      <label className="block text-xs text-neutral-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o || "any"}
          </option>
        ))}
      </select>
    </div>
  );
}
