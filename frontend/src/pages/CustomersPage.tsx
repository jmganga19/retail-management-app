import { useState } from 'react'
import Button from '../components/ui/Button'
import Table from '../components/ui/Table'
import Modal from '../components/ui/Modal'
import Input from '../components/ui/Input'
import SearchBar from '../components/ui/SearchBar'
import { useCustomers, useCreateCustomer, useUpdateCustomer, useDeleteCustomer } from '../hooks/useCustomers'
import type { Customer } from '../types'

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')

  const { data: customers = [], isLoading } = useCustomers({ name: search || undefined })
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const deleteCustomer = useDeleteCustomer()

  const openAdd = () => { setEditing(null); setName(''); setPhone(''); setEmail(''); setError(''); setModalOpen(true) }
  const openEdit = (c: Customer) => { setEditing(c); setName(c.name); setPhone(c.phone ?? ''); setEmail(c.email ?? ''); setError(''); setModalOpen(true) }

  const handleSubmit = async () => {
    setError('')
    if (!name) { setError('Name is required.'); return }
    try {
      if (editing) {
        await updateCustomer.mutateAsync({ id: editing.id, data: { name, phone: phone || undefined, email: email || undefined } })
      } else {
        await createCustomer.mutateAsync({ name, phone: phone || undefined, email: email || undefined })
      }
      setModalOpen(false)
    } catch {
      setError('Failed to save customer.')
    }
  }

  const columns = [
    { key: 'name', header: 'Name', render: (c: Customer) => <span className="font-medium">{c.name}</span> },
    { key: 'phone', header: 'Phone', render: (c: Customer) => c.phone ?? '—' },
    { key: 'email', header: 'Email', render: (c: Customer) => c.email ?? '—' },
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

  const isPending = createCustomer.isPending || updateCustomer.isPending

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
        <Button onClick={openAdd}>+ Add Customer</Button>
      </div>

      <Table
        columns={columns}
        data={customers}
        keyExtractor={c => c.id}
        loading={isLoading}
        emptyMessage="No customers found."
      />

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
