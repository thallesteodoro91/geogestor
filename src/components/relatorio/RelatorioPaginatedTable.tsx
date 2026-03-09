import { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";

interface Column<T> {
  header: string;
  headerClassName?: string;
  render: (item: T, index: number) => ReactNode;
  cellClassName?: string;
}

interface RelatorioPaginatedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  emptyMessage: string;
  pageSize?: number;
}

export function RelatorioPaginatedTable<T>({
  data,
  columns,
  emptyMessage,
  pageSize = 5,
}: RelatorioPaginatedTableProps<T>) {
  const pagination = usePagination(data, { initialPageSize: pageSize });

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-3">{emptyMessage}</p>;
  }

  return (
    <>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => (
                <TableHead key={i} className={col.headerClassName}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((item, i) => (
              <TableRow key={i}>
                {columns.map((col, j) => (
                  <TableCell key={j} className={col.cellClassName}>
                    {col.render(item, i)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pagination.totalPages > 1 && (
        <TablePagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          pageSize={pagination.pageSize}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          canGoNext={pagination.canGoNext}
          canGoPrevious={pagination.canGoPrevious}
          onPageChange={pagination.goToPage}
          onPageSizeChange={pagination.setPageSize}
          onFirstPage={pagination.goToFirstPage}
          onLastPage={pagination.goToLastPage}
          onNextPage={pagination.goToNextPage}
          onPreviousPage={pagination.goToPreviousPage}
          pageSizeOptions={[5, 10, 20]}
        />
      )}
    </>
  );
}
