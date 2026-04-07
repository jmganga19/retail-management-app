import { useEffect, useState } from 'react'
import { useCategories } from '../../hooks/useCategories'
import { useAddVariant, useCreateProduct, useUpdateProduct, useUpdateVariant } from '../../hooks/useProducts'
import type { Product, VariantCreate } from '../../types'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

interface ProductFormProps {
  open: boolean
  onClose: () => void
  editing?: Product | null
}

interface VariantRow {
  id?: number
  size: string
  color: string
  sku: string
  stock_qty: number
}

const emptyVariant = (): VariantRow => ({ size: '', color: '', sku: '', stock_qty: 0 })

export default function ProductForm({ open, onClose, editing }: ProductFormProps) {
  const { data: categories = [] } = useCategories()
  const create = useCreateProduct()
  const update = useUpdateProduct()
  const updateVariant = useUpdateVariant()
  const addVariant = useAddVariant()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [threshold, setThreshold] = useState('5')
  const [variants, setVariants] = useState<VariantRow[]>([emptyVariant()])
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setCategoryId(String(editing.category_id))
      setDescription(editing.description ?? '')
      setPrice(String(editing.price))
      setImageUrl(editing.image_url ?? '')
      setThreshold(String(editing.low_stock_threshold))
      setVariants(
        editing.variants.length > 0
          ? editing.variants.map(v => ({
              id: v.id,
              size: v.size ?? '',
              color: v.color ?? '',
              sku: v.sku ?? '',
              stock_qty: v.stock_qty,
            }))
          : [emptyVariant()],
      )
    } else {
      setName('')
      setCategoryId('')
      setDescription('')
      setPrice('')
      setImageUrl('')
      setThreshold('5')
      setVariants([emptyVariant()])
    }
    setError('')
  }, [editing, open])

  const handleSubmit = async () => {
    setError('')
    if (!name || !categoryId || !price) {
      setError('Name, category and price are required.')
      return
    }

    const variantPayload: VariantCreate[] = variants.map(v => ({
      size: v.size || undefined,
      color: v.color || undefined,
      sku: v.sku || undefined,
      stock_qty: Number.isFinite(Number(v.stock_qty)) ? Number(v.stock_qty) : 0,
    }))

    try {
      if (editing) {
        await update.mutateAsync({
          id: editing.id,
          data: {
            name,
            category_id: Number(categoryId),
            description: description || undefined,
            price: Number(price),
            image_url: imageUrl || undefined,
            low_stock_threshold: Number(threshold),
          },
        })

        for (let i = 0; i < variants.length; i += 1) {
          const row = variants[i]
          const payload = variantPayload[i]
          if (row.id) {
            await updateVariant.mutateAsync({
              productId: editing.id,
              variantId: row.id,
              data: payload,
            })
          } else {
            await addVariant.mutateAsync({ productId: editing.id, data: payload })
          }
        }
      } else {
        await create.mutateAsync({
          name,
          category_id: Number(categoryId),
          description: description || undefined,
          price: Number(price),
          image_url: imageUrl || undefined,
          low_stock_threshold: Number(threshold),
          variants: variantPayload,
        })
      }
      onClose()
    } catch {
      setError('Failed to save product. Please try again.')
    }
  }

  const updateVariantRow = (idx: number, field: keyof VariantRow, value: string | number) => {
    setVariants(prev => prev.map((v, i) => (i === idx ? { ...v, [field]: value } : v)))
  }

  const isPending = create.isPending || update.isPending || updateVariant.isPending || addVariant.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Product' : 'Add Product'}
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-4">
          <Input label="Product Name" value={name} onChange={e => setName(e.target.value)} className="col-span-2" />
          <Select
            label="Category"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            options={categories.map(c => ({ value: c.id, label: c.name }))}
            placeholder="Select category"
          />
          <Input label="Price (TZS)" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} />
          <Input label="Image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} className="col-span-2" />
          <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-2" />
          <Input label="Low Stock Threshold" type="number" min="0" value={threshold} onChange={e => setThreshold(e.target.value)} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Variants (size / color / stock)</p>
            <Button size="sm" variant="ghost" onClick={() => setVariants(v => [...v, emptyVariant()])}>
              + Add variant
            </Button>
          </div>
          <div className="space-y-2">
            {variants.map((v, idx) => (
              <div key={v.id ?? `new-${idx}`} className="grid grid-cols-4 gap-2 items-end">
                <Input placeholder="Size" value={v.size} onChange={e => updateVariantRow(idx, 'size', e.target.value)} />
                <Input placeholder="Color" value={v.color} onChange={e => updateVariantRow(idx, 'color', e.target.value)} />
                <Input placeholder="SKU" value={v.sku} onChange={e => updateVariantRow(idx, 'sku', e.target.value)} />
                <div className="flex gap-1">
                  <Input
                    type="number"
                    min="0"
                    placeholder="Qty"
                    value={v.stock_qty}
                    onChange={e => updateVariantRow(idx, 'stock_qty', Number(e.target.value))}
                  />
                  {variants.length > 1 && !v.id && (
                    <Button size="sm" variant="danger" onClick={() => setVariants(prev => prev.filter((_, i) => i !== idx))}>
                      x
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {editing && <p className="mt-2 text-xs text-gray-500">Edit stock quantity here to increase or reduce stock.</p>}
        </div>
      </div>
    </Modal>
  )
}
