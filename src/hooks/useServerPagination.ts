import { useEffect, useState } from "react";

interface UseServerPaginationOptions {
  totalItems: number;
  initialPageSize?: number;
}

/**
 * Controla estado de paginação para queries server-side com `range(from, to)` +
 * `count: 'exact'`. Não busca dados — só expõe offset/range para a query
 * externa e devolve handlers compatíveis com <TablePagination>.
 *
 * Reseta para a página 1 sempre que totalItems encolhe abaixo do offset
 * atual (ex.: filtros ficam mais restritivos).
 */
export function useServerPagination({ totalItems, initialPageSize = 15 }: UseServerPaginationOptions) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Se o total cair (filtro novo) e a página atual ficar fora do range, volta pra 1.
  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const offset = (currentPage - 1) * pageSize;
  const from = offset;
  const to = offset + pageSize - 1;
  const startIndex = totalItems === 0 ? 0 : offset + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  const goToPage = (page: number) => setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  const goToNextPage = () => setCurrentPage((p) => Math.min(p + 1, totalPages));
  const goToPreviousPage = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const goToFirstPage = () => setCurrentPage(1);
  const goToLastPage = () => setCurrentPage(totalPages);
  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  };

  return {
    currentPage,
    pageSize,
    totalPages,
    totalItems,
    from,
    to,
    offset,
    startIndex,
    endIndex,
    canGoNext: currentPage < totalPages,
    canGoPrevious: currentPage > 1,
    goToPage,
    goToNextPage,
    goToPreviousPage,
    goToFirstPage,
    goToLastPage,
    setPageSize,
    resetPage: goToFirstPage,
  };
}
