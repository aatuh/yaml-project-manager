"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import type { Project, StatusMeta } from "@/lib/schema";
import Filters, { type FilterState } from "@/components/Filters";
import ProjectCard from "@/components/ProjectCard";
import { summarizeJEVM } from "@/lib/jevm";
import { reorderStatus, moveProjectToStatus } from "@/app/actions";
import { motion } from "framer-motion";

type Group = { key: Project["status"]; items: Project[] };

export default function ClientFiltered({
  projects,
  statuses,
  categories,
}: {
  projects: Project[];
  statuses: StatusMeta[];
  categories: string[];
}) {
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    status: "",
    category: "",
    minJEVM: 0,
  });

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchesQ = filters.q
        ? p.id.includes(filters.q) ||
          p.title.toLowerCase().includes(filters.q.toLowerCase())
        : true;
      const matchesStatus = filters.status ? p.status === filters.status : true;
      const matchesCat = filters.category
        ? p.category === filters.category
        : true;
      const j = summarizeJEVM(p.jevm).sum;
      const matchesJEVM = j >= filters.minJEVM;
      return matchesQ && matchesStatus && matchesCat && matchesJEVM;
    });
  }, [projects, filters]);

  const byStatus = useMemo<Group[]>(() => {
    const order = statuses.map((s) => s.key);
    const groups: Record<string, Project[]> = {};
    for (const p of filtered) (groups[p.status] ??= []).push(p);
    return order
      .map((key) => ({ key, items: groups[key] ?? [] }))
      .filter((g) => g.items.length);
  }, [filtered, statuses]);

  const statusColorMap = useMemo(
    () =>
      Object.fromEntries(
        statuses.map((s) => [
          s.key,
          s.color as "green" | "yellow" | "blue" | "red" | "slate",
        ])
      ) as Record<string, "green" | "yellow" | "blue" | "red" | "slate">,
    [statuses]
  );

  return (
    <>
      <Filters
        onChange={setFilters}
        statuses={statuses}
        categories={categories}
      />
      <div className="space-y-8">
        {byStatus.map((g) => (
          <StatusBoard key={g.key} group={g} statusColorMap={statusColorMap} />
        ))}
      </div>
    </>
  );
}

function StatusBoard({
  group,
  statusColorMap,
}: {
  group: Group;
  statusColorMap: Record<string, "green" | "yellow" | "blue" | "red" | "slate">;
}) {
  const [items, setItems] = useState(group.items);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const originalOrderRef = useRef<string[] | null>(null);
  const persistedOnceRef = useRef(false);
  const lastOverIdRef = useRef<string | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Keep local list in sync if filters/props change
  useEffect(() => {
    setItems(group.items);
  }, [group.items]);

  // Accept drops only from the same status list
  const onDragStart = (e: unknown, id: string) => {
    const evt = e as React.DragEvent;
    evt.dataTransfer.setData(
      "text/plain",
      JSON.stringify({ id, status: group.key })
    );
    evt.dataTransfer.effectAllowed = "move";
    setDraggingId(id);
    originalOrderRef.current = items.map((p) => p.id);
    persistedOnceRef.current = false;
  };

  const onGridDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const moveAndPersist = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;

    // Compute the "next" array synchronously
    const next = (() => {
      const n = items.slice();
      const [moved] = n.splice(fromIdx, 1);
      n.splice(toIdx, 0, moved);
      return n;
    })();

    // Optimistic UI
    setItems(next);

    // Persist exactly the "next" order (no racing setState)
    const ids = next.map((p) => p.id);
    try {
      await reorderStatus(group.key, ids);
    } catch (err) {
      console.error("Persist reorder failed", err);
    }
  };

  const onDropCard = async (e: unknown, overId: string) => {
    const evt = e as React.DragEvent;
    evt.preventDefault();
    evt.stopPropagation();
    const data = safeParseDnD(evt.dataTransfer.getData("text/plain"));
    if (!data) return;

    if (data.status === group.key) {
      // Persist the current visual order (already updated during hover)
      const ids = itemsRef.current.map((p) => p.id);
      try {
        await reorderStatus(group.key, ids);
      } catch (err) {
        console.error("Persist reorder failed", err);
      }
      persistedOnceRef.current = true;
    } else {
      // Cross-column drop onto specific card: insert at that index
      const toIdx = items.findIndex((p) => p.id === overId);
      const insertAt = toIdx < 0 ? items.length : toIdx;
      try {
        await moveProjectToStatus(data.id, data.status, group.key, insertAt);
      } catch (err) {
        console.error("Cross-move failed", err);
      }
      persistedOnceRef.current = true;
    }
  };

  const onDropListEnd = async (e: unknown) => {
    if (persistedOnceRef.current) return;
    const evt = e as React.DragEvent;
    evt.preventDefault();
    const data = safeParseDnD(evt.dataTransfer.getData("text/plain"));
    if (!data) return;

    // If from same column, move to end; else move to this column end
    if (data.status === group.key) {
      const fromIdx = items.findIndex((p) => p.id === data.id);
      if (fromIdx < 0) return;
      await moveAndPersist(fromIdx, items.length - 1);
    } else {
      // Cross-column: move to this column (append to end)
      setItems((prev) => [...prev, { ...prev[0], id: data.id } as any]);
      try {
        await moveProjectToStatus(data.id, data.status, group.key);
      } catch (err) {
        console.error("Cross-move failed", err);
      }
    }
    persistedOnceRef.current = true;
  };

  // Live reordering while dragging over cards
  const onHoverReorder = (overId: string) => {
    if (!draggingId) return;

    if (lastOverIdRef.current === overId) return;
    lastOverIdRef.current = overId;

    if (draggingId === overId) return;

    const fromIdx = items.findIndex((p) => p.id === draggingId);
    const toIdx = items.findIndex((p) => p.id === overId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    setItems((prev) => {
      const next = prev.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const onDragEnd = async () => {
    const start = originalOrderRef.current;
    const current = itemsRef.current.map((p) => p.id);
    setDraggingId(null);
    lastOverIdRef.current = null;

    if (!start) return;
    const changed =
      start.length !== current.length ||
      start.some((id: string, i: number) => id !== current[i]);

    if (changed && !persistedOnceRef.current) {
      try {
        await reorderStatus(group.key, current);
      } catch (err) {
        console.error("Persist reorder on dragend failed", err);
      }
    }
    originalOrderRef.current = null;
    persistedOnceRef.current = false;
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3 capitalize">{group.key}</h2>
      <motion.div
        layout
        className="grid md:grid-cols-2 lg:grid-cols-3 gap-4"
        onDragOver={onGridDragOver}
        onDrop={onDropListEnd}
      >
        {items.map((p) => (
          <motion.div
            key={p.id}
            layout
            transition={{
              type: "spring",
              stiffness: 500,
              damping: 40,
              mass: 0.5,
            }}
            draggable
            onDragStart={(e) => onDragStart(e, p.id)}
            onDragOver={(e) => {
              e.preventDefault();
              const anyEvt = e as unknown as { dataTransfer?: DataTransfer };
              if (anyEvt.dataTransfer) anyEvt.dataTransfer.dropEffect = "move";
              onHoverReorder(p.id);
            }}
            onDrop={(e) => onDropCard(e, p.id)}
            onDragEnd={onDragEnd}
            className={
              "cursor-grab active:cursor-grabbing " +
              (draggingId === p.id ? "opacity-70" : "")
            }
            aria-grabbed={draggingId === p.id ? "true" : "false"}
            data-id={p.id}
          >
            <ProjectCard
              {...p}
              statusColor={statusColorMap[p.status] || "slate"}
            />
          </motion.div>
        ))}
      </motion.div>
      <div className="mt-2 text-xs text-neutral-400">
        Tip: drag cards to reorder; drop outside a card to send to end.
      </div>
    </div>
  );
}

function safeParseDnD(
  s: string
): { id: string; status: Project["status"] } | null {
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj.id === "string" && typeof obj.status === "string") {
      return obj;
    }
  } catch {
    /* noop */
  }
  return null;
}
