import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Select from '../ui/Select'
import Input from '../ui/Input'
import { useCustomers } from '../../hooks/useCustomers'
import { useProducts } from '../../hooks/useProducts'
import { useCreatePreorder } from '../../hooks/usePreorders'
import type { PreOrderItemCreate } from '../../types'

interface NewPreorderFormProps {
  open: boolean
  onClose: () => void
}

interface LineRow {
  productId: string
  variant_id: string
  quantity: number
  unit_price: number
}

export default function NewPreorderForm({ open, onClose }: NewPreorderFormProps) {
  const { data: customers = [] } = useCustomers()
  const { data: products = [] } = useProducts({ is_active: true })
  const createPreorder = useCreatePreorder()

  const [customerId, setCustomerId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [deposit, setDeposit] = useState(0)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([{ productId: '', variant_id: '', quantity: 1, unit_price: 0 }])
  const [error, setError] = useState('')

  const updateLine = (idx: number, field: keyof LineRow, value: string | number) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      if (field === 'productId') return { ...l, productId: String(value), variant_id: '' }
      return { ...l, [field]: value }
    }))
  }

  const total = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)

  const handleSubmit = async () => {
    setError('')
    if (!customerId) { setError('Customer is required.'); return }
    if (deposit > total) { setError('Deposit cannot exceed total.'); return }
    const items: PreOrderItemCreate[] = lines.map(l => ({
      variant_id: Number(l.variant_id),
      quantity: l.quantity,
      unit_price: l.unit_price,
    }))
    if (items.some(i => !i.variant_id || i.quantity < 1 || i.unit_price <= 0)) {
      setError('Fill all item fields correctly.'); return
    }
    try {
      await createPreorder.mutateAsync({
        customer_id: Number(customerId),
        expected_arrival_date: expectedDate || undefined,
        deposit_amount: deposit || undefined,
        notes: notes || undefined,
        items,
      })
      setCustomerId(''); setExpectedDate(''); setDeposit(0); setNotes('')
      setLines([{ productId: '', variant_id: '', quantity: 1, unit_price: 0 }])
      onClose()
    } catch {
      setError('Failed to create pre-order.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Pre-order"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={createPreorder.isPending}>Create Pre-order</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Customer"
            value={customerId}
            onChange={e => setCustomerId(e.target.value)}
            options={customers.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Select customer"
          />
          <Input
            label="Expected Arrival Date"
            type="date"
            value={expectedDate}
            onChange={e => setExpectedDate(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Items</p>
            <Button size="sm" variant="ghost" onClick={() => setLines(p => [...p, { productId: '', variant_id: '', quantity: 1, unit_price: 0 }])}>
              + Add item
            </Button>
          </div>
          {lines.map((l, idx) => {
            const prod = products.find(p => String(p.id) === l.productId)
            return (
              <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                <Select
                  placeholder="Product"
                  value={l.productId}
                  onChange={e => {
                    updateLine(idx, 'productId', e.target.value)
                    const p = products.find(p => String(p.id) === e.target.value)
                    if (p) updateLine(idx, 'unit_price', Number(p.price))
                  }}
                  options={products.map(p => ({ value: p.id, label: p.name }))}
                />
                <Select
                  placeholder="Variant"
                  value={l.variant_id}
                  onChange={e => updateLine(idx, 'variant_id', e.target.value)}
                  options={(prod?.variants ?? []).map(v => ({
                    value: v.id,
                    label: [v.size, v.color].filter(Boolean).join(' / ') || 'Default',
                  }))}
                  disabled={!prod}
                />
                <Input type="number" min="1" placeholder="Qty" value={l.quantity}
                  onChange={e => updateLine(idx, 'quantity', Number(e.target.value))} />
                <div className="flex gap-1">
                  <Input type="number" min="0" step="0.01" placeholder="Price" value={l.unit_price}
                    onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))} />
                  {lines.length > 1 && (
                    <Button size="sm" variant="danger" onClick={() => setLines(p => p.filter((_, i) => i !== idx))}>×</Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`Deposit (KES) — Total: ${total.toLocaleString('en-KE', { style: 'currency', currency: 'KES' })}`}
            type="number"
            min="0"
            max={total}
            value={deposit}
            onChange={e => setDeposit(Number(e.target.value))}
          />
          <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
