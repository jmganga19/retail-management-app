import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { AuditLogEntry } from '../api/users'
import Input from '../components/ui/Input'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import { useAuditLogs } from '../hooks/useUsers'

const PAGE_SIZE = 15

const actionOptions = [
  { value: 'stock_deduct_sale', label: 'Sale Deduction' },
  { value: 'stock_restore_void_sale', label: 'Void Restore' },
  { value: 'stock_deduct_order_conversion', label: 'Order Conversion Deduction' },
  { value: 'stock_adjust_manual', label: 'Manual Adjustment' },
]

const toDateTime = (d: string) => new Date(d).toLocaleString('en-TZ')

export default function StockAuditPage() {
  const { user } = useAuth()
  const [actionFilter, setActionFilter] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const { data: logs = [], isLoading } = useAuditLogs({
    target_type: 'product_variant',
    action: actionFilter || undefined,
    limit: 200,
  })

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs
    const needle = search.trim().toLowerCase()
    return logs.filter(log =>
      (log.actor_username || '').toLowerCase().includes(needle) ||
      (log.description || '').toLowerCase().includes(needle) ||
      log.action.toLowerCase().includes(needle),
    )
  }, [logs, search])

  useEffect(() => {
    setCurrentPage(1)
  }, [actionFilter, search])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedLogs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return filteredLogs.slice(start, start + PAGE_SIZE)
  }, [filteredLogs, currentPage])

  if (!user) return null
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />

  const columns = [
    { key: 'when', header: 'When', render: (r: AuditLogEntry) => toDateTime(r.created_at) },
    { key: 'actor', header: 'Actor', render: (r: AuditLogEntry) => r.actor_username ?? 'System' },
    { key: 'action', header: 'Action', render: (r: AuditLogEntry) => r.action },
    { key: 'variant', header: 'Variant ID', render: (r: AuditLogEntry) => r.target_id ?? '-' },
    { key: 'detail', header: 'Details', render: (r: AuditLogEntry) => r.description ?? '-' },
  ]

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-100 rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <Select
          label="Action"
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          options={actionOptions}
          placeholder="All stock actions"
        />
        <Input
          label="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Actor or details"
        />
      </div>

      <Table
        columns={columns}
        data={pagedLogs}
        keyExtractor={r => r.id}
        loading={isLoading}
        emptyMessage="No stock audit entries found."
      />
      <Pagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={filteredLogs.length} onPageChange={setCurrentPage} />
    </div>
  )
}
