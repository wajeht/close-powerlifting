// Response envelope + pagination + units conversion. Shared across every
// /api/* handler so the wire shape stays in lock-step with the published
// OpenAPI spec.

import type { Response } from "express";

// ---------- Response envelope ----------

interface PaginationOut {
  current_page: number;
  per_page: number;
  from: number;
  to: number;
  items: number;
  pages: number;
  first_page: number;
  last_page: number;
}

interface SuccessBody<T> {
  status: "success";
  request_url: string;
  message: string;
  data: T;
  pagination?: PaginationOut;
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { requestUrl: string; pagination?: PaginationOut; message?: string } = {
    requestUrl: "",
  },
): Response {
  const body: SuccessBody<T> = {
    status: "success",
    request_url: options.requestUrl,
    message: options.message ?? "The resource was returned successfully!",
    data,
  };
  if (options.pagination) body.pagination = options.pagination;
  return res.status(200).json(body);
}

// ---------- Pagination ----------

// Builds the canonical pagination block. `totalItems` is the unpaginated
// row count; the rest is derived. Defaults match the documented spec
// (current_page=1, per_page=100).
export function buildPagination(
  totalItems: number,
  currentPage: number = 1,
  perPage: number = 100,
): PaginationOut {
  const items = Math.max(0, totalItems);
  const pages = items === 0 ? 1 : Math.ceil(items / perPage);
  const safePage = Math.min(Math.max(1, currentPage), pages);
  const fromZeroIdx = (safePage - 1) * perPage;
  const from = items === 0 ? 0 : fromZeroIdx + 1;
  const to = Math.min(fromZeroIdx + perPage, items);
  return {
    current_page: safePage,
    per_page: perPage,
    from,
    to,
    items,
    pages,
    first_page: 1,
    last_page: pages,
  };
}

// Slices `items` for the requested page. Returns the slice + the matching
// PaginationOut so handlers can emit both in one shot.
export function paginate<T>(
  items: readonly T[],
  currentPage?: number,
  perPage?: number,
): { slice: T[]; pagination: PaginationOut } {
  const page = currentPage ?? 1;
  const size = perPage ?? 100;
  const pagination = buildPagination(items.length, page, size);
  const start = (pagination.current_page - 1) * pagination.per_page;
  const end = start + pagination.per_page;
  return { slice: items.slice(start, end) as T[], pagination };
}

// ---------- Units conversion ----------

const KG_TO_LBS = 2.20462262185;

export type Units = "lbs" | "kg";

export function kgToLbs(kg: number | null | undefined): number | null {
  if (kg == null) return null;
  return Math.round(kg * KG_TO_LBS * 100) / 100;
}

// Applies the user-requested unit system to a kg value. Default is `lbs`
// per the published spec; pass `units: "kg"` to skip conversion.
export function inUnits(kg: number | null | undefined, units: Units): number | null {
  if (kg == null) return null;
  return units === "kg" ? kg : kgToLbs(kg);
}
