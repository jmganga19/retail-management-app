import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSale, getSale } from '../api/sales'
import { useAuth } from '../auth/AuthContext'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ImportCsvButton, { type ImportOutcome } from '../components/ui/ImportCsvButton'
import Input from '../components/ui/Input'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import TemplateButton from '../components/ui/TemplateButton'
import { useSales, useVoidSale } from '../hooks/useSales'
import { useSettings } from '../hooks/useSettings'
import type { SaleListItem } from '../types'
import { normalizePaymentMethod, parseNumericLike, parsePositiveIntLike, trimToUndefined } from '../utils/importParsers'
import { printSaleReceipt } from '../utils/print'

const PAGE_SIZE = 10

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

const paymentColor: Record<string, 'green' | 'blue' | 'purple'> = {
  cash: 'green',
  card: 'blue',
  mobile_money: 'purple',
}

export default function SalesPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [method, setMethod] = useState('')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [printingId, setPrintingId] = useState<number | null>(null)

  const canManageSales = user?.role === 'admin' || user?.role === 'manager'
  const { data: settings } = useSettings()

  const { data: sales = [], isLoading } = useSales({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    payment_method: method || undefined,
    q: search.trim() || undefined,
  })
  const voidSale = useVoidSale()

  useEffect(() => {
    setCurrentPage(1)
  }, [dateFrom, dateTo, method, search])

  const totalPages = Math.max(1, Math.ceil(sales.length / PAGE_SIZE))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedSales = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return sales.slice(start, start + PAGE_SIZE)
  }, [sales, currentPage])

  const handleImport = async (rows: Record<string, string>[]): Promise<ImportOutcome> => {
    const groups = new Map<string, Record<string, string>[]>()
    const errors: string[] = []
    let created = 0

    rows.forEach((row, idx) => {
      const ref = row.sale_ref?.trim()
      if (!ref) {
        errors.push(`Row ${idx + 2}: sale_ref is required`)
        return
      }
      const current = groups.get(ref) ?? []
      current.push(row)
      groups.set(ref, current)
    })

    for (const [ref, list] of groups) {
      try {
        const first = list[0]
        const payment = normalizePaymentMethod(first.payment_method_cash_card_mobile_money)
        const items = list.map((row, idx) => {
          const variantId = parsePositiveIntLike(row.variant_id)
          const quantity = parsePositiveIntLike(row.quantity)
          if (Number.isNaN(variantId) || Number.isNaN(quantity)) {
            throw new Error(`sale_ref ${ref}: invalid variant_id/quantity at line ${idx + 1}`)
          }
          return { variant_id: variantId, quantity }
        })

        const customerId = parsePositiveIntLike(first.customer_id_optional)
        const discount = parseNumericLike(first.discount_tzs)

        await createSale({
          customer_id: Number.isNaN(customerId) ? undefined : customerId,
          payment_method: payment,
          discount: Number.isNaN(discount) ? undefined : discount,
          notes: trimToUndefined(first.notes),
          items,
        })
        created += 1
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `Failed importing ${ref}`)
      }
    }

    await qc.invalidateQueries({ queryKey: ['sales'] })
    await qc.invalidateQueries({ queryKey: ['products'] })
    return { created, failed: errors.length, errors }
  }

  const handlePrint = async (saleId: number) => {
    try {
      setPrintingId(saleId)
      const sale = await getSale(saleId)
      const saleRow = sales.find(s => s.id === saleId)
      printSaleReceipt(sale, { appName: settings?.app_name, customerName: saleRow?.customer_name })
    } finally {
      setPrintingId(null)
    }
  }

  const columns = [
    { key: 'number', header: 'Sale #', render: (s: SaleListItem) => <span className="font-mono text-xs">{s.sale_number}</span> },
    { key: 'customer', header: 'Customer', render: (s: SaleListItem) => s.customer_name ?? 'Walk-in' },
    { key: 'products', header: 'Product Name', render: (s: SaleListItem) => s.product_names },
    { key: 'type', header: 'Type', render: (s: SaleListItem) => (s.is_historical ? <Badge label='Historical' color='gray' /> : <Badge label='Live' color='green' />) },
    {
      key: 'method',
      header: 'Payment',
      render: (s: SaleListItem) => (
        <Badge label={s.payment_method.replace('_', ' ')} color={paymentColor[s.payment_method] ?? 'gray'} />
      ),
    },
    { key: 'total', header: 'Total', render: (s: SaleListItem) => <span className="font-semibold">{fmt(s.total)}</span> },
    { key: 'date', header: 'Date', render: (s: SaleListItem) => new Date(s.sold_at).toLocaleString() },
    {
      key: 'actions',
      header: '',
      render: (s: SaleListItem) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" loading={printingId === s.id} onClick={() => handlePrint(s.id)}>
            Print
          </Button>
          {canManageSales && (
            <Button
              size="sm"
              variant="danger"
              loading={voidSale.isPending}
              onClick={async () => {
                if (confirm(`Void sale ${s.sale_number}? Stock will be restored.`)) {
                  await voidSale.mutateAsync(s.id)
                }
              }}
            >
              Void
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <Input type="date" label="From" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input type="date" label="To" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          <Input label="Search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Sale #, customer, product" />
          <Select
            label="Payment"
            value={method}
            onChange={e => setMethod(e.target.value)}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'mobile_money', label: 'Mobile Money' },
            ]}
            placeholder="All methods"
          />
        </div>
        <div className="flex items-center gap-2">
          <TemplateButton template="sales" />
          <ImportCsvButton template="sales" onImport={handleImport} />
          <Link to="/sales/new">
            <Button>+ New Sale</Button>
          </Link>
        </div>
      </div>

      <Table columns={columns} data={pagedSales} keyExtractor={s => s.id} loading={isLoading} emptyMessage="No sales found." />
      <Pagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={sales.length} onPageChange={setCurrentPage} />
    </div>
  )
}



