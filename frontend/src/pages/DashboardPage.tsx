import StatCard from '../components/ui/StatCard'
import Table from '../components/ui/Table'
import { useDashboard } from '../hooks/useDashboard'
import type { RecentTransaction } from '../types'

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-US', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 })

const fmtDate = (d: string) => new Date(d).toLocaleString()

export default function DashboardPage() {
  const { data, isLoading } = useDashboard()

  const recentColumns = [
    { key: 'sale_number', header: 'Sale #', render: (r: RecentTransaction) => r.sale_number },
    { key: 'customer', header: 'Customer', render: (r: RecentTransaction) => r.customer_name ?? 'Walk-in' },
    { key: 'method', header: 'Payment', render: (r: RecentTransaction) => r.payment_method },
    { key: 'total', header: 'Total', render: (r: RecentTransaction) => fmt(r.total), className: 'font-semibold' },
    { key: 'date', header: 'Date', render: (r: RecentTransaction) => fmtDate(r.sold_at) },
  ]

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={data ? fmt(data.today_sales_total) : '—'}
          subtitle={data ? `${data.today_sales_count} transaction(s)` : undefined}
          colorClass="bg-green-100 text-green-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0-6C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
            </svg>
          }
        />
        <StatCard
          title="Total Orders"
          value={data?.total_orders_count ?? '—'}
          colorClass="bg-blue-100 text-blue-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />
        <StatCard
          title="Pending Pre-orders"
          value={data?.pending_preorders_count ?? '—'}
          colorClass="bg-yellow-100 text-yellow-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          title="Low Stock Items"
          value={data?.low_stock_count ?? '—'}
          colorClass="bg-red-100 text-red-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          }
        />
      </div>

      {/* Recent Transactions */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Transactions</h2>
        <Table
          columns={recentColumns}
          data={data?.recent_transactions ?? []}
          keyExtractor={r => r.id}
          loading={isLoading}
          emptyMessage="No transactions yet today."
        />
      </div>
    </div>
  )
}
