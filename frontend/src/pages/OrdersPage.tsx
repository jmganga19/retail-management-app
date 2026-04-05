import { useState } from 'react'
import Button from '../components/ui/Button'
import Table from '../components/ui/Table'
import OrderStatusBadge from '../components/orders/OrderStatusBadge'
import NewOrderForm from '../components/orders/NewOrderForm'
import { useOrders, useUpdateOrderStatus } from '../hooks/useOrders'
import type { OrderListItem, OrderStatus } from '../types'

const tabs: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Cancelled', value: 'cancelled' },
]

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed', confirmed: 'processing', processing: 'completed',
}

const fmt = (n: string) =>
  Number(n).toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 })

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const { data: orders = [], isLoading } = useOrders({ status: statusFilter || undefined })
  const updateStatus = useUpdateOrderStatus()

  const columns = [
    { key: 'number', header: 'Order #', render: (o: OrderListItem) => <span className="font-mono text-xs">{o.order_number}</span> },
    { key: 'status', header: 'Status', render: (o: OrderListItem) => <OrderStatusBadge status={o.status} /> },
    { key: 'total', header: 'Total', render: (o: OrderListItem) => <span className="font-semibold">{fmt(o.total)}</span> },
    { key: 'date', header: 'Created', render: (o: OrderListItem) => new Date(o.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      render: (o: OrderListItem) => {
        const next = nextStatus[o.status as OrderStatus]
        return (
          <div className="flex gap-2">
            {next && (
              <Button
                size="sm"
                variant="secondary"
                loading={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: o.id, status: next })}
              >
                → {next}
              </Button>
            )}
            {(o.status !== 'cancelled' && o.status !== 'completed') && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => updateStatus.mutate({ id: o.id, status: 'cancelled' })}
              >
                Cancel
              </Button>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {/* Status tabs */}
        <div className="flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={[
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === t.value
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setModalOpen(true)}>+ New Order</Button>
      </div>

      <Table
        columns={columns}
        data={orders}
        keyExtractor={o => o.id}
        loading={isLoading}
        emptyMessage="No orders found."
      />

      <NewOrderForm open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  )
}
