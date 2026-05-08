import { isAxiosError } from 'axios'
import { useState } from 'react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Select from '../ui/Select'
import Input from '../ui/Input'
import { useCategories } from '../../hooks/useCategories'
import { useCustomers } from '../../hooks/useCustomers'
import { useProducts } from '../../hooks/useProducts'
import { useCreatePreorder } from '../../hooks/usePreorders'
import type { PreOrderItemCreate } from '../../types'

interface NewPreorderFormProps {
  open: boolean
  onClose: () => void
}

type LineMode = 'existing' | 'new'

interface LineRow {
  mode: LineMode
  productId: string
  productName: string
  categoryId: string
  quantity: number
  unit_price: number
}

const emptyLine = (): LineRow => ({
  mode: 'existing',
  productId: '',
  productName: '',
  categoryId: '',
  quantity: 1,
  unit_price: 0,
})

export default function NewPreorderForm({ open, onClose }: NewPreorderFormProps) {
  const { data: customers = [] } = useCustomers()
  const { data: products = [] } = useProducts({ is_active: true })
  const { data: categories = [] } = useCategories()
  const createPreorder = useCreatePreorder()

  const [customerId, setCustomerId] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [deposit, setDeposit] = useState(0)
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<LineRow[]>([emptyLine()])
  const [error, setError] = useState('')

  const updateLine = (idx: number, patch: Partial<LineRow>) => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const total = lines.reduce((s, l) => s + l.unit_price * l.quantity, 0)

  const handleSubmit = async () => {
    setError('')
    if (!customerId) { setError('Customer is required.'); return }
    if (deposit > total) { setError('Deposit cannot exceed total.'); return }

    const items: PreOrderItemCreate[] = lines.map(l => {
      if (l.mode === 'existing') {
        return {
          product_id: Number(l.productId || 0),
          quantity: l.quantity,
          unit_price: l.unit_price,
        }
      }
      return {
        product_name: l.productName.trim(),
        category_id: Number(l.categoryId || 0),
        quantity: l.quantity,
        unit_price: l.unit_price,
      }
    })

    const invalid = items.some((item, idx) => {
      if (item.quantity < 1 || item.unit_price <= 0) return true
      if (lines[idx].mode === 'existing') return !item.product_id
      return !item.product_name || !item.category_id
    })
    if (invalid) {
      setError('Fill all item fields correctly.')
      return
    }

    try {
      await createPreorder.mutateAsync({
        customer_id: Number(customerId),
        expected_arrival_date: expectedDate || undefined,
        deposit_amount: deposit || undefined,
        notes: notes || undefined,
        items,
      })
      setCustomerId('')
      setExpectedDate('')
      setDeposit(0)
      setNotes('')
      setLines([emptyLine()])
      onClose()
    } catch (e) {
      if (isAxiosError(e) && typeof e.response?.data?.detail === 'string') {
        setError(e.response.data.detail)
      } else {
        setError('Failed to create pre-order.')
      }
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
            <Button size="sm" variant="ghost" onClick={() => setLines(p => [...p, emptyLine()])}>
              + Add item
            </Button>
          </div>
          {lines.map((l, idx) => (
            <div key={idx} className="space-y-2 rounded-lg border border-gray-100 p-2">
              <div className="grid grid-cols-4 gap-2 items-end">
                <Select
                  label="Item Type"
                  value={l.mode}
                  onChange={e => updateLine(idx, { mode: e.target.value as LineMode, productId: '', productName: '', categoryId: '' })}
                  options={[
                    { value: 'existing', label: 'Existing Product' },
                    { value: 'new', label: 'New Product' },
                  ]}
                />
                {l.mode === 'existing' ? (
                  <Select
                    label="Product"
                    value={l.productId}
                    onChange={e => {
                      updateLine(idx, { productId: e.target.value })
                      const p = products.find(p2 => String(p2.id) === e.target.value)
                      if (p) updateLine(idx, { unit_price: Number(p.price) })
                    }}
                    options={products.map(p => ({ value: p.id, label: p.name }))}
                    placeholder="Select product"
                  />
                ) : (
                  <>
                    <Input
                      label="New Product Name"
                      value={l.productName}
                      onChange={e => updateLine(idx, { productName: e.target.value })}
                      placeholder="Name to manufacture"
                    />
                    <Select
                      label="Category"
                      value={l.categoryId}
                      onChange={e => updateLine(idx, { categoryId: e.target.value })}
                      options={categories.map(c => ({ value: c.id, label: c.name }))}
                      placeholder="Select category"
                    />
                  </>
                )}
                <Input type="number" min="1" label="Qty" value={l.quantity}
                  onChange={e => updateLine(idx, { quantity: Number(e.target.value) })} />
              </div>
              <div className="grid grid-cols-3 gap-2 items-end">
                <Input type="number" min="0" step="0.01" label="Unit Price" value={l.unit_price}
                  onChange={e => updateLine(idx, { unit_price: Number(e.target.value) })} />
                <div />
                {lines.length > 1 && (
                  <div className="text-right">
                    <Button size="sm" variant="danger" onClick={() => setLines(p => p.filter((_, i) => i !== idx))}>Remove</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label={`Deposit (TZS) - Total: ${total.toLocaleString('en-TZ', { style: 'currency', currency: 'TZS' })}`}
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
