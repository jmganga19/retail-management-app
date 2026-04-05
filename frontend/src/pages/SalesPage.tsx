import { useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import Table from '../components/ui/Table'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Badge from '../components/ui/Badge'
import { useSales, useVoidSale } from '../hooks/useSales'
import type { SaleListItem } from '../types'

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 })

const paymentColor: Record<string, 'green' | 'blue' | 'purple'> = {
  cash: 'green', card: 'blue', mobile_money: 'purple',
}

export default function SalesPage() {
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [method, setMethod] = useState('')

  const { data: sales = [], isLoading } = useSales({
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
    payment_method: method || undefined,
  })
  const voidSale = useVoidSale()

  const columns = [
    { key: 'number', header: 'Sale #', render: (s: SaleListItem) => <span className="font-mono text-xs">{s.sale_number}</span> },
    {
      key: 'method',
      header: 'Payment',
      render: (s: SaleListItem) => (
        <Badge
          label={s.payment_method.replace('_', ' ')}
          color={paymentColor[s.payment_method] ?? 'gray'}
        />
      ),
    },
    { key: 'total', header: 'Total', render: (s: SaleListItem) => <span className="font-semibold">{fmt(s.total)}</span> },
    { key: 'date', header: 'Date', render: (s: SaleListItem) => new Date(s.sold_at).toLocaleString() },
    {
      key: 'actions',
      header: '',
      render: (s: SaleListItem) => (
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
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <Input type="date" label="From" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <Input type="date" label="To" value={dateTo} onChange={e => setDateTo(e.target.value)} />
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
        <Link to="/sales/new">
          <Button>+ New Sale</Button>
        </Link>
      </div>

      <Table
        columns={columns}
        data={sales}
        keyExtractor={s => s.id}
        loading={isLoading}
        emptyMessage="No sales found."
      />
    </div>
  )
}
