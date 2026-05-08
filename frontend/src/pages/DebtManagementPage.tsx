import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Table from '../components/ui/Table'
import { useOrders } from '../hooks/useOrders'
import { usePreorders } from '../hooks/usePreorders'
import type { OrderListItem, PreOrderListItem } from '../types'

const fmt = (n: string) =>
  Number(n).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

const isDebtOrder = (order: OrderListItem) => order.status === 'completed' && !order.sale_id

export default function DebtManagementPage() {
  const { data: orders = [], isLoading } = useOrders()
  const { data: preorders = [], isLoading: preordersLoading } = usePreorders()
  const debtOrders = useMemo(() => orders.filter(isDebtOrder), [orders])
  const debtPreorders = useMemo(
    () => preorders.filter(p => p.status !== 'cancelled' && Number(p.balance_due) > 0),
    [preorders],
  )

  const orderDebtTotal = useMemo(
    () => debtOrders.reduce((sum, order) => sum + Number(order.total || 0), 0),
    [debtOrders],
  )
  const preorderDebtTotal = useMemo(
    () => debtPreorders.reduce((sum, preorder) => sum + Number(preorder.balance_due || 0), 0),
    [debtPreorders],
  )
  const grandDebtTotal = orderDebtTotal + preorderDebtTotal

  const orderColumns = [
    { key: 'number', header: 'Order #', render: (o: OrderListItem) => <span className="font-mono text-xs">{o.order_number}</span> },
    { key: 'customer', header: 'Customer', render: (o: OrderListItem) => o.customer_name ?? '-' },
    { key: 'products', header: 'Product Name', render: (o: OrderListItem) => o.product_names },
    { key: 'total', header: 'Debt Amount', render: (o: OrderListItem) => <span className="font-semibold text-red-700">{fmt(o.total)}</span> },
    { key: 'date', header: 'Created', render: (o: OrderListItem) => new Date(o.created_at).toLocaleDateString() },
  ]
  const preorderColumns = [
    { key: 'number', header: 'Pre-order #', render: (p: PreOrderListItem) => <span className="font-mono text-xs">{p.preorder_number}</span> },
    { key: 'customer', header: 'Customer', render: (p: PreOrderListItem) => p.customer_name ?? '-' },
    { key: 'products', header: 'Product Name', render: (p: PreOrderListItem) => p.product_names },
    { key: 'total', header: 'Total', render: (p: PreOrderListItem) => fmt(p.total_amount) },
    { key: 'paid', header: 'Paid (Deposit)', render: (p: PreOrderListItem) => fmt(p.deposit_amount) },
    { key: 'balance', header: 'Balance Due', render: (p: PreOrderListItem) => <span className="font-semibold text-red-700">{fmt(p.balance_due)}</span> },
    { key: 'status', header: 'Status', render: (p: PreOrderListItem) => p.status },
    {
      key: 'actions',
      header: '',
      render: (p: PreOrderListItem) => (
        <Link to={`/preorders?focus=${p.id}`}>
          <Button size="sm" variant="secondary">Pay/Update</Button>
        </Link>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
        <p className="text-sm text-red-800 font-medium">Total Debt Records: {debtOrders.length + debtPreorders.length}</p>
        <p className="text-lg text-red-900 font-bold">Outstanding Debt: {fmt(String(grandDebtTotal))}</p>
        <p className="text-xs text-red-800 mt-1">Orders Debt: {fmt(String(orderDebtTotal))}</p>
        <p className="text-xs text-red-800">Pre-orders Debt: {fmt(String(preorderDebtTotal))}</p>
        <p className="text-xs text-red-700 mt-1">
          Debt includes completed orders not converted to sales, plus pre-orders with remaining balance due.
        </p>
      </div>

      <div className="flex justify-end">
        <Link to="/orders">
          <Button variant="secondary">Go to Orders</Button>
        </Link>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">Orders Debt</h3>
        <Table columns={orderColumns} data={debtOrders} keyExtractor={o => o.id} loading={isLoading} emptyMessage="No order debt records found." />
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-800">Pre-orders Debt</h3>
        <Table
          columns={preorderColumns}
          data={debtPreorders}
          keyExtractor={p => p.id}
          loading={preordersLoading}
          emptyMessage="No preorder debt records found."
        />
      </div>
    </div>
  )
}
