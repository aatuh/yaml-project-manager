import "server-only";
import fs from "node:fs";
import path from "node:path";
import YAML, { isMap, isSeq } from "yaml";
import simpleGit from "simple-git";
import {
  Project,
  ProjectDetail,
  Season,
  SeasonInitiative,
  WeeklyLog,
} from "@/lib/schema";

/* Shared helpers */

function dataRoot() {
  return process.env.DATA_DIR ?? path.resolve(process.cwd(), "..");
}

function prettyYaml(obj: unknown) {
  const doc = new YAML.Document();
  doc.contents = doc.createNode(obj);
  function setSpaceBefore(node: unknown) {
    if (!node) return;
    if (isSeq(node)) {
      for (let i = 1; i < node.items.length; i += 1) {
        const item = node.items[i] as any;
        if (item && typeof item === "object") item.spaceBefore = true;
      }
      for (const item of node.items) setSpaceBefore(item as any);
      return;
    }
    if (isMap(node)) {
      for (const pair of node.items) setSpaceBefore((pair as any).value);
      return;
    }
  }
  setSpaceBefore(doc.contents as any);
  return doc.toString({ indent: 2, lineWidth: 0 });
}

async function maybeGitCommit(paths: string[], msg: string) {
  if (process.env.AUTO_COMMIT !== "1") return;
  const git = simpleGit({ baseDir: dataRoot() });
  await git.add(paths);
  await git.commit(msg);
}

/* Projects split YAML */

function statusDir() {
  const base = dataRoot();
  return process.env.DATA_DIR
    ? path.join(base, "data", "projects", "projects")
    : path.join(base, "workspace-data", "projects");
}

function statusFile(s: string) {
  return path.join(statusDir(), `${s}.yaml`);
}

function listStatusKeys(): string[] {
  const dir = statusDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".yaml"))
    .map((d) => path.basename(d.name, ".yaml"));
}

function readStatusProjects(status: string): any[] {
  const file = statusFile(status);
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  const parsed = YAML.parse(raw || "projects: []") ?? { projects: [] };
  return (parsed.projects ?? []) as any[];
}

function readStatusDoc(status: string): {
  projects: any[];
  rest: Record<string, unknown>;
} {
  const file = statusFile(status);
  const raw = fs.existsSync(file) ? fs.readFileSync(file, "utf-8") : "";
  const parsed = (YAML.parse(raw || "projects: []") ?? {}) as Record<
    string,
    unknown
  >;
  const { projects = [], ...rest } = parsed as { projects?: any[] } & Record<
    string,
    unknown
  >;
  return { projects: projects as any[], rest };
}

function writeStatusDoc(
  status: string,
  projects: any[],
  rest: Record<string, unknown>
) {
  const file = statusFile(status);
  const body = { ...rest, projects };
  fs.writeFileSync(file, prettyYaml(body), "utf-8");
}

export async function writeProjectsYaml(nextProjects: Project[]) {
  const root = dataRoot();
  const file = process.env.DATA_DIR
    ? path.join(root, "data", "projects", "projects.yaml")
    : path.join(root, "workspace-data", "projects.yaml");
  const body = { projects: nextProjects };
  fs.writeFileSync(file, prettyYaml(body), "utf-8");
  await maybeGitCommit([file], "proj: update projects.yaml");
}

export async function writeProjectNotes(id: string, notes: string) {
  const root = dataRoot();
  const dir = process.env.DATA_DIR
    ? path.join(root, "data", "projects", "projects", id)
    : path.join(root, "workspace-data", "projects", id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "notes.md");
  fs.writeFileSync(file, notes, "utf-8");
  await maybeGitCommit([file], `proj:${id} notes`);
}

/** Merge and write detail into project.yaml in the project folder. */
export async function writeProjectDetail(
  id: string,
  updates: Partial<ProjectDetail>
) {
  const root = dataRoot();
  const dir = process.env.DATA_DIR
    ? path.join(root, "data", "projects", "projects", id)
    : path.join(root, "workspace-data", "projects", id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "project.yaml");

  let current: ProjectDetail = {} as ProjectDetail;
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = YAML.parse(raw) ?? {};
    const r = ProjectDetail.safeParse(parsed);
    if (r.success) current = r.data;
  }

  // Merge updates with upsert semantics for tasks/links
  let next: ProjectDetail = { ...current } as ProjectDetail;
  const u = updates as Partial<ProjectDetail>;

  if (u.focus) {
    next.focus = { ...(current.focus ?? {}), ...(u.focus as any) } as any;
  }
  if (u.tasks && Array.isArray(u.tasks)) {
    const map = new Map((current.tasks ?? []).map((t: any) => [t.id, t]));
    for (const t of u.tasks as any[]) {
      if (!t || typeof t.id !== "string") continue;
      const existing = map.get(t.id) ?? {};
      map.set(t.id, { ...existing, ...t });
    }
    next.tasks = Array.from(map.values());
  }
  if (u.links && Array.isArray(u.links)) {
    const key = (x: any) => `${x.to_id}::${x.type || "depends_on"}`;
    const map = new Map((current.links ?? []).map((l: any) => [key(l), l]));
    for (const l of u.links as any[]) {
      if (!l || typeof l.to_id !== "string") continue;
      map.set(key(l), { to_id: l.to_id, type: l.type ?? "depends_on" });
    }
    next.links = Array.from(map.values());
  }

  // Shallow-merge any remaining top-level fields
  const { tasks: _ut, links: _ul, focus: _uf, ...rest } = u as any;
  next = { ...next, ...rest } as ProjectDetail;

  // Ensure defaults via schema parse
  const validated = ProjectDetail.parse(next);
  fs.writeFileSync(file, prettyYaml(validated), "utf-8");
  await maybeGitCommit([file], `proj:${id} detail update`);
}

/** Replace tasks array preserving other detail fields. */
export async function setProjectTasks(
  id: string,
  tasks: NonNullable<ProjectDetail["tasks"]>
) {
  const root = dataRoot();
  const dir = process.env.DATA_DIR
    ? path.join(root, "data", "projects", "projects", id)
    : path.join(root, "workspace-data", "projects", id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "project.yaml");

  let current: ProjectDetail = {} as ProjectDetail;
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = YAML.parse(raw) ?? {};
    const r = ProjectDetail.safeParse(parsed);
    if (r.success) current = r.data;
  }

  const next: ProjectDetail = ProjectDetail.parse({
    ...current,
    tasks,
  });

  fs.writeFileSync(file, prettyYaml(next), "utf-8");
  await maybeGitCommit([file], `proj:${id} tasks reorder`);
}

/** Replace links array preserving other detail fields. */
export async function setProjectLinks(
  id: string,
  links: NonNullable<ProjectDetail["links"]>
) {
  const root = dataRoot();
  const dir = process.env.DATA_DIR
    ? path.join(root, "data", "projects", "projects", id)
    : path.join(root, "workspace-data", "projects", id);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "project.yaml");

  let current: ProjectDetail = {} as ProjectDetail;
  if (fs.existsSync(file)) {
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = YAML.parse(raw) ?? {};
    const r = ProjectDetail.safeParse(parsed);
    if (r.success) current = r.data;
  }

  const next: ProjectDetail = ProjectDetail.parse({
    ...current,
    links,
  });

  fs.writeFileSync(file, prettyYaml(next), "utf-8");
  await maybeGitCommit([file], `proj:${id} links update`);
}

/** Upsert a project into its status file, keeping existing order. */
export async function writeProjectToStatusFile(p: Project) {
  fs.mkdirSync(statusDir(), { recursive: true });
  const { projects, rest } = readStatusDoc(p.status);
  const list: Project[] = (projects as Project[]) ?? [];

  const entry = { ...p };
  delete (entry as Record<string, unknown>).status;

  for (const [k, v] of Object.entries(entry)) {
    if (v === undefined) delete (entry as Record<string, unknown>)[k];
  }

  const idx = list.findIndex((x) => x.id === p.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.push(entry);

  writeStatusDoc(p.status, list, rest);
  await maybeGitCommit([statusFile(p.status)], `proj:${p.id} -> ${p.status}`);
}

export async function updateProjectInStatusFile(
  currentId: string,
  updates: Partial<Project>
) {
  const dir = statusDir();

  for (const status of listStatusKeys()) {
    const file = statusFile(status);
    if (!fs.existsSync(file)) continue;

    const { projects, rest } = readStatusDoc(status);
    const list: Project[] = (projects as Project[]) ?? [];

    const idx = list.findIndex((x) => (x as Project).id === currentId);
    if (idx < 0) continue;

    const updated = { ...list[idx] };
    for (const [k, v] of Object.entries(updates)) {
      if (v === undefined) delete (updated as Record<string, unknown>)[k];
      else (updated as Record<string, unknown>)[k] = v;
    }

    list[idx] = updated;
    writeStatusDoc(status, list, rest);
    await maybeGitCommit([file], `proj:${currentId} update`);
    return;
  }

  throw new Error(`Project ${currentId} not found in split files`);
}

export async function writeOrderForStatus(
  status: Project["status"],
  orderedIds: string[]
) {
  fs.mkdirSync(statusDir(), { recursive: true });
  const file = statusFile(status);
  const { projects, rest } = readStatusDoc(status);
  const list: Project[] = (projects as Project[]) ?? [];

  const map = new Map(list.map((p) => [(p as Project).id, p]));
  const next: Project[] = [];

  for (const id of orderedIds) {
    const hit = map.get(id);
    if (hit) next.push(hit);
  }
  for (const p of list) {
    if (!orderedIds.includes((p as Project).id)) next.push(p);
  }

  writeStatusDoc(status, next, rest);
  await maybeGitCommit([file], `proj:${status} reorder`);
}

export async function removeProjectFromStatus(
  status: Project["status"],
  id: string
) {
  fs.mkdirSync(statusDir(), { recursive: true });
  const file = statusFile(status);
  const { projects, rest } = readStatusDoc(status);
  const list: Project[] = (projects as Project[]) ?? [];

  const next = list.filter((p) => (p as Project).id !== id);
  writeStatusDoc(status, next, rest);
  await maybeGitCommit([file], `proj:${status} remove ${id}`);
}

export async function findRawProjectAndStatus(
  id: string
): Promise<{ entry: Record<string, unknown> | null; status: string | null }> {
  for (const status of listStatusKeys()) {
    const list = readStatusProjects(status);
    const hit = list.find((p) => (p as any).id === id);
    if (hit) return { entry: hit as Record<string, unknown>, status };
  }
  return { entry: null, status: null };
}

export async function insertRawProjectIntoStatus(
  status: Project["status"],
  entry: Record<string, unknown>,
  index?: number
) {
  if (!entry || typeof (entry as any).id !== "string")
    throw new Error("Entry must include id");

  fs.mkdirSync(statusDir(), { recursive: true });
  const file = statusFile(status);

  const { projects, rest } = readStatusDoc(status);
  const list = (projects as any[]) ?? [];
  const filtered = list.filter((p) => (p as any).id !== (entry as any).id);

  const at =
    typeof index === "number"
      ? Math.max(0, Math.min(index, filtered.length))
      : filtered.length;

  filtered.splice(at, 0, entry);
  writeStatusDoc(status, filtered, rest);
  await maybeGitCommit([file], `proj:${status} add ${(entry as any).id}`);
}

export async function renameProjectDirectory(oldId: string, newId: string) {
  const base = statusDir();
  const oldDir = path.join(base, oldId);
  const newDir = path.join(base, newId);
  if (fs.existsSync(oldDir) && !fs.existsSync(newDir)) {
    fs.renameSync(oldDir, newDir);
    await maybeGitCommit([oldDir, newDir], `proj: rename ${oldId} -> ${newId}`);
  }
}

export async function deleteProjectDirectory(id: string) {
  const base = statusDir();
  const dir = path.join(base, id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    await maybeGitCommit([dir], `proj: delete ${id} directory`);
  }
}

export async function renameProjectInStatusFile(
  oldId: string,
  updatedProject: Project
) {
  for (const status of listStatusKeys()) {
    const file = statusFile(status);
    if (!fs.existsSync(file)) continue;

    const { projects, rest } = readStatusDoc(status);
    const list: Project[] = (projects as Project[]) ?? [];

    const idx = list.findIndex((x) => (x as Project).id === oldId);
    if (idx < 0) continue;

    list.splice(idx, 1);
    const entry = { ...updatedProject };
    delete (entry as Record<string, unknown>).status;
    for (const [k, v] of Object.entries(entry)) {
      if (v === undefined) delete (entry as Record<string, unknown>)[k];
    }
    list.push(entry);

    writeStatusDoc(status, list, rest);
    await maybeGitCommit(
      [file],
      `proj: rename ${oldId} -> ${updatedProject.id}`
    );
    return;
  }

  throw new Error(`Project ${oldId} not found in split files`);
}

/* Seasons YAML */

function seasonsDir() {
  const base = dataRoot();
  return process.env.DATA_DIR
    ? path.join(base, "data", "projects", "seasons")
    : path.join(base, "workspace-data", "seasons");
}

function seasonFolder(id: string) {
  return path.join(seasonsDir(), id);
}

function seasonYamlPath(id: string) {
  return path.join(seasonFolder(id), "season.yaml");
}

function currentSeasonPointer() {
  return path.join(seasonsDir(), "current.txt");
}

/* Create or update a whole season file. */
export async function writeSeasonYaml(season: Season) {
  const dir = seasonFolder(season.id);
  fs.mkdirSync(dir, { recursive: true });
  const file = seasonYamlPath(season.id);
  const body = {
    theme: season.theme,
    start: season.start,
    end: season.end,
    initiatives: season.initiatives ?? [],
    weekly: season.weekly ?? [],
  };
  fs.writeFileSync(file, prettyYaml(body), "utf-8");
  await maybeGitCommit([file], `season:${season.id} write`);
}

/* Mutations */

export async function setCurrentSeasonId(id: string) {
  fs.mkdirSync(seasonsDir(), { recursive: true });
  const file = currentSeasonPointer();
  fs.writeFileSync(file, `${id}\n`, "utf-8");
  await maybeGitCommit([file], `season:${id} set current`);
}

export async function upsertSeasonInitiative(
  id: string,
  initiative: SeasonInitiative
) {
  const file = seasonYamlPath(id);
  if (!fs.existsSync(file)) throw new Error("Season not found");
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = YAML.parse(raw) ?? {};
  const list: SeasonInitiative[] = parsed.initiatives ?? [];

  const idx = list.findIndex((i) => i.project_id === initiative.project_id);
  if (idx >= 0) list[idx] = { ...list[idx], ...initiative };
  else list.push(initiative);

  // Ensure any lead initiatives appear first
  const leads = list.filter((i) => i.role === "lead");
  const others = list.filter((i) => i.role !== "lead");
  parsed.initiatives = [...leads, ...others];
  fs.writeFileSync(file, prettyYaml(parsed), "utf-8");
  await maybeGitCommit([file], `season:${id} upsert initiative`);
}

export async function removeSeasonInitiative(id: string, projectId: string) {
  const file = seasonYamlPath(id);
  if (!fs.existsSync(file)) throw new Error("Season not found");
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = YAML.parse(raw) ?? {};
  const list: SeasonInitiative[] = parsed.initiatives ?? [];
  parsed.initiatives = list.filter((i) => i.project_id !== projectId);
  fs.writeFileSync(file, prettyYaml(parsed), "utf-8");
  await maybeGitCommit([file], `season:${id} remove initiative ${projectId}`);
}

export async function updateInitiativeOutcomes(
  id: string,
  projectId: string,
  outcomes: string[]
) {
  const file = seasonYamlPath(id);
  if (!fs.existsSync(file)) throw new Error("Season not found");
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = YAML.parse(raw) ?? {};
  const list: SeasonInitiative[] = parsed.initiatives ?? [];
  const idx = list.findIndex((i) => i.project_id === projectId);
  if (idx < 0) throw new Error("Initiative not found in season");
  list[idx] = { ...list[idx], outcomes: outcomes.slice(0, 3) };
  parsed.initiatives = list;
  fs.writeFileSync(file, prettyYaml(parsed), "utf-8");
  await maybeGitCommit([file], `season:${id} update outcomes ${projectId}`);
}

export async function setWeeklyPicks(
  id: string,
  weekStart: string,
  picks: string[]
) {
  const file = seasonYamlPath(id);
  if (!fs.existsSync(file)) throw new Error("Season not found");
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = YAML.parse(raw) ?? {};
  const weekly: WeeklyLog[] = parsed.weekly ?? [];
  const idx = weekly.findIndex((w) => w.week_start === weekStart);
  const entry: WeeklyLog = {
    week_start: weekStart,
    picks: picks.slice(0, 6),
  };
  if (idx >= 0) weekly[idx] = entry;
  else weekly.push(entry);
  parsed.weekly = weekly.sort((a, b) =>
    a.week_start.localeCompare(b.week_start)
  );
  fs.writeFileSync(file, prettyYaml(parsed), "utf-8");
  await maybeGitCommit([file], `season:${id} weekly ${weekStart}`);
}

export async function updateSeasonTheme(id: string, theme: string) {
  const file = seasonYamlPath(id);
  if (!fs.existsSync(file)) throw new Error("Season not found");
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = YAML.parse(raw) ?? {};
  parsed.theme = theme ?? "";
  fs.writeFileSync(file, prettyYaml(parsed), "utf-8");
  await maybeGitCommit([file], `season:${id} update theme`);
}

export async function renameSeason(oldId: string, newId: string) {
  if (oldId === newId) return;
  const from = seasonFolder(oldId);
  const to = seasonFolder(newId);
  if (!fs.existsSync(from)) throw new Error("Season not found");
  fs.mkdirSync(seasonsDir(), { recursive: true });
  if (fs.existsSync(to)) throw new Error("Target season already exists");
  fs.renameSync(from, to);
  await maybeGitCommit([from, to], `season: rename ${oldId} -> ${newId}`);

  const ptr = currentSeasonPointer();
  if (fs.existsSync(ptr)) {
    const v = fs.readFileSync(ptr, "utf-8").trim();
    if (v === oldId) {
      fs.writeFileSync(ptr, `${newId}\n`, "utf-8");
      await maybeGitCommit([ptr], `season:${newId} set current (rename)`);
    }
  }
}

/** Delete a season directory entirely. If it was current, clear pointer. */
export async function deleteSeason(id: string) {
  const dir = seasonFolder(id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    await maybeGitCommit([dir], `season:${id} delete directory`);
  }
  const ptr = currentSeasonPointer();
  if (fs.existsSync(ptr)) {
    const v = fs.readFileSync(ptr, "utf-8").trim();
    if (v === id) {
      fs.writeFileSync(ptr, "\n", "utf-8");
      await maybeGitCommit([ptr], `season:${id} clear current`);
    }
  }
}
