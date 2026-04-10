import { useEffect, useMemo, useState } from 'react'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from '../hooks/useCategories'
import { useCategoryTypes, useCreateCategoryType, useDeleteCategoryType, useUpdateCategoryType } from '../hooks/useCategoryTypes'
import type { Category } from '../types'

const PAGE_SIZE = 10

const slugify = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const getErrorMessage = (error: unknown, fallback: string): string => {
  const maybe = error as { response?: { data?: { detail?: string } } }
  return maybe?.response?.data?.detail ?? fallback
}

export default function CategoriesPage() {
  const { data: categories = [], isLoading } = useCategories()
  const { data: categoryTypes = [] } = useCategoryTypes()
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()
  const createType = useCreateCategoryType()
  const updateType = useUpdateCategoryType()
  const deleteType = useDeleteCategoryType()

  const [currentPage, setCurrentPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [manageTypesOpen, setManageTypesOpen] = useState(false)
  const [editing, setEditing] = useState<Category | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [error, setError] = useState('')

  const [newTypeName, setNewTypeName] = useState('')
  const [editingTypeName, setEditingTypeName] = useState<string | null>(null)
  const [editingTypeValue, setEditingTypeValue] = useState('')
  const [typeError, setTypeError] = useState('')

  useEffect(() => {
    if (!type && categoryTypes.length > 0) {
      setType(categoryTypes[0])
    }
  }, [categoryTypes, type])

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
    setType(categoryTypes[0] ?? '')
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
    if (!type.trim()) {
      setError('Type is required.')
      return
    }

    try {
      if (editing) {
        await updateCategory.mutateAsync({
          id: editing.id,
          data: { name: name.trim(), slug: derivedSlug, type: type.trim().toLowerCase() },
        })
      } else {
        await createCategory.mutateAsync({ name: name.trim(), slug: derivedSlug, type: type.trim().toLowerCase() })
      }
      setModalOpen(false)
    } catch {
      setError('Failed to save category. Check duplicate names/slugs and try again.')
    }
  }

  const handleAddType = async () => {
    const next = newTypeName.trim().toLowerCase()
    if (!next) return
    setTypeError('')
    try {
      await createType.mutateAsync(next)
      setNewTypeName('')
      if (!type) setType(next)
    } catch {
      setTypeError('Failed to add type. It may already exist.')
    }
  }

  const handleSaveTypeEdit = async () => {
    if (!editingTypeName) return
    const next = editingTypeValue.trim().toLowerCase()
    if (!next) return
    setTypeError('')
    try {
      await updateType.mutateAsync({ oldName: editingTypeName, name: next })
      if (type === editingTypeName) setType(next)
      setEditingTypeName(null)
      setEditingTypeValue('')
    } catch {
      setTypeError('Failed to rename type.')
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
                try {
                await deleteCategory.mutateAsync(c.id)
              } catch (e) {
                alert(getErrorMessage(e, 'Failed to delete category'))
              }
              }
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const typeOptions = categoryTypes.map(t => ({ value: t, label: t }))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-gray-600">Add categories before creating products.</p>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setManageTypesOpen(true)}>
            Manage Types
          </Button>
          <Button onClick={openAdd}>+ Add Category</Button>
        </div>
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
            onChange={e => setType(e.target.value)}
            options={typeOptions}
            placeholder="Select type"
          />
          <div className="text-xs text-gray-500">Need a new type? Use the "Manage Types" button.</div>
        </div>
      </Modal>

      <Modal
        open={manageTypesOpen}
        onClose={() => {
          setManageTypesOpen(false)
          setTypeError('')
          setEditingTypeName(null)
          setEditingTypeValue('')
        }}
        title="Manage Category Types"
        footer={
          <Button variant="secondary" onClick={() => setManageTypesOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-4">
          {typeError && <p className="text-sm text-red-500">{typeError}</p>}

          <div className="flex gap-2 items-end">
            <Input label="New Type" value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="e.g. perfumes" />
            <Button onClick={handleAddType} loading={createType.isPending}>Add</Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-auto">
            {categoryTypes.map(t => (
              <div key={t} className="border border-gray-200 rounded-lg p-2 flex items-center justify-between gap-2">
                {editingTypeName === t ? (
                  <div className="flex items-end gap-2 w-full">
                    <Input label="Rename Type" value={editingTypeValue} onChange={e => setEditingTypeValue(e.target.value)} className="w-full" />
                    <Button size="sm" onClick={handleSaveTypeEdit} loading={updateType.isPending}>Save</Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setEditingTypeName(null)
                        setEditingTypeValue('')
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="capitalize">{t}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingTypeName(t)
                          setEditingTypeValue(t)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={deleteType.isPending}
                        onClick={async () => {
                          setTypeError('')
                          try {
                            await deleteType.mutateAsync(t)
                            if (type === t) setType('')
                          } catch {
                            setTypeError('Cannot delete this type. It may be used by categories.')
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {categoryTypes.length === 0 && <p className="text-sm text-gray-500">No types available.</p>}
          </div>
        </div>
      </Modal>
    </div>
  )
}


