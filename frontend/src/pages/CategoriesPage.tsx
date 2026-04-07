import { useEffect, useMemo, useState } from 'react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '../hooks/useCategories'
import type { Category } from '../types'

const PAGE_SIZE = 10

const typeOptions = [
  { value: 'cosmetics', label: 'Cosmetics' },
  { value: 'clothes', label: 'Clothes' },
  { value: 'shoes', label: 'Shoes' },
]

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const [currentPage, setCurrentPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<'cosmetics' | 'clothes' | 'shoes'>('cosmetics')
  const [error, setError] = useState('')

  const totalPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedCategories = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return categories.slice(start, start + PAGE_SIZE)
  }, [categories, currentPage])

  const derivedSlug = useMemo(() => slugify(name), [name])

  const openAdd = () => {
    setEditing(null)
    setName('')
    setType('cosmetics')
    setError('')
    setModalOpen(true)
  }

  const openEdit = (category: Category) => {
    setEditing(category)
    setName(category.name)
    setType(category.type)
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    setError('')
    if (!name.trim()) {
      setError('Category name is required.')
      return
    }
    if (!derivedSlug) {
      setError('Category name must include letters or numbers.')
      return
    }

    try {
      if (editing) {
        await updateCategory.mutateAsync({
          id: editing.id,
          data: { name: name.trim(), slug: derivedSlug, type },
        })
      } else {
        await createCategory.mutateAsync({ name: name.trim(), slug: derivedSlug, type })
      }
      setModalOpen(false)
    } catch {
      setError('Failed to save category. Check duplicate names/slugs and try again.')
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (c: Category) => <span className="font-medium">{c.name}</span> },
    { key: 'slug', header: 'Slug', render: (c: Category) => <span className="font-mono text-xs">{c.slug}</span> },
    { key: 'type', header: 'Type', render: (c: Category) => <span className="capitalize">{c.type}</span> },
    { key: 'date', header: 'Created', render: (c: Category) => new Date(c.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      render: (c: Category) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (confirm(`Delete category ${c.name}?`)) {
                await deleteCategory.mutateAsync(c.id)
              }
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Add categories before creating products.</p>
        <Button onClick={openAdd}>+ Add Category</Button>
      </div>

      <Table
        columns={columns}
        data={pagedCategories}
        keyExtractor={c => c.id}
        loading={isLoading}
        emptyMessage="No categories yet. Add one to start creating products."
      />
      <Pagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={categories.length} onPageChange={setCurrentPage} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Category' : 'Add Category'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} loading={createCategory.isPending || updateCategory.isPending}>
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Input label="Category Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Cucci Oud" />
          <Input label="Slug" value={derivedSlug} readOnly />
          <Select
            label="Type"
            value={type}
            onChange={e => setType(e.target.value as 'cosmetics' | 'clothes' | 'shoes')}
            options={typeOptions}
          />
        </div>
      </Modal>
    </div>
  )
}
