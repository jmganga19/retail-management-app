import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { createCustomer } from '../api/customers'
import Button from '../components/ui/Button'
import ImportCsvButton, { type ImportOutcome } from '../components/ui/ImportCsvButton'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import SearchBar from '../components/ui/SearchBar'
import Table from '../components/ui/Table'
import TemplateButton from '../components/ui/TemplateButton'
import { useCreateCustomer, useCustomers, useDeleteCustomer, useUpdateCustomer } from '../hooks/useCustomers'
import type { Customer } from '../types'
import { trimToUndefined } from '../utils/importParsers'

const PAGE_SIZE = 10

export default function CustomersPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const { data: customers = [], isLoading } = useCustomers({ name: search || undefined })
  const createCustomerMutation = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  useEffect(() => {
    setCurrentPage(1)
  }, [search])

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedCustomers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return customers.slice(start, start + PAGE_SIZE)
  }, [customers, currentPage])

  const handleImport = async (rows: Record<string, string>[]): Promise<ImportOutcome> => {
    let created = 0
    const errors: string[] = []

    for (const [idx, row] of rows.entries()) {
      try {
        const nameValue = trimToUndefined(row.name)
        if (!nameValue) throw new Error('name is required')

        await createCustomer({
          name: nameValue,
          phone: trimToUndefined(row.phone),
          email: trimToUndefined(row.email),
        })
        created += 1
      } catch (e) {
        errors.push(`Row ${idx + 2}: ${e instanceof Error ? e.message : 'failed'}`)
      }
    }

    await qc.invalidateQueries({ queryKey: ['customers'] })
    return { created, failed: errors.length, errors }
  }

  const openAdd = () => {
    setEditing(null)
    setName('')
    setPhone('')
    setEmail('')
    setError('')
    setModalOpen(true)
  }

  const openEdit = (c: Customer) => {
    setEditing(c)
    setName(c.name)
    setPhone(c.phone ?? '')
    setEmail(c.email ?? '')
    setError('')
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    setError('')
    if (!name) {
      setError('Name is required.')
      return
    }
    try {
      if (editing) {
        await updateCustomer.mutateAsync({ id: editing.id, data: { name, phone: phone || undefined, email: email || undefined } })
      } else {
        await createCustomerMutation.mutateAsync({ name, phone: phone || undefined, email: email || undefined })
      }
      setModalOpen(false)
    } catch {
      setError('Failed to save customer.')
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (c: Customer) => <span className="font-medium">{c.name}</span> },
    { key: 'phone', header: 'Phone', render: (c: Customer) => c.phone ?? '-' },
    { key: 'email', header: 'Email', render: (c: Customer) => c.email ?? '-' },
    { key: 'date', header: 'Since', render: (c: Customer) => new Date(c.created_at).toLocaleDateString() },
    {
      key: 'actions',
      header: '',
      render: (c: Customer) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => openEdit(c)}>Edit</Button>
          <Button
            size="sm"
            variant="danger"
            onClick={async () => {
              if (confirm(`Delete customer ${c.name}?`)) await deleteCustomer.mutateAsync(c.id)
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const isPending = createCustomerMutation.isPending || updateCustomer.isPending

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SearchBar
          placeholder="Search customers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onClear={() => setSearch('')}
          className="max-w-xs"
        />
        <div className="flex items-center gap-2">
          <TemplateButton template="customers" />
          <ImportCsvButton template="customers" onImport={handleImport} />
          <Button onClick={openAdd}>+ Add Customer</Button>
        </div>
      </div>

      <Table columns={columns} data={pagedCustomers} keyExtractor={c => c.id} loading={isLoading} emptyMessage="No customers found." />
      <Pagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={customers.length} onPageChange={setCurrentPage} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Customer' : 'Add Customer'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={isPending}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} />
          <Input label="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      </Modal>
    </div>
  )
}
