import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { useProducts } from '../hooks/useProducts'
import { useCustomers } from '../hooks/useCustomers'
import { useCreateSale } from '../hooks/useSales'
import type { Product, SaleItemCreate, Variant } from '../types'

interface CartLine {
  product: Product
  variant: Variant
  quantity: number
}

const fmt = (n: number) =>
  n.toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

export default function NewSalePage() {
  const navigate = useNavigate()
  const { data: products = [] } = useProducts({ is_active: true })
  const { data: customers = [] } = useCustomers()
  const createSale = useCreateSale()

  const [cart, setCart] = useState<CartLine[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [selectedVariantId, setSelectedVariantId] = useState('')
  const [qty, setQty] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile_money'>('cash')
  const [customerId, setCustomerId] = useState('')
  const [discount, setDiscount] = useState(0)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  const selectedProduct = products.find(p => String(p.id) === selectedProductId)
  const selectedVariant = selectedProduct?.variants.find(v => String(v.id) === selectedVariantId)

  const addToCart = () => {
    if (!selectedProduct || !selectedVariant) { setError('Select a product and variant.'); return }
    if (qty < 1) { setError('Quantity must be at least 1.'); return }
    if (selectedVariant.stock_qty < qty) { setError(`Only ${selectedVariant.stock_qty} in stock.`); return }
    setCart(prev => {
      const existing = prev.find(l => l.variant.id === selectedVariant.id)
      if (existing) return prev.map(l => l.variant.id === selectedVariant.id ? { ...l, quantity: l.quantity + qty } : l)
      return [...prev, { product: selectedProduct, variant: selectedVariant, quantity: qty }]
    })
    setSelectedProductId(''); setSelectedVariantId(''); setQty(1); setError('')
  }

  const subtotal = cart.reduce((s, l) => s + Number(l.product.price) * l.quantity, 0)
  const total = subtotal - discount

  const handleSubmit = async () => {
    setError('')
    if (cart.length === 0) { setError('Cart is empty.'); return }
    const items: SaleItemCreate[] = cart.map(l => ({ variant_id: l.variant.id, quantity: l.quantity }))
    try {
      await createSale.mutateAsync({
        items,
        payment_method: paymentMethod,
        customer_id: customerId ? Number(customerId) : undefined,
        discount: discount || undefined,
        notes: notes || undefined,
      })
      navigate('/sales')
    } catch {
      setError('Failed to create sale. Check stock availability.')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
      {/* Item builder */}
      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-semibold mb-4">Add Items</h2>
          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <Select
              label="Product"
              value={selectedProductId}
              onChange={e => { setSelectedProductId(e.target.value); setSelectedVariantId('') }}
              options={products.map(p => ({ value: p.id, label: p.name }))}
              placeholder="Select product"
            />
            <Select
              label="Variant"
              value={selectedVariantId}
              onChange={e => setSelectedVariantId(e.target.value)}
              options={(selectedProduct?.variants ?? []).map(v => ({
                value: v.id,
                label: `${[v.size, v.color].filter(Boolean).join(' / ') || 'Default'} (${v.stock_qty} left)`,
              }))}
              placeholder="Select variant"
              disabled={!selectedProduct}
            />
            <div className="flex gap-2 items-end">
              <Input label="Qty" type="number" min="1" value={qty} onChange={e => setQty(Number(e.target.value))} />
              <Button onClick={addToCart} className="mb-0.5">Add</Button>
            </div>
          </div>

          {/* Cart table */}
          <div className="rounded-lg border border-gray-100 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Product</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Variant</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Unit</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500">Subtotal</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {cart.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-400">No items added yet.</td></tr>
                ) : (
                  cart.map((l, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2 font-medium">{l.product.name}</td>
                      <td className="px-4 py-2 text-gray-500">
                        {[l.variant.size, l.variant.color].filter(Boolean).join(' / ') || 'Default'}
                      </td>
                      <td className="px-4 py-2 text-right">{l.quantity}</td>
                      <td className="px-4 py-2 text-right">{fmt(Number(l.product.price))}</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmt(Number(l.product.price) * l.quantity)}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setCart(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Checkout panel */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 h-fit space-y-4">
        <h2 className="font-semibold">Checkout</h2>
        <Select
          label="Customer (optional)"
          value={customerId}
          onChange={e => setCustomerId(e.target.value)}
          options={customers.map(c => ({ value: c.id, label: `${c.name}${c.phone ? ` · ${c.phone}` : ''}` }))}
          placeholder="Walk-in"
        />
        <Select
          label="Payment Method"
          value={paymentMethod}
          onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}
          options={[
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
            { value: 'mobile_money', label: 'Mobile Money' },
          ]}
        />
        <Input
          label="Discount (TZS)"
          type="number"
          min="0"
          value={discount}
          onChange={e => setDiscount(Number(e.target.value))}
        />
        <Input label="Notes" value={notes} onChange={e => setNotes(e.target.value)} />

        <div className="border-t border-gray-100 pt-4 space-y-1 text-sm">
          <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="flex justify-between text-gray-600"><span>Discount</span><span>-{fmt(discount)}</span></div>
          <div className="flex justify-between font-bold text-base text-gray-900 pt-1">
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </div>

        <Button className="w-full" onClick={handleSubmit} loading={createSale.isPending}>
          Complete Sale
        </Button>
        <Button variant="secondary" className="w-full" onClick={() => navigate('/sales')}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

