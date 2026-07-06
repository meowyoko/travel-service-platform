import type { PaginationMeta } from "@travel/contracts";
import { useEffect, useMemo, useState } from "react";

import { fetchPaginated } from "../lib/api";

const emptyMeta: PaginationMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 1,
};

export function useLoadMore<T>(
  path: string,
  filters: Record<string, string | undefined>,
  refreshSignal?: unknown,
) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(emptyMeta);
  const [isLoading, setIsLoading] = useState(true);
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);

  useEffect(() => {
    setItems([]);
    setPage(1);
  }, [filterKey]);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    void fetchPaginated<T>(path, {
      page,
      pageSize: 10,
      ...filters,
    })
      .then((result) => {
        if (!active) return;
        setItems((current) =>
          page === 1 ? result.items : [...current, ...result.items],
        );
        setPagination(result.pagination);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filterKey, page, path, refreshSignal]);

  return {
    items,
    pagination,
    isLoading,
    hasMore: pagination.page < pagination.totalPages,
    loadMore: () => setPage((current) => current + 1),
  };
}
