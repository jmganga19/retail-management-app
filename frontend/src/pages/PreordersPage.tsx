import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { createPreorder, getPreorder } from '../api/preorders'
import { useAuth } from '../auth/AuthContext'
import NewPreorderForm from '../components/preorders/NewPreorderForm'
import PreorderStatusBadge from '../components/preorders/PreorderStatusBadge'
import Button from '../components/ui/Button'
import ImportCsvButton, { type ImportOutcome } from '../components/ui/ImportCsvButton'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Table from '../components/ui/Table'
import TemplateButton from '../components/ui/TemplateButton'
import { usePreorders, useUpdateDeposit, useUpdatePreorderStatus } from '../hooks/usePreorders'
import { useSettings } from '../hooks/useSettings'
import type { PreOrderListItem, PreOrderStatus } from '../types'
import { parseNumericLike, parsePositiveIntLike, trimToUndefined } from '../utils/importParsers'
import { printPreorderInvoice } from '../utils/print'

const PAGE_SIZE = 10

const tabs = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Arrived', value: 'arrived' },
  { label: 'Collected', value: 'collected' },
  { label: 'Cancelled', value: 'cancelled' },
]

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

const nextStatus: Partial<Record<PreOrderStatus, PreOrderStatus>> = {
  pending: 'arrived',
  arrived: 'collected',
}

export default function PreordersPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [newOpen, setNewOpen] = useState(false)
  const [depositModal, setDepositModal] = useState<{ id: number; current: number } | null>(null)
  const [depositVal, setDepositVal] = useState(0)
  const [printingId, setPrintingId] = useState<number | null>(null)

  const canManagePreorders = user?.role === 'admin' || user?.role === 'manager'
  const { data: settings } = useSettings()

  const { data: preorders = [], isLoading } = usePreorders({ status: statusFilter || undefined, q: search.trim() || undefined })
  const updateStatus = useUpdatePreorderStatus()
  const updateDeposit = useUpdateDeposit()

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, search])

  const totalPages = Math.max(1, Math.ceil(preorders.length / PAGE_SIZE))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedPreorders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return preorders.slice(start, start + PAGE_SIZE)
  }, [preorders, currentPage])

  const handleImport = async (rows: Record<string, string>[]): Promise<ImportOutcome> => {
    const groups = new Map<string, Record<string, string>[]>()
    const errors: string[] = []
    let created = 0

    rows.forEach((row, idx) => {
      const ref = row.preorder_ref?.trim()
      if (!ref) {
        errors.push(`Row ${idx + 2}: preorder_ref is required`)
        return
      }
      const current = groups.get(ref) ?? []
      current.push(row)
      groups.set(ref, current)
    })

    for (const [ref, list] of groups) {
      try {
        const first = list[0]
        const customerId = parsePositiveIntLike(first.customer_id)
        if (Number.isNaN(customerId)) throw new Error(`preorder_ref ${ref}: invalid customer_id`)

        const items = list.map((row, idx) => {
          const variantId = parsePositiveIntLike(row.variant_id)
          const quantity = parsePositiveIntLike(row.quantity)
          const unitPrice = parseNumericLike(row.unit_price_tzs)
          if (Number.isNaN(variantId) || Number.isNaN(quantity) || Number.isNaN(unitPrice) || unitPrice <= 0) {
            throw new Error(`preorder_ref ${ref}: invalid item fields at line ${idx + 1}`)
          }
          return { variant_id: variantId, quantity, unit_price: unitPrice }
        })

        const depositAmount = parseNumericLike(first.deposit_amount_tzs)

        await createPreorder({
          customer_id: customerId,
          expected_arrival_date: trimToUndefined(first.expected_arrival_date_yyyy_mm_dd),
          deposit_amount: Number.isNaN(depositAmount) ? undefined : depositAmount,
          notes: trimToUndefined(first.notes),
          items,
        })
        created += 1
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `Failed importing ${ref}`)
      }
    }

    await qc.invalidateQueries({ queryKey: ['preorders'] })
    return { created, failed: errors.length, errors }
  }

  const openDepositModal = (p: PreOrderListItem) => {
    setDepositVal(Number(p.deposit_amount))
    setDepositModal({ id: p.id, current: Number(p.deposit_amount) })
  }

  const handlePrint = async (preorderId: number) => {
    try {
      setPrintingId(preorderId)
      const preorder = await getPreorder(preorderId)
      const preorderRow = preorders.find(p => p.id === preorderId)
      printPreorderInvoice(preorder, { appName: settings?.app_name, customerName: preorderRow?.customer_name })
    } finally {
      setPrintingId(null)
    }
  }

  const columns = [
    {
      key: 'number',
      header: 'Pre-order #',
      render: (p: PreOrderListItem) => <span className="font-mono text-xs">{p.preorder_number}</span>,
    },
    { key: 'customer', header: 'Customer', render: (p: PreOrderListItem) => p.customer_name ?? '-' },
    { key: 'products', header: 'Product Name', render: (p: PreOrderListItem) => p.product_names },
    { key: 'status', header: 'Status', render: (p: PreOrderListItem) => <PreorderStatusBadge status={p.status} /> },
    {
      key: 'arrival',
      header: 'Expected Arrival',
      render: (p: PreOrderListItem) => p.expected_arrival_date ?? '-',
    },
    { key: 'total', header: 'Total', render: (p: PreOrderListItem) => fmt(p.total_amount) },
    {
      key: 'deposit',
      header: 'Deposit / Balance',
      render: (p: PreOrderListItem) => (
        <span>
          {fmt(p.deposit_amount)} <span className="text-red-500 text-xs">/ {fmt(p.balance_due)} due</span>
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
            <Button size="sm" variant="secondary" loading={printingId === p.id} onClick={() => handlePrint(p.id)}>
              Print
            </Button>
            {canManagePreorders && next && (
              <Button
                size="sm"
                variant="secondary"
                loading={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: p.id, status: next })}
              >
                Mark as {next}
              </Button>
            )}
            {canManagePreorders && p.status !== 'cancelled' && p.status !== 'collected' && (
              <Button size="sm" variant="ghost" onClick={() => openDepositModal(p)}>
                Update Deposit
              </Button>
            )}
            {canManagePreorders && p.status !== 'cancelled' && p.status !== 'collected' && (
              <Button size="sm" variant="danger" onClick={() => updateStatus.mutate({ id: p.id, status: 'cancelled' })}>
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
      <div className="flex items-center justify-between gap-3 flex-wrap">
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
        <Input
          label="Search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Pre-order #, customer, product"
        />
        <div className="flex items-center gap-2">
          <TemplateButton template="preorders" />
          <ImportCsvButton template="preorders" onImport={handleImport} />
          <Button onClick={() => setNewOpen(true)}>+ New Pre-order</Button>
        </div>
      </div>

      <Table columns={columns} data={pagedPreorders} keyExtractor={p => p.id} loading={isLoading} emptyMessage="No pre-orders found." />
      <Pagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={preorders.length} onPageChange={setCurrentPage} />

      <NewPreorderForm open={newOpen} onClose={() => setNewOpen(false)} />

      {depositModal && (
        <Modal
          open={!!depositModal}
          onClose={() => setDepositModal(null)}
          title="Update Deposit"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDepositModal(null)}>
                Cancel
              </Button>
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
            label="New Deposit Amount (TZS)"
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


