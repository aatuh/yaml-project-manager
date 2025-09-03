"use client";
import { useState, useTransition, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  updateNotes,
  updateProjectStatus,
  updateJEVM,
  removeJEVM,
  updateProjectProperties,
  renameProject,
  deleteProject,
  addTask,
  updateTask,
  removeTask,
  reorderTasks,
  addLink,
  removeLink,
  promoteTaskToProject,
  demoteProjectToTask,
  createProject,
  addTasks,
} from "@/app/actions";
import type { Project, StatusMeta, ProjectDetail } from "@/lib/schema";
import { z } from "zod";
import { motion, Reorder } from "framer-motion";
import { JEVM } from "@/lib/schema";
import Link from "next/link";

// Dynamically import MDEditor to avoid SSR hydration issues
const MDEditor = dynamic(() => import("@uiw/react-md-editor"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[300px] border border-neutral-200 dark:border-neutral-800 rounded-lg p-4 bg-white dark:bg-neutral-900">
      <div className="animate-pulse">
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2"></div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded mb-2 w-3/4"></div>
        <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-1/2"></div>
      </div>
    </div>
  ),
});

// Status options now dynamic and provided by parent via props

const PIVOT_COST_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
] as const;

export default function Editor({
  id,
  initial,
  project,
  statuses,
  categories,
  detail,
  allProjects,
  backlinks,
}: {
  id: string;
  initial: string;
  project: Project;
  statuses: StatusMeta[];
  categories: string[];
  detail: ProjectDetail;
  allProjects: Project[];
  backlinks: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [pending, start] = useTransition();
  const [lastSaved, setLastSaved] = useState<string>(initial);
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    "saved" | "saving" | "error"
  >("saved");
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Project editing state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemovingJevm, setIsRemovingJevm] = useState(false);
  const [isSavingJevm, setIsSavingJevm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [projectData, setProjectData] = useState({
    title: project.title,
    category: project.category,
    pivot_cost: project.pivot_cost,
  });
  const [showCat, setShowCat] = useState(false);
  const [useCustomCategory, setUseCustomCategory] = useState(
    !categories.includes(project.category)
  );
  const [customCategory, setCustomCategory] = useState(
    !categories.includes(project.category) ? project.category : ""
  );
  const customCatInputRef = useRef<HTMLInputElement | null>(null);

  // Function to generate ID from title
  const generateIdFromTitle = (title: string) => {
    return title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  };

  // Function to save title field
  const saveTitleField = async () => {
    setEditingField(null);
    try {
      // Only rename if the generated ID is different from current ID
      const generatedId = generateIdFromTitle(projectData.title);
      if (generatedId !== project.id) {
        setIsRenaming(true);
        await renameProject(project.id, generatedId, projectData.title);
        // Use router.push for smoother navigation without 404 flash
        router.push(`/projects/${generatedId}`);
      } else {
        await updateProjectProperties(project.id, {
          title: projectData.title,
        });
        window.location.reload();
      }
    } catch (error) {
      console.error("Project update failed:", error);
      setIsRenaming(false);
    }
  };

  // Helper functions to save different fields
  const saveCategoryField = async (nextCategory?: string) => {
    setEditingField(null);
    setIsSaving(true);
    try {
      await updateProjectProperties(project.id, {
        category: (nextCategory ?? projectData.category) as Project["category"],
      });
      window.location.reload();
    } catch (error) {
      console.error("Project update failed:", error);
      setIsSaving(false);
    }
  };

  const savePivotCostField = async () => {
    setEditingField(null);
    setIsSaving(true);
    try {
      console.log("Saving pivot_cost:", projectData.pivot_cost);

      // Handle the "None" case explicitly
      if (projectData.pivot_cost === null) {
        // Send a special update to remove the field
        await updateProjectProperties(project.id, {
          pivot_cost: null,
        });
      } else {
        await updateProjectProperties(project.id, {
          pivot_cost: projectData.pivot_cost,
        });
      }

      window.location.reload();
    } catch (error) {
      console.error("Project update failed:", error);
      setIsSaving(false);
    }
  };

  const saveJevmField = async () => {
    setEditingJevmField(null);
    setIsSavingJevm(true);
    try {
      await updateJEVM(project.id, jevmData);
      window.location.reload();
    } catch (error) {
      console.error("JEVM update failed:", error);
      setIsSavingJevm(false);
    }
  };

  // JEVM editing state
  const [editingJevmField, setEditingJevmField] = useState<string | null>(null);
  const [jevmData, setJevmData] = useState<z.infer<typeof JEVM>>({
    joy: project.jevm?.joy ?? 0,
    energy: project.jevm?.energy ?? 0,
    value: project.jevm?.value ?? 0,
    market: project.jevm?.market ?? 0,
  });

  // Auto-save with debouncing
  useEffect(() => {
    if (text === lastSaved) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        setAutoSaveStatus("saving");
        await updateNotes(id, text);
        setLastSaved(text);
        setAutoSaveStatus("saved");
      } catch (error) {
        console.error("Auto-save failed:", error);
        setAutoSaveStatus("error");
      }
    }, 1000); // 1 second delay

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [text, id, lastSaved]);

  // Cleanup renaming state on unmount
  useEffect(() => {
    return () => {
      setIsRenaming(false);
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const handleManualSave = async () => {
    start(async () => {
      try {
        await updateNotes(id, text);
        setLastSaved(text);
        setAutoSaveStatus("saved");
      } catch (error) {
        console.error("Manual save failed:", error);
        setAutoSaveStatus("error");
      }
    });
  };

  const handleStatusChange = async (newStatus: Project["status"]) => {
    start(async () => {
      try {
        await updateProjectStatus(id, newStatus);
        // Refresh the page to show updated status
        window.location.reload();
      } catch (error) {
        console.error("Status update failed:", error);
      }
    });
  };

  // Tasks state (client-side view based on server-provided detail)
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const tasks = detail.tasks ?? [];
  const tasksSorted = tasks
    .slice()
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  const sortedIds = tasksSorted.map((t: any) => t.id);
  const [localOrder, setLocalOrder] = useState<string[]>(() => sortedIds);
  const [serverOrder, setServerOrder] = useState<string[]>(() => sortedIds);
  useEffect(() => {
    const ids = tasks
      .slice()
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .map((t: any) => t.id);
    setLocalOrder(ids);
    setServerOrder(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(tasks.map((t: any) => [t.id, t.order]))]);
  const tasksById = new Map((tasks || []).map((t: any) => [t.id, t]));
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);

  const handleAddTask = async () => {
    const title = newTaskTitle.trim();
    if (!title) return;
    // If user typed multiple lines (rare for input) handle as bulk
    if (/[\r\n]/.test(newTaskTitle)) {
      const titles = newTaskTitle
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (titles.length) await addTasks({ projectId: id, titles });
    } else {
      await addTask({ projectId: id, title });
    }
    setNewTaskTitle("");
    window.location.reload();
  };

  const toggleTaskState = async (
    taskId: string,
    current: "todo" | "doing" | "blocked" | "done"
  ) => {
    const nextState =
      current === "todo"
        ? "doing"
        : current === "doing"
        ? "done"
        : current === "done"
        ? "todo"
        : "todo";
    await updateTask({ projectId: id, taskId, state: nextState });
    window.location.reload();
  };

  const handleRemoveTask = async (taskId: string) => {
    if (!confirm("Remove this task?")) return;
    await removeTask({ projectId: id, taskId });
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* JEVM Assessment Section */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">JEVM Assessment</h3>
          {project.jevm && (
            <button
              onClick={async () => {
                console.log("Remove button clicked");
                if (confirm("Remove JEVM assessment?")) {
                  console.log("Confirmation accepted, calling removeJEVM");
                  setIsRemovingJevm(true);
                  try {
                    await removeJEVM(project.id);
                    console.log("removeJEVM completed successfully");
                    window.location.reload();
                  } catch (error) {
                    console.error("Failed to remove JEVM:", error);
                    setIsRemovingJevm(false);
                  }
                }
              }}
              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
            >
              {isRemovingJevm ? "Removing..." : "Remove"}
            </button>
          )}
        </div>

        {!project.jevm ? (
          <div className="text-center py-8">
            <div className="text-neutral-500 mb-4">
              No JEVM assessment has been given yet.
            </div>
            <button
              onClick={async () => {
                setIsSavingJevm(true);
                try {
                  await updateJEVM(project.id, {
                    joy: 0,
                    energy: 0,
                    value: 0,
                    market: 0,
                  });
                  window.location.reload();
                } catch (error) {
                  console.error("Failed to create JEVM assessment:", error);
                  setIsSavingJevm(false);
                }
              }}
              disabled={isSavingJevm}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSavingJevm ? "Creating..." : "Give First Assessment"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["joy", "energy", "value", "market"] as const).map((metric) => (
              <div key={metric}>
                {editingJevmField === metric ? (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium capitalize">
                      {metric}
                    </label>
                    <select
                      value={jevmData[metric]}
                      disabled={isSavingJevm}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value);
                        setJevmData({
                          ...jevmData,
                          [metric]: newValue,
                        });
                      }}
                      onBlur={saveJevmField}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveJevmField();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingJevmField(null);
                          setJevmData({
                            joy: project.jevm?.joy ?? 0,
                            energy: project.jevm?.energy ?? 0,
                            value: project.jevm?.value ?? 0,
                            market: project.jevm?.market ?? 0,
                          });
                        }
                      }}
                      autoFocus
                      className="w-full px-3 py-2 border border-blue-500 rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {[0, 1, 2, 3, 4].map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingJevmField(metric)}
                    disabled={isSavingJevm}
                    className="w-full rounded-2xl px-4 py-3 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="text-xs text-neutral-500 capitalize">
                      {metric}
                    </div>
                    <div className="text-xl font-semibold">
                      {project.jevm?.[metric] ?? 0}
                    </div>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Management Section */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h3 className="font-semibold mb-4">Project Settings</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Project ID - Read Only */}
          <div>
            <div className="text-neutral-500 text-sm mb-1">
              Project ID (auto-generated)
            </div>
            <div className="font-medium font-mono text-sm px-3 py-2 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
              {project.id}
            </div>
          </div>

          {/* Title - Click to Edit */}
          <div>
            {editingField === "title" ? (
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <div className="relative">
                  <input
                    type="text"
                    value={projectData.title}
                    onChange={(e) => {
                      const newTitle = e.target.value;
                      setProjectData({
                        ...projectData,
                        title: newTitle,
                      });
                    }}
                    disabled={isRenaming || isSaving}
                    onBlur={saveTitleField}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        saveTitleField();
                      } else if (e.key === "Escape") {
                        e.preventDefault();
                        setEditingField(null);
                        setProjectData({
                          ...projectData,
                          title: project.title,
                        });
                      }
                    }}
                    autoFocus
                    className="w-full px-3 py-2 border border-blue-500 rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  {(isRenaming || isSaving) && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingField("title")}
                className="w-full text-left"
              >
                <div className="text-neutral-500 text-sm mb-1">Title</div>
                <div className="font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors">
                  {project.title}
                </div>
              </button>
            )}
          </div>

          {/* Category - Click to Edit */}
          <div>
            {editingField === "category" ? (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <div className="space-y-2">
                  <select
                    value={
                      useCustomCategory ? "__custom__" : projectData.category
                    }
                    onChange={async (e) => {
                      const v = e.target.value;
                      if (v === "__custom__") {
                        setUseCustomCategory(true);
                        setTimeout(() => {
                          customCatInputRef.current?.focus();
                        }, 0);
                        return;
                      }
                      setUseCustomCategory(false);
                      setProjectData({
                        ...projectData,
                        category: v as Project["category"],
                      });
                      // Persist immediately on concrete selection
                      await saveCategoryField(v);
                    }}
                    className="w-full px-3 py-2 border border-blue-500 rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  >
                    {!categories.includes(projectData.category) &&
                      projectData.category && (
                        <option value={projectData.category}>
                          {projectData.category} (current)
                        </option>
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
                      onKeyDown={async (e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          setProjectData({
                            ...projectData,
                            category: customCategory as Project["category"],
                          });
                          await saveCategoryField(customCategory);
                          setUseCustomCategory(false);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setEditingField(null);
                          setUseCustomCategory(
                            !categories.includes(project.category)
                          );
                          setCustomCategory(
                            !categories.includes(project.category)
                              ? project.category
                              : ""
                          );
                        }
                      }}
                      onBlur={async () => {
                        // Don't auto-save on blur to avoid bounce on menu closing
                        if (!customCategory.trim()) return;
                        setProjectData({
                          ...projectData,
                          category: customCategory as Project["category"],
                        });
                        await saveCategoryField(customCategory);
                        setUseCustomCategory(false);
                      }}
                      className="w-full px-3 py-2 border border-blue-500 rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setEditingField("category")}
                className="w-full text-left"
              >
                <div className="text-neutral-500 text-sm mb-1">Category</div>
                <div className="font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors">
                  {project.category}
                </div>
              </button>
            )}
          </div>

          {/* Pivot Cost - Click to Edit */}
          <div>
            {editingField === "pivot_cost" ? (
              <div>
                <label className="block text-sm font-medium mb-1">
                  Pivot Cost
                </label>
                <select
                  value={projectData.pivot_cost ?? ""}
                  onChange={(e) =>
                    setProjectData({
                      ...projectData,
                      pivot_cost:
                        e.target.value === ""
                          ? null
                          : (e.target.value as Project["pivot_cost"]),
                    })
                  }
                  onBlur={savePivotCostField}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      savePivotCostField();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingField(null);
                      setProjectData({
                        ...projectData,
                        pivot_cost: project.pivot_cost ?? null,
                      });
                    }
                  }}
                  autoFocus
                  className="w-full px-3 py-2 border border-blue-500 rounded-lg bg-white dark:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">None</option>
                  {PIVOT_COST_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <button
                onClick={() => setEditingField("pivot_cost")}
                className="w-full text-left"
              >
                <div className="text-neutral-500 text-sm mb-1">Pivot Cost</div>
                <div className="font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 px-3 py-2 rounded-lg transition-colors">
                  {project.pivot_cost
                    ? PIVOT_COST_OPTIONS.find(
                        (p) => p.value === project.pivot_cost
                      )?.label
                    : "None"}
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Danger zone */}
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <div className="font-medium">Danger Zone</div>
            <div className="text-sm text-neutral-500">
              Delete this project and its folder.
            </div>
          </div>
          <button
            onClick={async () => {
              if (!confirm("Delete this project permanently?")) return;
              setIsDeleting(true);
              try {
                await deleteProject(project.id);
                router.push("/");
              } catch (error) {
                console.error("Delete failed:", error);
                setIsDeleting(false);
              }
            }}
            disabled={isDeleting}
            className="px-3 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete Project"}
          </button>
        </div>
      </div>

      {/* Status Management Section */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h3 className="font-semibold mb-4">Status Management</h3>
        <div className="flex flex-wrap gap-2">
          {statuses.map((status) => (
            <button
              key={status.key}
              onClick={() =>
                handleStatusChange(status.key as Project["status"])
              }
              disabled={pending || project.status === status.key}
              className={`px-3 py-2 rounded-lg border transition-colors ${
                project.status === status.key
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              } disabled:opacity-50`}
            >
              {status.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tasks Section */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h3 className="font-semibold mb-4">Tasks</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
            onPaste={async (e) => {
              const text = e.clipboardData.getData("text");
              if (text && /[\r\n]/.test(text)) {
                e.preventDefault();
                const titles = text
                  .split(/\r?\n/)
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0);
                if (titles.length) {
                  await addTasks({ projectId: id, titles });
                  setNewTaskTitle("");
                  window.location.reload();
                }
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddTask();
              }
            }}
          />
          <button
            onClick={handleAddTask}
            className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>
        <div className="text-xs text-neutral-500 mb-2">
          Tip: paste multiple lines to add many tasks at once.
        </div>

        {tasks.length === 0 ? (
          <div className="text-sm text-neutral-500">No tasks yet.</div>
        ) : (
          <Reorder.Group
            axis="y"
            values={localOrder}
            onReorder={setLocalOrder}
            className="space-y-2"
          >
            {localOrder
              .map((taskId) => tasksById.get(taskId))
              .filter(Boolean)
              .map((t: any) => (
                <Reorder.Item
                  value={t.id}
                  key={t.id}
                  layout
                  initial={{ opacity: 0.9, scale: 0.995 }}
                  whileDrag={{
                    scale: 1.02,
                    boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
                  }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2 bg-white dark:bg-neutral-900"
                  onDragStart={() => setIsDragging(true)}
                  onDragEnd={async () => {
                    setIsDragging(false);
                    if (localOrder.join("|") !== serverOrder.join("|")) {
                      await reorderTasks({
                        projectId: id,
                        orderedIds: localOrder,
                      });
                      setServerOrder(localOrder);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="cursor-grab select-none text-neutral-400"
                      title="Drag to reorder"
                    >
                      ⋮
                    </span>
                    <button
                      onClick={() =>
                        toggleTaskState(t.id, (t.state as any) ?? "todo")
                      }
                      className={`w-4 h-4 rounded border ${
                        t.state === "done"
                          ? "bg-green-600 border-green-600"
                          : "border-neutral-400"
                      }`}
                      title="Toggle state"
                    />
                    {editingTaskId === t.id ? (
                      <input
                        autoFocus
                        value={editingTaskTitle}
                        onChange={(e) => setEditingTaskTitle(e.target.value)}
                        onBlur={async () => {
                          const title = editingTaskTitle.trim();
                          setEditingTaskId(null);
                          if (!title || title === t.title) return;
                          await updateTask({
                            projectId: id,
                            taskId: t.id,
                            title,
                          });
                          window.location.reload();
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingTaskId(null);
                            setEditingTaskTitle(t.title);
                          }
                        }}
                        className="px-2 py-1 border border-blue-500 rounded bg-white dark:bg-neutral-800"
                      />
                    ) : (
                      <button
                        onClick={() => {
                          setEditingTaskId(t.id);
                          setEditingTaskTitle(t.title);
                        }}
                        className="text-left"
                        title="Edit title"
                      >
                        <div className="font-medium">{t.title}</div>
                        <div className="text-xs text-neutral-500">
                          {t.state || "todo"}
                          {typeof t.estimate === "number"
                            ? ` · ${t.estimate}h`
                            : ""}
                        </div>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        const res = await promoteTaskToProject({
                          parentId: id,
                          taskId: t.id,
                        });
                        if ((res as any).id) {
                          window.location.reload();
                        }
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Promote
                    </button>
                    <button
                      onClick={() => handleRemoveTask(t.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                </Reorder.Item>
              ))}
          </Reorder.Group>
        )}
      </div>

      {/* Links Section */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h3 className="font-semibold mb-3">Links</h3>
        {(detail.links ?? []).length === 0 ? (
          <div className="text-sm text-neutral-500 mb-3">No links yet.</div>
        ) : (
          <ul className="space-y-2 mb-3">
            {(detail.links ?? []).map((l: any, i: number) => (
              <li
                key={`${l.to_id}:${l.type}:${i}`}
                className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 px-3 py-2"
              >
                <div>
                  <div className="font-medium">
                    <Link
                      href={`/projects/${l.to_id}`}
                      className="hover:underline text-blue-600 hover:text-blue-700"
                    >
                      {allProjects.find((p) => p.id === l.to_id)?.title ||
                        l.to_id}
                    </Link>
                  </div>
                  <div className="text-xs text-neutral-500">relates_to</div>
                </div>
                <button
                  onClick={async () => {
                    await removeLink({ projectId: id, toId: l.to_id });
                    window.location.reload();
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <LinkPicker
          allProjects={allProjects}
          onCreateAndLink={async (title) => {
            const res = await createProject({ title });
            const newId = (res as any).id as string;
            await addLink({ projectId: id, toId: newId });
            window.location.reload();
          }}
          onLinkExisting={async (toId) => {
            await addLink({ projectId: id, toId });
            window.location.reload();
          }}
        />
        {backlinks.length > 0 && (
          <div className="mt-4">
            <h4 className="font-medium mb-2 text-sm text-neutral-600">
              Linked from
            </h4>
            <ul className="space-y-1">
              {backlinks.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/projects/${b.id}`}
                    className="text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {b.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Notes Section */}
      <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900">
        <h3 className="font-semibold mb-4">Notes</h3>
        <div data-color-mode="auto">
          <MDEditor
            value={text}
            onChange={(val) => setText(val || "")}
            height={300}
            preview="live"
            className="w-full"
            textareaProps={{
              placeholder: "Write notes in markdown...",
              autoComplete: "off",
              autoCorrect: "off",
              autoCapitalize: "off",
              spellCheck: false,
            }}
          />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <div className="flex gap-2">
            <button
              onClick={handleManualSave}
              disabled={pending || text === lastSaved}
              className="px-3 py-2 rounded-xl bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              {pending ? "Saving..." : "Save Notes"}
            </button>
          </div>

          {/* Auto-save status indicator */}
          <div className="text-sm text-neutral-500 flex items-center gap-1">
            {autoSaveStatus === "saving" && (
              <>
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                Auto-saving...
              </>
            )}
            {autoSaveStatus === "saved" && text === lastSaved && (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Saved
              </>
            )}
            {autoSaveStatus === "error" && (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                Save failed
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkPicker({
  allProjects,
  onCreateAndLink,
  onLinkExisting,
}: {
  allProjects: Project[];
  onCreateAndLink: (title: string) => Promise<void>;
  onLinkExisting: (id: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);

  const items = allProjects
    .filter((p) =>
      query.trim()
        ? p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.id.toLowerCase().includes(query.toLowerCase())
        : true
    )
    .slice(0, 20);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects…"
          className="flex-1 px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800"
        />
        <button
          onClick={async () => {
            const title = query.trim();
            if (!title) return;
            setCreating(true);
            try {
              await onCreateAndLink(title);
              setQuery("");
            } finally {
              setCreating(false);
            }
          }}
          disabled={creating || !query.trim()}
          className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create & Link"}
        </button>
      </div>
      <div className="max-h-64 overflow-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        {items.length === 0 ? (
          <div className="p-3 text-sm text-neutral-500">No matches</div>
        ) : (
          <ul>
            {items.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-3 py-2 border-b last:border-b-0 border-neutral-200 dark:border-neutral-800"
              >
                <div>
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-neutral-500">{p.id}</div>
                </div>
                <button
                  onClick={async () => {
                    setLinking(p.id);
                    try {
                      await onLinkExisting(p.id);
                    } finally {
                      setLinking(null);
                    }
                  }}
                  disabled={linking === p.id}
                  className="text-sm px-2 py-1 rounded border border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  {linking === p.id ? "Linking…" : "Link"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
