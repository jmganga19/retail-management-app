import { useEffect, useMemo, useState } from 'react'
import { getStockOrder } from '../api/stockOrders'
import Button from '../components/ui/Button'
import ImportCsvButton, { type ImportOutcome } from '../components/ui/ImportCsvButton'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import TemplateButton from '../components/ui/TemplateButton'
import { useCategories } from '../hooks/useCategories'
import { useProducts } from '../hooks/useProducts'
import { useCreateStockOrder, useReceiveStockOrder, useStockOrders, useUpdateStockOrder } from '../hooks/useStockOrders'
import type { Product, StockOrder, StockOrderListItem } from '../types'
import { parseNumericLike, parsePositiveIntLike, trimToUndefined } from '../utils/importParsers'

const PAGE_SIZE = 10

type RowMode = 'existing' | 'new'

interface EntryRow {
  mode: RowMode
  variant_id: number
  item_name: string
  category_id: number
  variant_size: string
  variant_color: string
  variant_sku: string
  quantity: number
  buying_price: number
  selling_price: number
}

const emptyRow = (): EntryRow => ({
  mode: 'existing',
  variant_id: 0,
  item_name: '',
  category_id: 0,
  variant_size: '',
  variant_color: '',
  variant_sku: '',
  quantity: 1,
  buying_price: 0,
  selling_price: 0,
})

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

const rowTotals = (row: EntryRow) => {
  const purchase = row.buying_price * row.quantity
  const selling = row.selling_price * row.quantity
  return { purchase, selling, profit: selling - purchase }
}

const variantDisplay = (product: Product, variant: Product['variants'][number]) => {
  const bits = [variant.sku, variant.size, variant.color].filter(Boolean)
  const suffix = bits.length ? bits.join(' / ') : 'Default'
  return `${product.name} - ${suffix}`
}

const statusTabs = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' },
]

const getErrorMessage = (error: unknown, fallback: string): string => {
  const maybe = error as { response?: { data?: { detail?: string } } }
  return maybe?.response?.data?.detail ?? fallback
}

const toEntryRows = (order: StockOrder): EntryRow[] => {
  if (!order.items.length) return [emptyRow()]
  return order.items.map(item => ({
    mode: item.variant_id ? 'existing' : 'new',
    variant_id: item.variant_id ?? 0,
    item_name: item.item_name ?? '',
    category_id: item.category_id ?? 0,
    variant_size: item.variant_size ?? '',
    variant_color: item.variant_color ?? '',
    variant_sku: item.variant_sku ?? '',
    quantity: Number(item.quantity || 0),
    buying_price: Number(item.buying_price || 0),
    selling_price: Number(item.selling_price || 0),
  }))
}

export default function StockManagementPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [open, setOpen] = useState(false)
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null)
  const [editingLoadId, setEditingLoadId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [rows, setRows] = useState<EntryRow[]>([emptyRow()])
  const [error, setError] = useState('')

  const { data: products = [] } = useProducts({ is_active: true })
  const { data: categories = [] } = useCategories()
  const { data: stockOrders = [], isLoading } = useStockOrders({ q: search.trim() || undefined, status: statusFilter || undefined })
  const createStockOrder = useCreateStockOrder()
  const updateStockOrder = useUpdateStockOrder()
  const receiveStockOrder = useReceiveStockOrder()

  const isEditing = editingOrderId !== null
  const isSaving = createStockOrder.isPending || updateStockOrder.isPending

  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(stockOrders.length / PAGE_SIZE))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const paged = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return stockOrders.slice(start, start + PAGE_SIZE)
  }, [stockOrders, currentPage])

  const variants = useMemo(
    () =>
      products.flatMap(p =>
        p.variants.map(v => ({
          id: v.id,
          sku: (v.sku || '').toLowerCase(),
          product_name: p.name,
          label: variantDisplay(p, v),
        })),
      ),
    [products],
  )

  const variantOptions = variants.map(v => ({ value: v.id, label: v.label }))
  const categoryOptions = categories.map(c => ({ value: c.id, label: c.name }))
  const variantBySku = useMemo(() => new Map(variants.filter(v => v.sku).map(v => [v.sku, v.id])), [variants])
  const variantByName = useMemo(() => {
    const m = new Map<string, number>()
    variants.forEach(v => {
      const key = v.product_name.toLowerCase()
      if (!m.has(key)) m.set(key, v.id)
    })
    return m
  }, [variants])

  const setRow = (idx: number, patch: Partial<EntryRow>) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const resetForm = () => {
    setNotes('')
    setRows([emptyRow()])
    setEditingOrderId(null)
    setError('')
  }

  const openCreateModal = () => {
    resetForm()
    setOpen(true)
  }

  const closeModal = () => {
    setOpen(false)
    setError('')
  }

  const handleEdit = async (id: number) => {
    setEditingLoadId(id)
    setError('')
    try {
      const order = await getStockOrder(id)
      if (order.status === 'received') {
        alert('Received stock orders cannot be edited.')
        return
      }
      setEditingOrderId(order.id)
      setNotes(order.notes ?? '')
      setRows(toEntryRows(order))
      setOpen(true)
    } catch (e) {
      alert(getErrorMessage(e, 'Failed to load stock order for editing.'))
    } finally {
      setEditingLoadId(null)
    }
  }

  const handleSave = async () => {
    setError('')
    const payloadItems = rows
      .filter(r => r.quantity > 0 && r.buying_price > 0 && r.selling_price > 0)
      .map(r => {
        if (r.mode === 'existing') {
          return {
            variant_id: r.variant_id || undefined,
            quantity: r.quantity,
            buying_price: r.buying_price,
            selling_price: r.selling_price,
          }
        }
        return {
          item_name: r.item_name.trim() || undefined,
          category_id: r.category_id || undefined,
          variant_size: trimToUndefined(r.variant_size),
          variant_color: trimToUndefined(r.variant_color),
          variant_sku: trimToUndefined(r.variant_sku),
          quantity: r.quantity,
          buying_price: r.buying_price,
          selling_price: r.selling_price,
        }
      })

    if (payloadItems.length === 0) {
      setError('Add at least one valid item row.')
      return
    }

    try {
      if (isEditing && editingOrderId) {
        await updateStockOrder.mutateAsync({ id: editingOrderId, data: { notes: trimToUndefined(notes), items: payloadItems } })
      } else {
        await createStockOrder.mutateAsync({ notes: trimToUndefined(notes), items: payloadItems })
      }
      closeModal()
      resetForm()
    } catch (e) {
      setError(getErrorMessage(e, isEditing ? 'Failed to update stock order.' : 'Failed to save stock order.'))
    }
  }

  const handleImport = async (dataRows: Record<string, string>[]): Promise<ImportOutcome> => {
    const groups = new Map<string, Record<string, string>[]>()
    const errors: string[] = []
    let created = 0

    dataRows.forEach((row, idx) => {
      const ref = row.stock_ref?.trim()
      if (!ref) {
        errors.push(`Row ${idx + 2}: stock_ref is required`)
        return
      }
      const current = groups.get(ref) ?? []
      current.push(row)
      groups.set(ref, current)
    })

    for (const [ref, group] of groups) {
      try {
        const first = group[0]
        const items = group.map((row, idx) => {
          const variantIdParsed = parsePositiveIntLike(row.variant_id)
          const sku = (row.variant_sku_optional || '').trim().toLowerCase()
          const itemName = (row.item_name || '').trim().toLowerCase()

          let variant_id = Number.isNaN(variantIdParsed) ? 0 : variantIdParsed
          if (!variant_id && sku) variant_id = variantBySku.get(sku) ?? 0
          if (!variant_id && itemName) variant_id = variantByName.get(itemName) ?? 0

          const quantity = parsePositiveIntLike(row.quantity)
          const buying = parseNumericLike(row.buying_price_tzs)
          const selling = parseNumericLike(row.selling_price_tzs)
          if (Number.isNaN(quantity) || quantity <= 0 || Number.isNaN(buying) || buying <= 0 || Number.isNaN(selling) || selling <= 0) {
            throw new Error(`stock_ref ${ref}: invalid quantity/buying/selling at line ${idx + 1}`)
          }

          if (variant_id) {
            return { variant_id, quantity, buying_price: buying, selling_price: selling }
          }

          const categoryId = parsePositiveIntLike(row.category_id_optional)
          if (Number.isNaN(categoryId)) {
            throw new Error(`stock_ref ${ref}: category_id_optional required for new item at line ${idx + 1}`)
          }
          if (!itemName) {
            throw new Error(`stock_ref ${ref}: item_name required for new item at line ${idx + 1}`)
          }

          return {
            item_name: row.item_name,
            category_id: categoryId,
            variant_size: trimToUndefined(row.variant_size_optional),
            variant_color: trimToUndefined(row.variant_color_optional),
            variant_sku: trimToUndefined(row.variant_sku_optional),
            quantity,
            buying_price: buying,
            selling_price: selling,
          }
        })

        await createStockOrder.mutateAsync({ notes: trimToUndefined(first.notes), items })
        created += 1
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `Failed importing ${ref}`)
      }
    }

    return { created, failed: errors.length, errors }
  }

  const columns = [
    { key: 'number', header: 'Stock Order #', render: (r: StockOrderListItem) => <span className="font-mono text-xs">{r.order_number}</span> },
    { key: 'status', header: 'Status', render: (r: StockOrderListItem) => <span className={r.status === 'received' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>{r.status}</span> },
    { key: 'items', header: 'Items', render: (r: StockOrderListItem) => r.item_summary },
    { key: 'count', header: 'Rows', render: (r: StockOrderListItem) => r.item_count },
    { key: 'purchase', header: 'Amount of Purchase', render: (r: StockOrderListItem) => fmt(r.total_purchase) },
    { key: 'selling', header: 'Amount Total Selling', render: (r: StockOrderListItem) => fmt(r.total_potential_sales) },
    { key: 'profit', header: 'Profit', render: (r: StockOrderListItem) => <span className="font-semibold text-emerald-700">{fmt(r.total_profit)}</span> },
    { key: 'date', header: 'Date', render: (r: StockOrderListItem) => new Date(r.created_at).toLocaleString() },
    {
      key: 'actions',
      header: '',
      render: (r: StockOrderListItem) => (
        <div className="flex gap-2">
          {r.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="secondary"
                loading={editingLoadId === r.id}
                onClick={() => {
                  void handleEdit(r.id)
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                loading={receiveStockOrder.isPending}
                onClick={async () => {
                  if (confirm(`Mark ${r.order_number} as received? This will update stock.`)) {
                    try {
                      const received = await receiveStockOrder.mutateAsync({ id: r.id })
                      if (received.pricing_warnings && received.pricing_warnings.length > 0) {
                        alert(`Pricing warnings:\n\n${received.pricing_warnings.join('\n')}`)
                      }
                    } catch (e) {
                      alert(getErrorMessage(e, 'Failed to receive stock order'))
                    }
                  }
                }}
              >
                Mark Received
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-wrap">
          <Input label="Search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Order # or item" />
          <Select
            label="Status"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            options={statusTabs.map(t => ({ value: t.value, label: t.label }))}
            placeholder="All"
          />
        </div>
        <div className="flex items-center gap-2">
          <TemplateButton template="stock_orders" />
          <ImportCsvButton template="stock_orders" onImport={handleImport} />
          <Button onClick={openCreateModal}>+ New Stock Order</Button>
        </div>
      </div>

      <Table columns={columns} data={paged} keyExtractor={r => r.id} loading={isLoading} emptyMessage="No stock orders found." />
      <Pagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={stockOrders.length} onPageChange={setCurrentPage} />

      <Modal
        open={open}
        onClose={closeModal}
        title={isEditing ? 'Edit Stock Order' : 'New Stock Order'}
        size="2xl"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>Cancel</Button>
            <Button onClick={handleSave} loading={isSaving}>{isEditing ? 'Update Order' : 'Save Order'}</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes" />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Items</p>
              <Button size="sm" variant="ghost" onClick={() => setRows(v => [...v, emptyRow()])}>+ Add Row</Button>
            </div>
            {rows.map((r, idx) => {
              const totals = rowTotals(r)
              return (
                <div key={idx} className="border border-gray-100 rounded-lg p-2 space-y-2">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <Select
                        label="Item Type"
                        value={r.mode}
                        onChange={e => setRow(idx, { mode: e.target.value as RowMode, variant_id: 0 })}
                        options={[
                          { value: 'existing', label: 'Existing' },
                          { value: 'new', label: 'New Product' },
                        ]}
                      />
                    </div>
                    {r.mode === 'existing' ? (
                      <div className="col-span-5">
                        <Select
                          label="Existing Variant"
                          value={r.variant_id || ''}
                          onChange={e => setRow(idx, { variant_id: Number(e.target.value) })}
                          options={variantOptions}
                          placeholder="Select item"
                        />
                      </div>
                    ) : (
                      <>
                        <div className="col-span-3">
                          <Input label="New Item Name" value={r.item_name} onChange={e => setRow(idx, { item_name: e.target.value })} />
                        </div>
                        <div className="col-span-2">
                          <Select
                            label="Category"
                            value={r.category_id || ''}
                            onChange={e => setRow(idx, { category_id: Number(e.target.value) })}
                            options={categoryOptions}
                            placeholder="Select"
                          />
                        </div>
                      </>
                    )}
                    <div className="col-span-1">
                      <Input label="Qty" type="number" min="1" value={r.quantity} onChange={e => setRow(idx, { quantity: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2">
                      <Input label="Buying" type="number" min="0" value={r.buying_price} onChange={e => setRow(idx, { buying_price: Number(e.target.value) })} />
                    </div>
                    <div className="col-span-2">
                      <Input label="Selling" type="number" min="0" value={r.selling_price} onChange={e => setRow(idx, { selling_price: Number(e.target.value) })} />
                    </div>
                  </div>

                  {r.mode === 'new' && (
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-4">
                        <Input label="Variant SKU (optional)" value={r.variant_sku} onChange={e => setRow(idx, { variant_sku: e.target.value })} />
                      </div>
                      <div className="col-span-4">
                        <Input label="Variant Size (optional)" value={r.variant_size} onChange={e => setRow(idx, { variant_size: e.target.value })} />
                      </div>
                      <div className="col-span-4">
                        <Input label="Variant Color (optional)" value={r.variant_color} onChange={e => setRow(idx, { variant_color: e.target.value })} />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <div>
                      Purchase: {fmt(totals.purchase)} | Selling: {fmt(totals.selling)} | <span className="font-semibold text-emerald-700">Profit: {fmt(totals.profit)}</span>
                    </div>
                    {rows.length > 1 && (
                      <Button size="sm" variant="danger" onClick={() => setRows(prev => prev.filter((_, i) => i !== idx))}>x</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>
    </div>
  )
}

