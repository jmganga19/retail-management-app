import { useState } from 'react'
import Button from '../components/ui/Button'
import Table from '../components/ui/Table'
import PreorderStatusBadge from '../components/preorders/PreorderStatusBadge'
import NewPreorderForm from '../components/preorders/NewPreorderForm'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import { usePreorders, useUpdatePreorderStatus, useUpdateDeposit } from '../hooks/usePreorders'
import type { PreOrderListItem, PreOrderStatus } from '../types'

const tabs = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Arrived', value: 'arrived' },
  { label: 'Collected', value: 'collected' },
  { label: 'Cancelled', value: 'cancelled' },
]

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 })

const nextStatus: Partial<Record<PreOrderStatus, PreOrderStatus>> = {
  pending: 'arrived', arrived: 'collected',
}

export default function PreordersPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [depositModal, setDepositModal] = useState<{ id: number; current: number } | null>(null)
  const [depositVal, setDepositVal] = useState(0)

  const { data: preorders = [], isLoading } = usePreorders({ status: statusFilter || undefined })
  const updateStatus = useUpdatePreorderStatus()
  const updateDeposit = useUpdateDeposit()

  const openDepositModal = (p: PreOrderListItem) => {
    setDepositVal(Number(p.deposit_amount))
    setDepositModal({ id: p.id, current: Number(p.deposit_amount) })
  }

  const columns = [
    {
      key: 'number',
      header: 'Pre-order #',
      render: (p: PreOrderListItem) => <span className="font-mono text-xs">{p.preorder_number}</span>,
    },
    { key: 'status', header: 'Status', render: (p: PreOrderListItem) => <PreorderStatusBadge status={p.status} /> },
    {
      key: 'arrival',
      header: 'Expected Arrival',
      render: (p: PreOrderListItem) => p.expected_arrival_date ?? '—',
    },
    { key: 'total', header: 'Total', render: (p: PreOrderListItem) => fmt(p.total_amount) },
    {
      key: 'deposit',
      header: 'Deposit / Balance',
      render: (p: PreOrderListItem) => (
        <span>
          {fmt(p.deposit_amount)}{' '}
          <span className="text-red-500 text-xs">/ {fmt(p.balance_due)} due</span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: PreOrderListItem) => {
        const next = nextStatus[p.status as PreOrderStatus]
        return (
          <div className="flex gap-2 flex-wrap">
            {next && (
              <Button size="sm" variant="secondary" loading={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: p.id, status: next })}>
                Mark as {next}
              </Button>
            )}
            {p.status !== 'cancelled' && p.status !== 'collected' && (
              <Button size="sm" variant="ghost" onClick={() => openDepositModal(p)}>
                Update Deposit
              </Button>
            )}
            {p.status !== 'cancelled' && p.status !== 'collected' && (
              <Button size="sm" variant="danger"
                onClick={() => updateStatus.mutate({ id: p.id, status: 'cancelled' })}>
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
        <div className="flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={[
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                statusFilter === t.value ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-100',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setNewOpen(true)}>+ New Pre-order</Button>
      </div>

      <Table
        columns={columns}
        data={preorders}
        keyExtractor={p => p.id}
        loading={isLoading}
        emptyMessage="No pre-orders found."
      />

      <NewPreorderForm open={newOpen} onClose={() => setNewOpen(false)} />

      {/* Deposit update modal */}
      {depositModal && (
        <Modal
          open={!!depositModal}
          onClose={() => setDepositModal(null)}
          title="Update Deposit"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDepositModal(null)}>Cancel</Button>
              <Button
                loading={updateDeposit.isPending}
                onClick={async () => {
                  await updateDeposit.mutateAsync({ id: depositModal.id, deposit_amount: depositVal })
                  setDepositModal(null)
                }}
              >
                Save
              </Button>
            </>
          }
        >
          <Input
            label="New Deposit Amount (KES)"
            type="number"
            min="0"
            value={depositVal}
            onChange={e => setDepositVal(Number(e.target.value))}
          />
        </Modal>
      )}
    </div>
  )
}
