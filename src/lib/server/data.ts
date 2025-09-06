import "server-only";
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import fg from "fast-glob";
import matter from "gray-matter";
import {
  Project as ProjectSchema,
  type Project,
  ProjectDetail,
  Season,
  SeasonInitiative,
} from "@/lib/schema";

/* Paths */

function resolveDataRoot() {
  const fromEnv = process.env.DATA_DIR;
  if (fromEnv) return fromEnv;
  return path.resolve(process.cwd(), "..");
}

function root() {
  return process.env.DATA_DIR ?? path.resolve(process.cwd(), "..");
}

function projectsSplitDir() {
  const base = root();
  return process.env.DATA_DIR
    ? path.join(base, "data", "projects", "projects")
    : path.join(base, "workspace-data", "projects");
}

function projectsRootFile() {
  const base = root();
  return process.env.DATA_DIR
    ? path.join(base, "data", "projects", "projects.yaml")
    : path.join(base, "workspace-data", "projects.yaml");
}

function seasonsDir() {
  const base = root();
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

/* Projects */

export type StatusMeta = {
  key: string;
  label: string;
  color: "green" | "yellow" | "blue" | "red" | "slate";
  order: number;
};

function statusDirFiles() {
  const dir = projectsSplitDir();
  if (!fs.existsSync(dir)) return [] as string[];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".yaml"))
    .map((d) => path.join(dir, d.name));
}

export async function readStatusMetaList(): Promise<StatusMeta[]> {
  const files = statusDirFiles();
  const baseOrder: Record<string, number> = {
    active: 0,
    incubate: 1,
    archive: 2,
    graveyard: 3,
    hypo: 4,
    done: 5,
  };
  const metas: StatusMeta[] = files.map((file) => {
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = YAML.parse(raw) ?? {};
    const key = path.basename(file, ".yaml");
    const meta = parsed.meta ?? {};
    const label = (meta.label as string) || key;
    const color = (meta.color as StatusMeta["color"]) || "slate";
    const order =
      typeof meta.order === "number"
        ? (meta.order as number)
        : baseOrder[key] ?? 999;
    return { key, label, color, order };
  });
  return metas.sort((a, b) => a.order - b.order);
}

export async function readProjectsYaml(): Promise<Project[]> {
  const out: Project[] = [];

  // 1) Read split files in dynamic status order and keep array order
  const statuses = await readStatusMetaList();
  for (const s of statuses) {
    const file = path.join(projectsSplitDir(), `${s.key}.yaml`);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, "utf-8");
    const parsed = YAML.parse(raw) ?? {};
    const list: unknown[] = parsed.projects ?? [];
    for (const item of list) {
      const r = ProjectSchema.partial().safeParse(item);
      if (!r.success || !r.data.id) continue;
      out.push({
        id: r.data.id,
        title: r.data.title ?? r.data.id,
        category: r.data.category ?? "exploration",
        status: (r.data.status as string) || s.key,
        jevm: r.data.jevm,
        pivot_cost: r.data.pivot_cost,
      });
    }
  }

  // 2) Back-compat: merge root projects.yaml at the end
  const rootFile = projectsRootFile();
  if (fs.existsSync(rootFile)) {
    const raw = fs.readFileSync(rootFile, "utf-8");
    const parsed = YAML.parse(raw) ?? {};
    const list: unknown[] = parsed.projects ?? [];
    for (const item of list) {
      const r = ProjectSchema.safeParse(item);
      if (r.success) {
        const i = out.findIndex((p) => p.id === r.data.id);
        if (i >= 0) out[i] = r.data;
        else out.push(r.data);
      }
    }
  }

  return out;
}

export async function deriveCategories(): Promise<string[]> {
  const projects = await readProjectsYaml();
  return Array.from(new Set(projects.map((p) => p.category))).sort();
}

export async function readProjectDetail(
  id: string
): Promise<{ detail: ProjectDetail; notes: string }> {
  const base = resolveDataRoot();
  const dir = process.env.DATA_DIR
    ? path.join(base, "data", "projects", "projects", id)
    : path.join(base, "workspace-data", "projects", id);
  const projectYaml = path.join(dir, "project.yaml");
  const notesMd = path.join(dir, "notes.md");

  let detail: ProjectDetail = {};
  if (fs.existsSync(projectYaml)) {
    const raw = fs.readFileSync(projectYaml, "utf-8");
    const y = YAML.parse(raw);
    const parsed = ProjectDetail.safeParse(y);
    if (parsed.success) detail = parsed.data;
  }

  let notes = "";
  if (fs.existsSync(notesMd)) {
    const raw = fs.readFileSync(notesMd, "utf-8");
    const md = matter(raw);
    notes = md.content.trim();
  } else {
    const files = fg
      .sync(path.join(dir, "journal", "*.md"), { dot: false })
      .sort()
      .reverse();
    if (files[0]) notes = fs.readFileSync(files[0], "utf-8");
  }

  return { detail, notes };
}

/* Seasons */

export async function listSeasonIds(): Promise<string[]> {
  const dir = seasonsDir();
  if (!fs.existsSync(dir)) return [];
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => /^\d{4}Q[1-4]$/.test(n));
  return entries.sort();
}

export async function readSeason(id: string): Promise<Season | null> {
  const file = seasonYamlPath(id);
  if (!fs.existsSync(file)) return null;
  const raw = fs.readFileSync(file, "utf-8");
  const parsed = YAML.parse(raw) ?? {};
  const data = {
    id,
    theme: parsed.theme ?? "",
    start: parsed.start,
    end: parsed.end,
    initiatives: parsed.initiatives ?? [],
    weekly: parsed.weekly ?? [],
  };
  const r = Season.safeParse(data);
  return r.success ? r.data : null;
}

export async function readCurrentSeasonId(): Promise<string | null> {
  const ptr = currentSeasonPointer();
  if (fs.existsSync(ptr)) {
    const v = fs.readFileSync(ptr, "utf-8").trim();
    if (v) return v;
  }
  const ids = await listSeasonIds();
  if (!ids.length) return null;

  const today = new Date().toISOString().slice(0, 10);
  for (const id of ids) {
    const s = await readSeason(id);
    if (!s) continue;
    if (s.start <= today && today <= s.end) return id;
  }
  return ids[ids.length - 1] ?? null;
}

export async function readCurrentSeason(): Promise<Season | null> {
  const id = await readCurrentSeasonId();
  if (!id) return null;
  return readSeason(id);
}

export function findInitiativeForProject(
  season: Season | null,
  projectId: string
): SeasonInitiative | null {
  if (!season) return null;
  return season.initiatives.find((i) => i.project_id === projectId) ?? null;
}
