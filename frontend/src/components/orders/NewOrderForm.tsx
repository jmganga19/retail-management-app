import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Select from '../ui/Select'
import Input from '../ui/Input'
import { useCustomers } from '../../hooks/useCustomers'
import { useProducts } from '../../hooks/useProducts'
import { useCreateOrder } from '../../hooks/useOrders'
import type { OrderItemCreate } from '../../types'

interface NewOrderFormProps {
  open: boolean
  onClose: () => void
}

interface LineRow {
  variant_id: string
  quantity: number
  unit_price: number
  productId: string
}

export default function NewOrderForm({ open, onClose }: NewOrderFormProps) {
  const { data: customers = [] } = useCustomers()
  const { data: products = [] } = useProducts({ is_active: true })
  const createOrder = useCreateOrder()

  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([{ variant_id: '', quantity: 1, unit_price: 0, productId: '' }])
  const [error, setError] = useState('')

  const updateLine = (idx: number, field: keyof LineRow, value: string | number) => {
    setLines(prev => prev.map((l, i) => {
      if (i !== idx) return l
      if (field === 'productId') return { ...l, productId: String(value), variant_id: '' }
      return { ...l, [field]: value }
    }))
  }

  const handleSubmit = async () => {
    setError('')
    if (!customerId) { setError('Customer is required.'); return }
    const items: OrderItemCreate[] = lines.map(l => ({
      variant_id: Number(l.variant_id),
      quantity: l.quantity,
      unit_price: l.unit_price,
    }))
    if (items.some(i => !i.variant_id || i.quantity < 1 || i.unit_price <= 0)) {
      setError('Fill all item fields correctly.'); return
    }
    try {
      await createOrder.mutateAsync({ customer_id: Number(customerId), items, discount, notes: notes || undefined })
      setCustomerId(''); setDiscount(0); setNotes(''); setLines([{ variant_id: '', quantity: 1, unit_price: 0, productId: '' }])
      onClose()
    } catch {
      setError('Failed to create order.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Order"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} loading={createOrder.isPending}>Create Order</Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <Select
          label="Customer"
          value={customerId}
          onChange={e => setCustomerId(e.target.value)}
          options={customers.map(c => ({ value: c.id, label: c.name }))}
          placeholder="Select customer"
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Items</p>
            <Button size="sm" variant="ghost" onClick={() => setLines(p => [...p, { variant_id: '', quantity: 1, unit_price: 0, productId: '' }])}>
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
                  onChange={e => updateLine(idx, 'productId', e.target.value)}
                  options={products.map(p => ({ value: p.id, label: p.name }))}
                />
                <Select
                  placeholder="Variant"
                  value={l.variant_id}
                  onChange={e => {
                    updateLine(idx, 'variant_id', e.target.value)
                    const v = prod?.variants.find(v => String(v.id) === e.target.value)
                    if (v && prod) updateLine(idx, 'unit_price', Number(prod.price))
                  }}
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
          <Input label="Discount (KES)" type="number" min="0" value={discount} onChange={e => setDiscount(Number(e.target.value))} />
          <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
