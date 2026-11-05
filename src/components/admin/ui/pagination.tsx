"use client";

import {
  Pagination as BoardPagination,
  type PaginationProps,
} from "../boardui/pagination";

export function DialogPagination(props: PaginationProps) {
  return (
    <div data-ui="dialog-pagination" className="mt-4">
      <BoardPagination previousLabel="Předchozí" nextLabel="Další" {...props} />
    </div>
  );
}
