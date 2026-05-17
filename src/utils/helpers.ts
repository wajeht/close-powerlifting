import { Request } from "express";

import { configuration } from "../configuration";
import type { Pagination } from "../types";

export function buildPagination(total: number, page: number, limit: number): Pagination {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const offset = (currentPage - 1) * limit;

  return {
    items: total,
    pages: totalPages,
    per_page: limit,
    current_page: currentPage,
    last_page: totalPages,
    first_page: 1,
    from: total > 0 ? offset + 1 : 0,
    to: Math.min(offset + limit, total),
  };
}

const KG_TO_LBS = 2.20462262185;

export type Units = "lbs" | "kg";

export function inUnits(kg: number | null | undefined, units: Units): number | null {
  if (kg == null) return null;
  if (units === "kg") return kg;
  return Math.round(kg * KG_TO_LBS * 100) / 100;
}

// Stable URL-safe identifier — strip diacritics, lowercase, keep only
// alphanumerics. Mirrors OpenPowerlifting's Username::from_name in
// crates/opltypes/src/username.rs.
//
// Quirk: names with no ASCII transliteration (CJK / Cyrillic-only) collapse
// to empty here. OPL falls back to a numeric ID in that case; we'll do the
// same when we wire the loader (phase 2).
const REGEX_DIACRITICS = /\p{Mn}/gu;
const REGEX_SLUG_STRIP = /[^a-z0-9]/g;

export function nameToSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(REGEX_DIACRITICS, "")
    .toLowerCase()
    .replace(REGEX_SLUG_STRIP, "");
}

export interface HelpersType {
  getHostName: (req: Request) => string;
}

export function createHelper(): HelpersType {
  function getHostName(req: Request): string {
    if (configuration.app.env === "development") {
      const protocol = req.protocol;
      const hostname = req.get("host");
      return `${protocol}://${hostname}`;
    }
    return configuration.app.domain;
  }

  return { getHostName };
}
