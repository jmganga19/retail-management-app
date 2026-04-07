import { useMemo, useState } from 'react'
import { useCustomers } from '../hooks/useCustomers'
import { useOrders } from '../hooks/useOrders'
import { usePreorders } from '../hooks/usePreorders'
import { useLowStockProducts } from '../hooks/useProducts'
import { useSales } from '../hooks/useSales'
import type { OrderListItem, PreOrderListItem } from '../types'
import Input from '../components/ui/Input'
import StatCard from '../components/ui/StatCard'
import Table from '../components/ui/Table'

const todayString = () => new Date().toISOString().slice(0, 10)
const firstDayOfMonthString = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
}

const fmtCurrency = (n: string | number) =>
  Number(n).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

const fmtDate = (value: string) => new Date(value).toLocaleDateString('en-TZ')

interface PaymentRow {
  method: string
  count: number
  total: number
}

export default function ReportsPage() {
  const [dateFrom, setDateFrom] = useState(firstDayOfMonthString())
  const [dateTo, setDateTo] = useState(todayString())

  const salesQuery = useSales({ date_from: dateFrom || undefined, date_to: dateTo || undefined })
  const ordersQuery = useOrders()
  const preordersQuery = usePreorders()
  const customersQuery = useCustomers()
  const lowStockQuery = useLowStockProducts()

  const sales = salesQuery.data ?? []
  const orders = ordersQuery.data ?? []
  const preorders = preordersQuery.data ?? []
  const customers = customersQuery.data ?? []
  const lowStock = lowStockQuery.data ?? []

  const salesTotal = useMemo(() => sales.reduce((sum, row) => sum + Number(row.total), 0), [sales])
  const salesAverage = useMemo(() => (sales.length ? salesTotal / sales.length : 0), [sales, salesTotal])

  const debtOrders = useMemo(
    () => orders.filter(row => row.status === 'completed' && !row.sale_id),
    [orders],
  )
  const debtTotal = useMemo(
    () => debtOrders.reduce((sum, row) => sum + Number(row.total), 0),
    [debtOrders],
  )

  const openPreorders = useMemo(
    () => preorders.filter(row => row.status !== 'cancelled' && row.status !== 'collected'),
    [preorders],
  )
  const preorderBalanceTotal = useMemo(
    () => openPreorders.reduce((sum, row) => sum + Number(row.balance_due), 0),
    [openPreorders],
  )

  const paymentRows = useMemo<PaymentRow[]>(() => {
    const agg = new Map<string, PaymentRow>()
    sales.forEach(row => {
      const key = row.payment_method
      const current = agg.get(key) ?? { method: key, count: 0, total: 0 }
      current.count += 1
      current.total += Number(row.total)
      agg.set(key, current)
    })
    return Array.from(agg.values()).sort((a, b) => b.total - a.total)
  }, [sales])

  const debtRows = useMemo(() => debtOrders.slice(0, 8), [debtOrders])
  const preorderRows = useMemo(() => openPreorders.slice(0, 8), [openPreorders])

  const isLoading =
    salesQuery.isLoading || ordersQuery.isLoading || preordersQuery.isLoading || customersQuery.isLoading

  const paymentColumns = [
    { key: 'method', header: 'Payment Method', render: (r: PaymentRow) => r.method.replace('_', ' ') },
    { key: 'count', header: 'Sales Count', render: (r: PaymentRow) => r.count },
    { key: 'total', header: 'Total Amount', render: (r: PaymentRow) => fmtCurrency(r.total), className: 'font-semibold' },
  ]

  const debtColumns = [
    { key: 'number', header: 'Order #', render: (r: OrderListItem) => <span className="font-mono text-xs">{r.order_number}</span> },
    { key: 'date', header: 'Date', render: (r: OrderListItem) => fmtDate(r.created_at) },
    { key: 'amount', header: 'Debt Amount', render: (r: OrderListItem) => fmtCurrency(r.total), className: 'font-semibold text-red-700' },
  ]

  const preorderColumns = [
    { key: 'number', header: 'Pre-order #', render: (r: PreOrderListItem) => <span className="font-mono text-xs">{r.preorder_number}</span> },
    { key: 'status', header: 'Status', render: (r: PreOrderListItem) => r.status },
    { key: 'due', header: 'Balance Due', render: (r: PreOrderListItem) => fmtCurrency(r.balance_due), className: 'font-semibold' },
  ]

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Input type="date" label="From" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input type="date" label="To" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <p className="text-xs text-gray-500 pb-1">Sales report is filtered by this date range.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Sales Total"
          value={fmtCurrency(salesTotal)}
          subtitle={`${sales.length} sale(s) in selected range`}
          colorClass="bg-green-100 text-green-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h18v18H3V3zm4 11h10M7 9h10" />
            </svg>
          }
        />
        <StatCard
          title="Average Sale"
          value={fmtCurrency(salesAverage)}
          colorClass="bg-blue-100 text-blue-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M7 15l3-3 2 2 5-6" />
            </svg>
          }
        />
        <StatCard
          title="Outstanding Debt"
          value={fmtCurrency(debtTotal)}
          subtitle={`${debtOrders.length} completed order(s) not converted`}
          colorClass="bg-red-100 text-red-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v5m0 4h.01M4.93 19h14.14A2 2 0 0020.8 16L13.73 4a2 2 0 00-3.46 0L3.2 16A2 2 0 004.93 19z" />
            </svg>
          }
        />
        <StatCard
          title="Pre-order Balance"
          value={fmtCurrency(preorderBalanceTotal)}
          subtitle={`${openPreorders.length} open pre-order(s)`}
          colorClass="bg-yellow-100 text-yellow-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <StatCard
          title="Customers"
          value={customers.length}
          colorClass="bg-indigo-100 text-indigo-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M15 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatCard
          title="All Orders"
          value={orders.length}
          colorClass="bg-sky-100 text-sky-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            </svg>
          }
        />
        <StatCard
          title="Low Stock Products"
          value={lowStock.length}
          colorClass="bg-orange-100 text-orange-600"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          }
        />
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Sales by Payment Method</h2>
        <Table
          columns={paymentColumns}
          data={paymentRows}
          keyExtractor={r => r.method}
          loading={isLoading}
          emptyMessage="No sales data for selected period."
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Top Outstanding Debt Orders</h2>
          <Table
            columns={debtColumns}
            data={debtRows}
            keyExtractor={r => r.id}
            loading={ordersQuery.isLoading}
            emptyMessage="No outstanding debt orders."
          />
        </div>

        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Open Pre-orders Balance</h2>
          <Table
            columns={preorderColumns}
            data={preorderRows}
            keyExtractor={r => r.id}
            loading={preordersQuery.isLoading}
            emptyMessage="No open pre-orders."
          />
        </div>
      </div>

      {salesQuery.isError || ordersQuery.isError || preordersQuery.isError || customersQuery.isError ? (
        <p className="text-sm text-red-600">Some report data failed to load. Please refresh and try again.</p>
      ) : null}
    </div>
  )
}

