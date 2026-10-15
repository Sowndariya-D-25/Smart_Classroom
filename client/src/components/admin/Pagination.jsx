import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, total, onPageChange }) {
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between border-t border-line/80 px-6 py-4 text-xs bg-[#FAFDFB]/60">
      <p className="text-muted font-medium">
        Showing page <span className="font-extrabold text-ink">{page}</span> of{' '}
        <span className="font-extrabold text-ink">{totalPages}</span>{' '}
        <span className="hidden sm:inline text-muted/80">({total} total records)</span>
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="btn-secondary !px-3 !py-1.5 !text-xs disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
          <span className="hidden sm:inline">Prev</span>
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="btn-secondary !px-3 !py-1.5 !text-xs disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

