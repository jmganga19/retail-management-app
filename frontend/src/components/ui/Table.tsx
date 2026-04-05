import { ReactNode } from 'react'

interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string | number
  emptyMessage?: string
  loading?: boolean
}

export default function Table<T>({ columns, data, keyExtractor, emptyMessage = 'No records found.', loading }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 shadow-sm">
      <table className="min-w-full divide-y divide-gray-100 bg-white">
        <thead className="bg-gray-50">
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide ${col.className ?? ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-gray-400 text-sm">
                Loading...
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-gray-400 text-sm">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map(row => (
              <tr key={keyExtractor(row)} className="hover:bg-gray-50 transition-colors">
                {columns.map(col => (
                  <td key={col.key} className={`px-4 py-3 text-sm text-gray-800 ${col.className ?? ''}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
