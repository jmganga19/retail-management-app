import { useEffect, useState } from 'react'
import { isAxiosError } from 'axios'
import { useCategories } from '../../hooks/useCategories'
import { useCreateProduct, useUpdateProduct } from '../../hooks/useProducts'
import type { Product } from '../../types'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'

interface ProductFormProps {
  open: boolean
  onClose: () => void
  editing?: Product | null
}

export default function ProductForm({ open, onClose, editing }: ProductFormProps) {
  const { data: categories = [] } = useCategories()
  const create = useCreateProduct()
  const update = useUpdateProduct()

  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [threshold, setThreshold] = useState('5')
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      setName(editing.name)
      setCategoryId(String(editing.category_id))
      setDescription(editing.description ?? '')
      setPrice(String(editing.price))
      setImageUrl(editing.image_url ?? '')
      setThreshold(String(editing.low_stock_threshold))
    } else {
      setName('')
      setCategoryId('')
      setDescription('')
      setPrice('')
      setImageUrl('')
      setThreshold('5')
    }
    setError('')
  }, [editing, open])

  const handleSubmit = async () => {
    setError('')
    if (!name || !categoryId || !price) {
      setError('Name, category and price are required.')
      return
    }

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
      } else {
        await create.mutateAsync({
          name,
          category_id: Number(categoryId),
          description: description || undefined,
          price: Number(price),
          image_url: imageUrl || undefined,
          low_stock_threshold: Number(threshold),
        })
      }
      onClose()
    } catch (e) {
      if (isAxiosError(e) && typeof e.response?.data?.detail === 'string') {
        setError(e.response.data.detail)
      } else {
        setError('Failed to save product. Please try again.')
      }
    }
  }

  const isPending = create.isPending || update.isPending

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

      </div>
    </Modal>
  )
}
