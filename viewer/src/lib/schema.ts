import { z } from "zod";

export const JEVM = z.object({
  joy: z.number().int().min(0).max(4),
  energy: z.number().int().min(0).max(4),
  value: z.number().int().min(0).max(4),
  market: z.number().int().min(0).max(4),
});

export const Project = z.object({
  id: z.string(),
  title: z.string(),
  category: z.string().min(1).catch("exploration"),
  status: z.string().min(1).catch("incubate"),
  jevm: JEVM.optional(),
  pivot_cost: z.enum(["low", "medium", "high"]).optional().nullable(),
});
export type Project = z.infer<typeof Project>;

/* Detail file can have extra fields like focus.outcomes */
export const ProjectDetail = Project.partial().extend({
  focus: z
    .object({
      outcomes: z.array(z.string()).optional(),
    })
    .optional(),
  /* Execution */
  tasks: z.array(Task()).default([]),
  links: z.array(ProjectLink()).default([]),
});
export type ProjectDetail = z.infer<typeof ProjectDetail>;

/* Execution item schemas */
export function Task() {
  return z.object({
    id: z.string(),
    title: z.string().min(1),
    state: z.enum(["todo", "doing", "blocked", "done"]).default("todo"),
    estimate: z.number().int().min(0).optional(),
    order: z.number().int().min(0).optional(),
  });
}
export type Task = z.infer<ReturnType<typeof Task>>;

export function ProjectLink() {
  return z.object({
    to_id: z.string(),
    type: z
      .enum(["depends_on", "relates_to", "part_of"]) // add hierarchy
      .default("depends_on"),
  });
}
export type ProjectLink = z.infer<ReturnType<typeof ProjectLink>>;

/* Seasons */

export const SeasonInitiative = z.object({
  project_id: z.string(),
  role: z.enum(["lead", "supporting"]).default("supporting"),
  outcomes: z
    .array(z.string())
    .max(3, { message: "Up to 3 outcomes per initiative" })
    .default([]),
});
export type SeasonInitiative = z.infer<typeof SeasonInitiative>;

export const WeeklyLog = z.object({
  week_start: z.string(), // "YYYY-MM-DD" (Monday)
  picks: z.array(z.string()).max(6).default([]), // up to 6 tasks/notes
});
export type WeeklyLog = z.infer<typeof WeeklyLog>;

export const Season = z.object({
  id: z.string(), // "2025Q3"
  theme: z.string().default(""),
  start: z.string(), // ISO date
  end: z.string(), // ISO date
  initiatives: z.array(SeasonInitiative).default([]),
  weekly: z.array(WeeklyLog).default([]),
});
export type Season = z.infer<typeof Season>;

/* Status metadata (derived from split YAML files) */
export type StatusMeta = {
  key: string;
  label: string;
  color: "green" | "yellow" | "blue" | "red" | "slate";
  order: number;
};
