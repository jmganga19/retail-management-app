import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { createProduct } from '../api/products'
import ProductForm from '../components/products/ProductForm'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ImportCsvButton, { type ImportOutcome } from '../components/ui/ImportCsvButton'
import Pagination from '../components/ui/Pagination'
import SearchBar from '../components/ui/SearchBar'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import TemplateButton from '../components/ui/TemplateButton'
import { useCategories } from '../hooks/useCategories'
import { useDeleteProduct, useProducts, useUpdateProduct } from '../hooks/useProducts'
import type { Product } from '../types'

const PAGE_SIZE = 10

const fmt = (n: string | number) =>
  Number(n).toLocaleString('en-TZ', { style: 'currency', currency: 'TZS', minimumFractionDigits: 2 })

const parseNumeric = (value: string, fallback = 0): number => {
  if (!value) return fallback
  const cleaned = value.replace(/,/g, '').trim()
  const parsed = Number(cleaned)
  return Number.isNaN(parsed) ? fallback : parsed
}

interface ProductImportGroup {
  name: string
  category_name: string
  description?: string
  price_tzs: string
  image_url?: string
  low_stock_threshold?: string
  variants: Array<{ variant_size?: string; variant_color?: string; variant_sku?: string; variant_stock_qty?: string }>
}

export default function ProductsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [currentPage, setCurrentPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const { data: categories = [] } = useCategories()
  const { data: products = [], isLoading } = useProducts({
    name: search || undefined,
    category_id: categoryId ? Number(categoryId) : undefined,
    is_active: statusFilter === 'all' ? undefined : statusFilter === 'active',
  })
  const deleteProduct = useDeleteProduct()
  const updateProduct = useUpdateProduct()

  useEffect(() => {
    setCurrentPage(1)
  }, [search, categoryId, statusFilter])

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedProducts = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return products.slice(start, start + PAGE_SIZE)
  }, [products, currentPage])

  const handleImport = async (rows: Record<string, string>[]): Promise<ImportOutcome> => {
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]))
    const grouped = new Map<string, ProductImportGroup>()
    const errors: string[] = []
    let created = 0

    rows.forEach((row, idx) => {
      const name = row.name?.trim()
      const categoryName = row.category_name?.trim()
      const price = row.price_tzs?.trim()

      if (!name || !categoryName || !price) {
        errors.push(`Row ${idx + 2}: name, category_name, and price_tzs are required`)
        return
      }

      const key = `${name.toLowerCase()}|${categoryName.toLowerCase()}`
      const item = grouped.get(key) ?? {
        name,
        category_name: categoryName,
        description: row.description || undefined,
        price_tzs: price,
        image_url: row.image_url || undefined,
        low_stock_threshold: row.low_stock_threshold || undefined,
        variants: [],
      }

      item.variants.push({
        variant_size: row.variant_size || undefined,
        variant_color: row.variant_color || undefined,
        variant_sku: row.variant_sku || undefined,
        variant_stock_qty: row.variant_stock_qty || undefined,
      })
      grouped.set(key, item)
    })

    for (const [, group] of grouped) {
      try {
        const categoryIdFromName = categoryMap.get(group.category_name.toLowerCase())
        if (!categoryIdFromName) throw new Error(`Category not found: ${group.category_name}`)

        const price = parseNumeric(group.price_tzs, NaN)
        if (Number.isNaN(price) || price <= 0) throw new Error(`Invalid price_tzs for ${group.name}`)

        const lowThreshold = parseNumeric(group.low_stock_threshold || '5', 5)
        const variants = group.variants
          .filter(v => v.variant_size || v.variant_color || v.variant_sku || v.variant_stock_qty)
          .map(v => ({
            size: v.variant_size || undefined,
            color: v.variant_color || undefined,
            sku: v.variant_sku || undefined,
            stock_qty: parseNumeric(v.variant_stock_qty || '0', 0),
          }))

        await createProduct({
          name: group.name,
          category_id: categoryIdFromName,
          description: group.description,
          price,
          image_url: group.image_url,
          low_stock_threshold: Number.isNaN(lowThreshold) ? 5 : lowThreshold,
          variants,
        })
        created += 1
      } catch (e) {
        errors.push(e instanceof Error ? e.message : `Failed importing ${group.name}`)
      }
    }

    await qc.invalidateQueries({ queryKey: ['products'] })
    return { created, failed: errors.length, errors }
  }

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
          {!p.is_active && <p className="text-xs text-amber-700">Archived</p>}
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
          {isLow(p) && <Badge label="Low" color="red" />}
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditing(p)
              setModalOpen(true)
            }}
          >
            Edit
          </Button>
          {p.is_active ? (
            <Button
              size="sm"
              variant="danger"
              onClick={async () => {
                if (confirm('Archive this product?')) await deleteProduct.mutateAsync(p.id)
              }}
            >
              Archive
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              loading={updateProduct.isPending}
              onClick={async () => {
                await updateProduct.mutateAsync({ id: p.id, data: { is_active: true } })
              }}
            >
              Restore
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      {categories.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You need at least one category before adding products.
          <Link to="/categories" className="ml-2 underline font-medium">
            Create category
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3 flex-1 min-w-0 flex-wrap">
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
          <Select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'active' | 'archived' | 'all')}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
              { value: 'all', label: 'All' },
            ]}
            className="max-w-[150px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <TemplateButton template="products" />
          <ImportCsvButton template="products" onImport={handleImport} />
          <Button onClick={() => { setEditing(null); setModalOpen(true) }} disabled={categories.length === 0}>
            + Add Product
          </Button>
        </div>
      </div>

      <Table columns={columns} data={pagedProducts} keyExtractor={p => p.id} loading={isLoading} emptyMessage="No products found." />
      <Pagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={products.length} onPageChange={setCurrentPage} />

      <ProductForm open={modalOpen} onClose={() => { setModalOpen(false); setEditing(null) }} editing={editing} />
    </div>
  )
}
