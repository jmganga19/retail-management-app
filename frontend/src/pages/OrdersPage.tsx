import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { createOrder, getOrder } from '../api/orders'
import NewOrderForm from '../components/orders/NewOrderForm'
import OrderStatusBadge from '../components/orders/OrderStatusBadge'
import Button from '../components/ui/Button'
import ImportCsvButton, { type ImportOutcome } from '../components/ui/ImportCsvButton'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import TemplateButton from '../components/ui/TemplateButton'
import { useConvertOrderToSale, useOrders, useUpdateOrderStatus } from '../hooks/useOrders'
import type { OrderListItem, OrderStatus } from '../types'
import { parseNumericLike, parsePositiveIntLike, trimToUndefined } from '../utils/importParsers'
import { printOrderInvoice } from '../utils/print'

const PAGE_SIZE = 10

const tabs: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Processing', value: 'processing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Debt', value: 'debt' },
  { label: 'Cancelled', value: 'cancelled' },
]

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed',
  confirmed: 'processing',
  processing: 'completed',
}

const fmt = (n: string) =>
  Number(n).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

const isDebtOrder = (order: OrderListItem) => order.status === 'completed' && !order.sale_id

export default function OrdersPage() {
  const qc = useQueryClient()
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [printingId, setPrintingId] = useState<number | null>(null)
  const [convertTarget, setConvertTarget] = useState<OrderListItem | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_money'>('cash')
  const [convertNotes, setConvertNotes] = useState('')
  const [convertError, setConvertError] = useState('')

  const apiStatus = statusFilter && statusFilter !== 'debt' ? statusFilter : undefined
  const { data: orders = [], isLoading } = useOrders({ status: apiStatus })
  const updateStatus = useUpdateOrderStatus()
  const convertToSale = useConvertOrderToSale()

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter])

  const visibleOrders = useMemo(
    () => (statusFilter === 'debt' ? orders.filter(isDebtOrder) : orders),
    [orders, statusFilter],
  )

  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / PAGE_SIZE))

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedOrders = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return visibleOrders.slice(start, start + PAGE_SIZE)
  }, [visibleOrders, currentPage])

  const handleImport = async (rows: Record<string, string>[]): Promise<ImportOutcome> => {
    const groups = new Map<string, Record<string, string>[]>()
    const errors: string[] = []
    let created = 0

    rows.forEach((row, idx) => {
      const ref = row.order_ref?.trim()
      if (!ref) {
        errors.push(`Row ${idx + 2}: order_ref is required`)
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
        if (Number.isNaN(customerId)) throw new Error(`order_ref ${ref}: invalid customer_id`)

        const items = list.map((row, idx) => {
          const variantId = parsePositiveIntLike(row.variant_id)
          const quantity = parsePositiveIntLike(row.quantity)
          const unitPrice = parseNumericLike(row.unit_price_tzs)
          if (Number.isNaN(variantId) || Number.isNaN(quantity) || Number.isNaN(unitPrice) || unitPrice <= 0) {
            throw new Error(`order_ref ${ref}: invalid item fields at line ${idx + 1}`)
          }
          return { variant_id: variantId, quantity, unit_price: unitPrice }
        })

        const discount = parseNumericLike(first.discount_tzs)

        await createOrder({
          customer_id: customerId,
          discount: Number.isNaN(discount) ? undefined : discount,
          notes: trimToUndefined(first.notes),
          items,
        })
        created += 1
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `Failed importing ${ref}`)
      }
    }

    await qc.invalidateQueries({ queryKey: ['orders'] })
    return { created, failed: errors.length, errors }
  }

  const handlePrint = async (orderId: number) => {
    try {
      setPrintingId(orderId)
      const order = await getOrder(orderId)
      printOrderInvoice(order)
    } finally {
      setPrintingId(null)
    }
  }

  const openConvertModal = (order: OrderListItem) => {
    setConvertTarget(order)
    setPaymentMethod('cash')
    setConvertNotes('')
    setConvertError('')
  }

  const submitConvert = async () => {
    if (!convertTarget) return
    try {
      setConvertError('')
      const sale = await convertToSale.mutateAsync({
        id: convertTarget.id,
        data: {
          payment_method: paymentMethod,
          notes: convertNotes.trim() || undefined,
        },
      })
      setConvertTarget(null)
      alert(`Order ${convertTarget.order_number} converted to sale ${sale.sale_number}.`)
    } catch (e) {
      setConvertError(e instanceof Error ? e.message : 'Failed to convert order to sale')
    }
  }

  const columns = [
    { key: 'number', header: 'Order #', render: (o: OrderListItem) => <span className="font-mono text-xs">{o.order_number}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (o: OrderListItem) => (
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={o.status} />
          {isDebtOrder(o) && <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded">Debt</span>}
        </div>
      ),
    },
    {
      key: 'sale',
      header: 'Sale Link',
      render: (o: OrderListItem) => (o.sale_id ? <span className="text-green-700 text-xs font-medium">Converted</span> : '-'),
    },
    { key: 'total', header: 'Total', render: (o: OrderListItem) => <span className="font-semibold">{fmt(o.total)}</span> },
    { key: 'date', header: 'Created', render: (o: OrderListItem) => new Date(o.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      render: (o: OrderListItem) => {
        const next = nextStatus[o.status as OrderStatus]
        return (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" loading={printingId === o.id} onClick={() => handlePrint(o.id)}>
              Print
            </Button>
            {isDebtOrder(o) && (
              <Button size="sm" variant="primary" loading={convertToSale.isPending} onClick={() => openConvertModal(o)}>
                Convert to Sale
              </Button>
            )}
            {next && (
              <Button
                size="sm"
                variant="secondary"
                loading={updateStatus.isPending}
                onClick={() => updateStatus.mutate({ id: o.id, status: next })}
              >
                Next: {next}
              </Button>
            )}
            {o.status !== 'cancelled' && o.status !== 'completed' && (
              <Button size="sm" variant="danger" onClick={() => updateStatus.mutate({ id: o.id, status: 'cancelled' })}>
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
        <div className="flex items-center gap-2">
          <TemplateButton template="orders" />
          <ImportCsvButton template="orders" onImport={handleImport} />
          <Button onClick={() => setModalOpen(true)}>+ New Order</Button>
        </div>
      </div>

      <Table columns={columns} data={pagedOrders} keyExtractor={o => o.id} loading={isLoading} emptyMessage="No orders found." />
      <Pagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={visibleOrders.length} onPageChange={setCurrentPage} />

      <NewOrderForm open={modalOpen} onClose={() => setModalOpen(false)} />

      <Modal
        open={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        title={convertTarget ? `Convert ${convertTarget.order_number} to Sale` : 'Convert Order'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConvertTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitConvert} loading={convertToSale.isPending}>
              Convert
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {convertError && <p className="text-sm text-red-500">{convertError}</p>}
          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value as 'cash' | 'card' | 'mobile_money')}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'mobile_money', label: 'Mobile Money' },
            ]}
          />
          <Input
            label="Sale Notes (optional)"
            value={convertNotes}
            onChange={e => setConvertNotes(e.target.value)}
            placeholder="Optional note for the generated sale"
          />
        </div>
      </Modal>
    </div>
  )
}
