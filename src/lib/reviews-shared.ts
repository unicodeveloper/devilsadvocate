/**
 * Pure types + helpers for the reviews/objections system that are safe to
 * import from client components. Anything DB-touching lives in reviews.ts;
 * this file must stay free of @/lib/db imports.
 */
import type { Objection, ObjectionThread, Review } from "./db/schema";
import type { Evidence } from "./critic/types";

export type LoadedObjection = Objection & {
  evidence: Evidence[];
  threads: ObjectionThread[];
};

export type LoadedReview = Review & {
  objections: LoadedObjection[];
};

/**
 * The FM is allowed to resubmit only when every BLOCKING and MAJOR objection
 * has been addressed (resolved, disputed, or wontfix). MINOR / INFO can stay
 * open without gating.
 */
export function canResubmit(objs: Objection[]): boolean {
  return objs.every(
    (o) =>
      o.status === "resolved" ||
      o.status === "disputed" ||
      o.status === "wontfix" ||
      (o.severity !== "BLOCKING" && o.severity !== "MAJOR"),
  );
}

export function summarizeObjections(objs: Objection[]) {
  const open = objs.filter((o) => o.status === "open");
  return {
    total: objs.length,
    open: open.length,
    blocking: open.filter((o) => o.severity === "BLOCKING").length,
    major: open.filter((o) => o.severity === "MAJOR").length,
    minor: open.filter((o) => o.severity === "MINOR").length,
    info: open.filter((o) => o.severity === "INFO").length,
    disputed: objs.filter((o) => o.status === "disputed").length,
    resolved: objs.filter((o) => o.status === "resolved").length,
  };
}
