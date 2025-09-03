"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  Project,
  Project as ProjectSchema,
  JEVM,
  Season,
  SeasonInitiative,
  ProjectDetail,
} from "@/lib/schema";
import {
  readProjectsYaml,
  readProjectDetail,
  readSeason,
} from "@/lib/server/data";
import {
  writeProjectsYaml,
  writeProjectNotes,
  writeProjectToStatusFile,
  updateProjectInStatusFile,
  renameProjectDirectory,
  renameProjectInStatusFile,
  writeOrderForStatus,
  removeProjectFromStatus,
  findRawProjectAndStatus,
  insertRawProjectIntoStatus,
  deleteProjectDirectory,
  writeSeasonYaml,
  setCurrentSeasonId,
  upsertSeasonInitiative,
  removeSeasonInitiative,
  updateInitiativeOutcomes,
  setWeeklyPicks,
  deleteSeason,
  writeProjectDetail,
  setProjectTasks,
  setProjectLinks,
  renameSeason,
  updateSeasonTheme,
} from "@/lib/server/write";

/* Projects (existing) */

const Upsert = ProjectSchema;

export async function upsertProject(input: Project) {
  const parsed = Upsert.safeParse(input);
  if (!parsed.success) throw new Error("Invalid project payload");
  const p = parsed.data;

  const all = await readProjectsYaml();
  const idx = all.findIndex((x) => x.id === p.id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...p };
  } else {
    all.push(p);
  }

  await writeProjectsYaml(all.sort((a, b) => a.id.localeCompare(b.id)));

  revalidatePath("/");
  revalidatePath(`/projects/${p.id}`);
  return { ok: true };
}

export async function updateNotes(id: string, notes: string) {
  if (!id) throw new Error("Missing id");
  await writeProjectNotes(id, notes);
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function updateProjectStatus(
  id: string,
  newStatus: Project["status"]
) {
  if (!id) throw new Error("Missing id");

  const { entry, status } = await findRawProjectAndStatus(id);
  if (!entry || !status) throw new Error("Project not found");

  if (status === newStatus) {
    revalidatePath("/");
    revalidatePath(`/projects/${id}`);
    return { ok: true };
  }

  (entry as any).status = newStatus;
  await removeProjectFromStatus(status as Project["status"], id);
  await insertRawProjectIntoStatus(newStatus, entry);

  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function updateJEVM(id: string, jevm: z.infer<typeof JEVM>) {
  if (!id) throw new Error("Missing id");
  await updateProjectInStatusFile(id, { jevm });
  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function removeJEVM(id: string) {
  if (!id) throw new Error("Missing id");
  await updateProjectInStatusFile(id, { jevm: undefined });
  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function updateProjectProperties(
  id: string,
  updates: Partial<Project>
) {
  if (!id) throw new Error("Missing id");
  await updateProjectInStatusFile(id, updates);
  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function renameProject(
  oldId: string,
  newId: string,
  newTitle: string
) {
  if (!oldId || !newId) throw new Error("Missing id");
  if (oldId === newId) throw new Error("New ID must differ from old ID");

  const all = await readProjectsYaml();
  const project = all.find((p) => p.id === oldId);
  if (!project) throw new Error("Project not found");

  if (all.find((p) => p.id === newId)) {
    throw new Error("Project with new ID already exists");
  }

  const updatedProject = { ...project, id: newId, title: newTitle };

  await renameProjectDirectory(oldId, newId);
  await renameProjectInStatusFile(oldId, updatedProject);

  revalidatePath("/");
  revalidatePath(`/projects/${oldId}`);
  revalidatePath(`/projects/${newId}`);

  await new Promise((resolve) => setTimeout(resolve, 100));
  return { ok: true };
}

export async function reorderStatus(
  status: Project["status"],
  orderedIds: string[]
) {
  if (!status) throw new Error("Missing status");
  await writeOrderForStatus(status, orderedIds);
  revalidatePath("/");
  return { ok: true };
}

export async function moveProjectToStatus(
  id: string,
  fromStatus: Project["status"],
  toStatus: Project["status"],
  toIndex?: number
) {
  if (!id) throw new Error("Missing id");
  if (!fromStatus || !toStatus) throw new Error("Missing statuses");
  if (fromStatus === toStatus) return { ok: true };

  const { entry } = await findRawProjectAndStatus(id);
  if (!entry) throw new Error("Project not found in split files");

  (entry as any).status = toStatus;

  await removeProjectFromStatus(fromStatus, id);
  await insertRawProjectIntoStatus(toStatus, entry, toIndex);

  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function deleteProject(id: string) {
  if (!id) throw new Error("Missing id");
  const found = await findRawProjectAndStatus(id);
  if (found.status) {
    await removeProjectFromStatus(found.status as Project["status"], id);
  }
  await deleteProjectDirectory(id);

  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

const DEFAULT_CATEGORY: Project["category"] = "exploration";
const DEFAULT_STATUS: Project["status"] = "incubate";

function slugifyId(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function createProject(input: {
  title: string;
  id?: string;
  category?: Project["category"];
  status?: Project["status"];
  pivot_cost?: Project["pivot_cost"];
  jevm?: z.infer<typeof JEVM>;
}) {
  const title = (input.title || "").trim();
  if (!title) throw new Error("Title is required");

  const desiredId = (input.id || slugifyId(title) || title).toLowerCase();
  const all = await readProjectsYaml();
  const taken = new Set(all.map((p) => p.id));

  let id = desiredId;
  let n = 2;
  while (taken.has(id)) id = `${desiredId}-${n++}`;

  const project: Project = {
    id,
    title,
    category: input.category ?? DEFAULT_CATEGORY,
    status: input.status ?? DEFAULT_STATUS,
    pivot_cost: input.pivot_cost ?? null,
    jevm: input.jevm,
  } as Project;

  await writeProjectToStatusFile(project);

  revalidatePath("/");
  revalidatePath(`/projects/${id}`);
  return { ok: true, id };
}

/* Tasks & Links */

export async function addTask(input: {
  projectId: string;
  title: string;
  estimate?: number;
}) {
  const id = input.projectId;
  const title = (input.title || "").trim();
  if (!id || !title) throw new Error("Missing project or title");

  const baseId = title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const { detail } = await readProjectDetail(id);
  const taken = new Set((detail.tasks ?? []).map((t: any) => t.id));
  let taskId = baseId || `task`;
  let n = 2;
  while (taken.has(taskId)) taskId = `${baseId || "task"}-${n++}`;

  const update: Partial<ProjectDetail> = {
    tasks: [
      {
        id: taskId,
        title,
        state: "todo",
        estimate: input.estimate,
        order: (detail.tasks?.length ?? 0) + 1,
      },
    ],
  } as any;
  await writeProjectDetail(id, update);
  revalidatePath(`/projects/${id}`);
  return { ok: true };
}

export async function updateTask(input: {
  projectId: string;
  taskId: string;
  title?: string;
  state?: "todo" | "doing" | "blocked" | "done";
  estimate?: number | null;
}) {
  const { projectId, taskId } = input;
  if (!projectId || !taskId) throw new Error("Missing ids");
  const { detail } = await readProjectDetail(projectId);
  const tasks = (detail.tasks ?? []).slice();
  const idx = tasks.findIndex((t: any) => t.id === taskId);
  if (idx < 0) throw new Error("Task not found");
  const updated = { ...tasks[idx] } as any;
  if (typeof input.title === "string") updated.title = input.title;
  if (input.state) updated.state = input.state;
  if (input.estimate === null) delete updated.estimate;
  else if (typeof input.estimate === "number")
    updated.estimate = input.estimate;
  tasks[idx] = updated;
  await writeProjectDetail(projectId, { tasks } as any);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeTask(input: { projectId: string; taskId: string }) {
  const { projectId, taskId } = input;
  if (!projectId || !taskId) throw new Error("Missing ids");
  const { detail } = await readProjectDetail(projectId);
  const tasks = (detail.tasks ?? []).filter((t: any) => t.id !== taskId);
  await setProjectTasks(projectId, tasks as any);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function addLink(input: {
  projectId: string;
  toId: string;
  type?: "depends_on" | "relates_to" | "part_of";
}) {
  const { projectId, toId, type } = input;
  if (!projectId || !toId) throw new Error("Missing ids");
  await writeProjectDetail(projectId, {
    links: [{ to_id: toId, type: type ?? "relates_to" }],
  } as Partial<ProjectDetail>);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function removeLink(input: { projectId: string; toId: string }) {
  const { projectId, toId } = input;
  if (!projectId || !toId) throw new Error("Missing ids");
  const { detail } = await readProjectDetail(projectId);
  const links = (detail.links ?? []).filter((l: any) => l.to_id !== toId);
  await setProjectLinks(projectId, links as any);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function addTasks(input: { projectId: string; titles: string[] }) {
  const { projectId, titles } = input;
  if (!projectId) throw new Error("Missing projectId");
  const lines = (titles || [])
    .map((s) => (s || "").trim())
    .filter((s) => s.length > 0);
  if (!lines.length) return { ok: true };

  const { detail } = await readProjectDetail(projectId);
  const taken = new Set((detail.tasks ?? []).map((t: any) => t.id));
  const baseFrom = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "") || "task";

  let order = (detail.tasks?.length ?? 0) + 1;
  const toAdd: any[] = [];
  for (const title of lines) {
    const base = baseFrom(title);
    let id = base;
    let n = 2;
    while (taken.has(id)) id = `${base}-${n++}`;
    taken.add(id);
    toAdd.push({ id, title, state: "todo", order: order++ });
  }

  await writeProjectDetail(projectId, { tasks: toAdd } as any);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, added: toAdd.length };
}

export async function promoteTaskToProject(input: {
  parentId: string;
  taskId: string;
  projectTitle?: string;
  status?: Project["status"];
  category?: Project["category"];
}) {
  const { parentId, taskId } = input;
  if (!parentId || !taskId) throw new Error("Missing ids");

  const { detail } = await readProjectDetail(parentId);
  const task = (detail.tasks ?? []).find((t: any) => t.id === taskId) as
    | { id: string; title: string }
    | undefined;
  if (!task) throw new Error("Task not found");

  const title = (input.projectTitle || task.title || "").trim();
  const proj = await createProject({
    title,
    status: input.status,
    category: input.category,
  });
  const newId = (proj as any).id as string;

  // Remove task from parent and link child project
  const remaining = (detail.tasks ?? []).filter((t: any) => t.id !== taskId);
  await writeProjectDetail(parentId, {
    tasks: remaining as any,
    links: [{ to_id: newId, type: "part_of" }],
  } as any);

  revalidatePath(`/projects/${parentId}`);
  revalidatePath(`/projects/${newId}`);
  return { ok: true, id: newId };
}

export async function demoteProjectToTask(input: {
  parentId: string;
  childProjectId: string;
  removeChild?: boolean; // if true, archive/delete child (not implemented)
}) {
  const { parentId, childProjectId } = input;
  if (!parentId || !childProjectId) throw new Error("Missing ids");

  const all = await readProjectsYaml();
  const child = all.find((p) => p.id === childProjectId);
  if (!child) throw new Error("Child project not found");

  const { detail } = await readProjectDetail(parentId);

  const baseId = child.title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  const taken = new Set((detail.tasks ?? []).map((t: any) => t.id));
  let taskId = baseId || `task`;
  let n = 2;
  while (taken.has(taskId)) taskId = `${baseId || "task"}-${n++}`;

  const nextTasks = [
    ...((detail.tasks ?? []) as any[]),
    {
      id: taskId,
      title: child.title,
      state: "todo",
      order: (detail.tasks?.length ?? 0) + 1,
    },
  ];

  // Remove part_of link if exists
  const nextLinks = (detail.links ?? []).filter(
    (l: any) => !(l.to_id === childProjectId && l.type === "part_of")
  );

  await writeProjectDetail(parentId, {
    tasks: nextTasks as any,
    links: nextLinks as any,
  });

  revalidatePath(`/projects/${parentId}`);
  return { ok: true, taskId };
}

export async function reorderTasks(input: {
  projectId: string;
  orderedIds: string[];
}) {
  const { projectId, orderedIds } = input;
  if (!projectId) throw new Error("Missing projectId");
  const { detail } = await readProjectDetail(projectId);
  const byId = new Map((detail.tasks ?? []).map((t: any) => [t.id, t]));
  const next = orderedIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((t: any, i) => ({ ...t, order: i + 1 }));
  // Append any that were not included (defensive)
  for (const t of detail.tasks ?? []) {
    if (!orderedIds.includes((t as any).id)) {
      next.push({ ...(t as any), order: next.length + 1 });
    }
  }
  await setProjectTasks(projectId, next as any);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/* Seasons */

export async function createSeason(input: {
  id: string; // "YYYYQn"
  theme: string;
  start: string; // "YYYY-MM-DD"
  end: string; // "YYYY-MM-DD"
}) {
  const season: Season = {
    id: input.id,
    theme: input.theme || "",
    start: input.start,
    end: input.end,
    initiatives: [],
    weekly: [],
  };
  await writeSeasonYaml(season);
  revalidatePath("/seasons");
  revalidatePath(`/seasons/${season.id}`);
  return { ok: true, id: season.id };
}

export async function setCurrentSeason(id: string) {
  await setCurrentSeasonId(id);
  revalidatePath("/");
  revalidatePath("/seasons");
  revalidatePath(`/seasons/${id}`);
  return { ok: true };
}

export async function addSeasonInitiative(input: {
  seasonId: string;
  projectId: string;
  role: "lead" | "supporting";
}) {
  const s = await readSeason(input.seasonId);
  if (!s) throw new Error("Season not found");
  const exists = s.initiatives.find((i) => i.project_id === input.projectId);
  const payload: SeasonInitiative = {
    project_id: input.projectId,
    role: input.role,
    outcomes: exists?.outcomes ?? [],
  };
  await upsertSeasonInitiative(input.seasonId, payload);
  revalidatePath(`/seasons/${input.seasonId}`);
  return { ok: true };
}

export async function removeSeasonInitiativeAction(
  seasonId: string,
  projectId: string
) {
  await removeSeasonInitiative(seasonId, projectId);
  revalidatePath(`/seasons/${seasonId}`);
  return { ok: true };
}

export async function saveInitiativeOutcomes(input: {
  seasonId: string;
  projectId: string;
  outcomes: string[];
}) {
  await updateInitiativeOutcomes(
    input.seasonId,
    input.projectId,
    input.outcomes
  );
  revalidatePath(`/seasons/${input.seasonId}`);
  revalidatePath(`/projects/${input.projectId}`);
  return { ok: true };
}

export async function setSeasonWeeklyPicks(input: {
  seasonId: string;
  weekStart: string; // Monday
  picks: string[];
}) {
  await setWeeklyPicks(input.seasonId, input.weekStart, input.picks);
  revalidatePath(`/seasons/${input.seasonId}`);
  return { ok: true };
}

export async function deleteSeasonAction(id: string) {
  if (!id) throw new Error("Missing id");
  await deleteSeason(id);
  revalidatePath("/seasons");
  revalidatePath(`/seasons/${id}`);
  redirect("/seasons");
}

export async function updateSeasonMeta(input: {
  oldId: string;
  newId: string;
  theme: string;
}) {
  const oldId = (input.oldId || "").trim();
  const newId = (input.newId || "").trim();
  const theme = (input.theme || "").trim();
  if (!oldId || !newId) throw new Error("Missing season id");

  if (newId !== oldId) {
    await renameSeason(oldId, newId);
    await updateSeasonTheme(newId, theme);
  } else {
    await updateSeasonTheme(oldId, theme);
  }

  revalidatePath("/seasons");
  revalidatePath(`/seasons/${oldId}`);
  revalidatePath(`/seasons/${newId}`);
  redirect(`/seasons/${newId}`);
}
