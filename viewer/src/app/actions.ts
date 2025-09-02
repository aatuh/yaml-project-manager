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
} from "@/lib/schema";
import { readProjectsYaml, readSeason } from "@/lib/server/data";
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
