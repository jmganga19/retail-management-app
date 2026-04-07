interface PaginationProps {
  currentPage: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, pageSize, totalItems, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  if (totalItems <= pageSize) return null

  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-gray-500">
        Showing {startItem}-{endItem} of {totalItems}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-sm text-gray-700">
          Page {currentPage} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}
