import { LoaderCircle, Inbox } from 'lucide-react'

/**
 * Generic table: columns = [{ key, header, render?(row) }], data = rows.
 * Handles loading/empty states itself so pages don't repeat that logic.
 * Wrapped in overflow-x-auto so wide tables scroll horizontally inside
 * their own card instead of pushing the whole page wider on mobile.
 */
export default function DataTable({ columns, data, loading, emptyMessage = 'No records found.' }) {
  return (
    <div className="overflow-hidden rounded-[20px] border border-line/90 bg-surface shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line/90 bg-gradient-to-r from-[#F5F8F6] via-[#F8FAF8] to-[#F5F8F6]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-5 py-3.5 text-[11px] font-extrabold uppercase tracking-wider text-[#557367]"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/70">
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-muted">
                  <LoaderCircle size={24} className="mx-auto animate-spin text-primary" />
                  <p className="mt-2 text-xs font-semibold text-muted">Loading records…</p>
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-muted">
                  <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl bg-sage-50 text-muted/70">
                    <Inbox size={24} />
                  </div>
                  <p className="text-xs font-bold text-ink/80">{emptyMessage}</p>
                </td>
              </tr>
            )}
            {!loading &&
              data.map((row) => (
                <tr
                  key={row._id || row.id}
                  className="transition-colors duration-150 hover:bg-[#F4F8F5]/80 group"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="whitespace-nowrap px-5 py-3.5 text-xs text-ink font-medium"
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

