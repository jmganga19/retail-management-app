import { useState } from 'react'
import Button from '../components/ui/Button'
import SearchBar from '../components/ui/SearchBar'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import Badge from '../components/ui/Badge'
import ProductForm from '../components/products/ProductForm'
import { useCategories } from '../hooks/useCategories'
import { useDeleteProduct, useProducts } from '../hooks/useProducts'
import type { Product } from '../types'

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 })

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const { data: categories = [] } = useCategories()
  const { data: products = [], isLoading } = useProducts({
    name: search || undefined,
    category_id: categoryId ? Number(categoryId) : undefined,
    is_active: true,
  })
  const deleteProduct = useDeleteProduct()

  const totalStock = (p: Product) => p.variants.reduce((s, v) => s + v.stock_qty, 0)
  const isLow = (p: Product) => p.variants.some(v => v.stock_qty <= p.low_stock_threshold)

  const columns = [
    {
      key: 'name',
      header: 'Product',
      render: (p: Product) => (
        <div>
          <p className="font-medium">{p.name}</p>
          {p.description && <p className="text-xs text-gray-400 truncate max-w-xs">{p.description}</p>}
        </div>
      ),
    },
    { key: 'price', header: 'Price', render: (p: Product) => fmt(p.price) },
    {
      key: 'stock',
      header: 'Stock',
      render: (p: Product) => (
        <span className={isLow(p) ? 'text-red-600 font-semibold' : ''}>
          {totalStock(p)} units
          {isLow(p) && (
            <Badge label="Low" color="red" />
          )}
        </span>
      ),
    },
    {
      key: 'variants',
      header: 'Variants',
      render: (p: Product) => (
        <div className="flex flex-wrap gap-1">
          {p.variants.map(v => (
            <span key={v.id} className="text-xs bg-gray-100 rounded px-1.5 py-0.5">
              {[v.size, v.color].filter(Boolean).join(' / ') || 'Default'} ({v.stock_qty})
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (p: Product) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => { setEditing(p); setModalOpen(true) }}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (confirm('Archive this product?')) await deleteProduct.mutateAsync(p.id)
            }}
          >
            Archive
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-1 min-w-0">
          <SearchBar
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onClear={() => setSearch('')}
            className="max-w-xs"
          />
          <Select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            options={categories.map(c => ({ value: c.id, label: c.name }))}
            placeholder="All categories"
            className="max-w-[180px]"
          />
        </div>
        <Button
          onClick={() => { setEditing(null); setModalOpen(true) }}
        >
          + Add Product
        </Button>
      </div>

      <Table
        columns={columns}
        data={products}
        keyExtractor={p => p.id}
        loading={isLoading}
        emptyMessage="No products found."
      />

      <ProductForm
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null) }}
        editing={editing}
      />
    </div>
  )
}
