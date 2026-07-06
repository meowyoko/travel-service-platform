import type { PaginatedResponse, PaginationMeta } from "@travel/contracts";
import { useEffect, useMemo, useState } from "react";

import { fetchPaginated } from "../lib/api";

const emptyPagination: PaginationMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

export function usePaginatedList<T>(
  path: string,
  filters: Record<string, string | undefined>,
  refreshSignal?: unknown,
) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResponse<T>>({
    items: [],
    pagination: emptyPagination,
  });
  const [isLoading, setIsLoading] = useState(true);
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => setPage(1), [filterKey]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    void fetchPaginated<T>(path, {
      page,
      pageSize: 20,
      ...filters,
    })
      .then((next) => {
        if (active) setResult(next);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filterKey, page, path, refreshSignal]);

  return {
    ...result,
    isLoading,
    setPage,
  };
}
