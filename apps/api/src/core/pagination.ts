import type { PaginatedResponse, PaginationMeta } from "@travel/contracts";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export interface PageQuery {
  page?: string | number;
  pageSize?: string | number;
  query?: string;
  status?: string;
  groupId?: string;
  department?: string;
  type?: string;
}

export function parsePageQuery(query: PageQuery) {
  const requestedPage = Number(query.page ?? 1);
  const requestedPageSize = Number(query.pageSize ?? DEFAULT_PAGE_SIZE);
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const pageSize =
    Number.isInteger(requestedPageSize) && requestedPageSize > 0
      ? Math.min(requestedPageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
    query: query.query?.trim() ?? "",
    status: query.status?.trim() ?? "",
    groupId: query.groupId?.trim() ?? "",
    department: query.department?.trim() ?? "",
    type: query.type?.trim() ?? "",
  };
}

export function paginationMeta(
  page: number,
  pageSize: number,
  total: number,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export function paginated<T>(
  items: T[],
  page: number,
  pageSize: number,
  total: number,
): PaginatedResponse<T> {
  return { items, pagination: paginationMeta(page, pageSize, total) };
}
