import StatCard from '../components/ui/StatCard'
import Table from '../components/ui/Table'
import { useDashboard } from '../hooks/useDashboard'
import type { RecentTransaction } from '../types'
import type { ReactNode } from 'react'
import { paymentMethodLabel } from '../utils/payment'

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

const fmtShort = (n: string | number) =>
  Number(n).toLocaleString('en-TZ', { maximumFractionDigits: 0 })

const fmtDate = (d: string) => new Date(d).toLocaleString()

const ChartCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
    <h3 className="mb-3 text-sm font-semibold text-gray-800">{title}</h3>
    {children}
  </div>
)

export default function DashboardPage() {
  const { data, isLoading } = useDashboard()

  const recentColumns = [
    { key: 'sale_number', header: 'Sale #', render: (r: RecentTransaction) => r.sale_number },
    { key: 'customer', header: 'Customer', render: (r: RecentTransaction) => r.customer_name ?? 'Walk-in' },
    { key: 'method', header: 'Payment', render: (r: RecentTransaction) => paymentMethodLabel(r.payment_method) },
    { key: 'total', header: 'Total', render: (r: RecentTransaction) => fmt(r.total), className: 'font-semibold' },
    { key: 'date', header: 'Date', render: (r: RecentTransaction) => fmtDate(r.sold_at) },
  ]

  const trend = data?.monthly_sales_trend ?? []
  const daily = data?.daily_live_sales_current_month ?? []
  const paymentMix = data?.payment_method_mix_current_month ?? []

  const trendMax = Math.max(1, ...trend.map(t => Number(t.combined_total)))
  const dailyMax = Math.max(1, ...daily.map(d => Number(d.total)))
  const mixTotal = Math.max(1, paymentMix.reduce((acc, m) => acc + Number(m.total), 0))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={data ? fmt(data.today_sales_total) : '-'}
          subtitle={data ? `${data.today_sales_count} transaction(s)` : undefined}
          colorClass="bg-green-100 text-green-600"
          icon={<span className="text-lg font-bold">T</span>}
        />
        <StatCard
          title={data ? `Month Live Sales (${data.report_month})` : 'Month Live Sales'}
          value={data ? fmt(data.month_live_sales_total) : '-'}
          subtitle={data ? `${data.month_live_sales_count} transaction(s)` : undefined}
          colorClass="bg-emerald-100 text-emerald-600"
          icon={<span className="text-lg font-bold">L</span>}
        />
        <StatCard
          title={data ? `Month Historical (${data.report_month})` : 'Month Historical'}
          value={data ? fmt(data.month_historical_sales_total) : '-'}
          subtitle={data ? `${data.month_historical_sales_count} record(s)` : undefined}
          colorClass="bg-gray-100 text-gray-600"
          icon={<span className="text-lg font-bold">H</span>}
        />
        <StatCard
          title={data ? `Month Combined (${data.report_month})` : 'Month Combined'}
          value={data ? fmt(data.month_combined_sales_total) : '-'}
          subtitle={data ? `${data.month_combined_sales_count} total record(s)` : undefined}
          colorClass="bg-indigo-100 text-indigo-600"
          icon={<span className="text-lg font-bold">C</span>}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="6-Month Sales Trend (Live vs Historical)">
          <div className="space-y-2">
            {trend.length === 0 && <p className="text-sm text-gray-500">No trend data available.</p>}
            {trend.map(row => {
              const combinedWidth = (Number(row.combined_total) / trendMax) * 100
              const liveWidth = (Number(row.live_total) / trendMax) * 100
              const histWidth = (Number(row.historical_total) / trendMax) * 100
              return (
                <div key={row.month}>
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                    <span>{row.month}</span>
                    <span>{fmtShort(row.combined_total)} TZS</span>
                  </div>
                  <div className="h-3 w-full rounded bg-gray-100 overflow-hidden">
                    <div className="h-3 bg-emerald-500" style={{ width: `${liveWidth}%` }} />
                  </div>
                  <div className="-mt-3 h-3 w-full rounded overflow-hidden">
                    <div className="h-3 bg-gray-400/80" style={{ width: `${histWidth}%` }} />
                  </div>
                  <div className="mt-1 h-1 w-full rounded bg-indigo-100 overflow-hidden">
                    <div className="h-1 bg-indigo-500" style={{ width: `${combinedWidth}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="flex gap-3 pt-1 text-xs text-gray-500">
              <span><span className="inline-block h-2 w-2 rounded bg-emerald-500 mr-1" />Live</span>
              <span><span className="inline-block h-2 w-2 rounded bg-gray-400 mr-1" />Historical</span>
              <span><span className="inline-block h-2 w-2 rounded bg-indigo-500 mr-1" />Combined</span>
            </div>
          </div>
        </ChartCard>

        <ChartCard title={data ? `Daily Live Sales (${data.report_month})` : 'Daily Live Sales'}>
          {daily.length === 0 ? (
            <p className="text-sm text-gray-500">No daily data available.</p>
          ) : (
            <div className="flex h-48 items-end gap-1 rounded bg-slate-50 p-3">
              {daily.map(d => {
                const h = Math.max(4, Math.round((Number(d.total) / dailyMax) * 100))
                return (
                  <div key={d.day} className="group relative flex-1">
                    <div className="w-full rounded-t bg-blue-500" style={{ height: `${h}%` }} />
                    <div className="mt-1 text-center text-[10px] text-gray-500">{d.day}</div>
                    <div className="absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-gray-900 px-2 py-1 text-[10px] text-white group-hover:block">
                      {fmt(Number(d.total))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title={data ? `Payment Mix (${data.report_month}, Live Sales)` : 'Payment Mix'}>
          <div className="space-y-2">
            {paymentMix.map(row => {
              const width = (Number(row.total) / mixTotal) * 100
              return (
                <div key={row.payment_method}>
                  <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                    <span className="uppercase">{paymentMethodLabel(row.payment_method)}</span>
                    <span>{fmt(row.total)} ({row.count})</span>
                  </div>
                  <div className="h-3 w-full rounded bg-gray-100">
                    <div className="h-3 rounded bg-amber-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </ChartCard>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard title="Total Orders" value={data?.total_orders_count ?? '-'} colorClass="bg-blue-100 text-blue-600" icon={<span className="text-lg font-bold">O</span>} />
          <StatCard title="Pending Pre-orders" value={data?.pending_preorders_count ?? '-'} colorClass="bg-yellow-100 text-yellow-600" icon={<span className="text-lg font-bold">P</span>} />
          <StatCard title="Low Stock Items" value={data?.low_stock_count ?? '-'} colorClass="bg-red-100 text-red-600" icon={<span className="text-lg font-bold">S</span>} />
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Recent Transactions (Live Sales)</h2>
        <Table
          columns={recentColumns}
          data={data?.recent_transactions ?? []}
          keyExtractor={r => r.id}
          loading={isLoading}
          emptyMessage="No live transactions yet."
        />
      </div>
    </div>
  )
}

