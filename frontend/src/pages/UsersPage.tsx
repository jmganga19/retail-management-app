import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import type { AuditLogEntry, SystemUser } from '../api/users'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'
import Select from '../components/ui/Select'
import Table from '../components/ui/Table'
import {
  useAuditLogs,
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
} from '../hooks/useUsers'

const PAGE_SIZE = 10

type Role = 'admin' | 'manager' | 'staff'

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'staff', label: 'Staff' },
]

const toDate = (d: string) => new Date(d).toLocaleDateString('en-TZ')
const toDateTime = (d: string) => new Date(d).toLocaleString('en-TZ')

const getErrorMessage = (error: unknown, fallback: string): string => {
  const maybe = error as { response?: { data?: { detail?: unknown } } }
  const detail = maybe?.response?.data?.detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined
    if (first?.msg) return first.msg
    return fallback
  }

  return fallback
}

const readableAction = (action: string) =>
  action
    .split('_').join(' ')
    .replace(/\\b\\w/g, (c: string) => c.toUpperCase())

export default function UsersPage() {
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)

  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<SystemUser | null>(null)
  const [resetTarget, setResetTarget] = useState<SystemUser | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const [createForm, setCreateForm] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'staff' as Role,
  })

  const [editForm, setEditForm] = useState({
    email: '',
    full_name: '',
    role: 'staff' as Role,
    is_active: true,
  })

  const [newPassword, setNewPassword] = useState('')

  const isActiveFilter = activeFilter === '' ? undefined : activeFilter === 'active'

  const { data: users = [], isLoading, refetch } = useUsers({
    q: search || undefined,
    role: roleFilter || undefined,
    is_active: isActiveFilter,
  })

  const { data: auditLogs = [], isLoading: auditLoading } = useAuditLogs({
    target_type: 'user',
    limit: 30,
  })

  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const resetPassword = useResetUserPassword()
  const deleteUser = useDeleteUser()

  useEffect(() => {
    setCurrentPage(1)
  }, [search, roleFilter, activeFilter])

  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE))
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const pagedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE
    return users.slice(start, start + PAGE_SIZE)
  }, [users, currentPage])

  const recentAudit = useMemo(() => auditLogs.slice(0, 12), [auditLogs])

  const resetCreateForm = () => {
    setCreateForm({ username: '', email: '', full_name: '', password: '', role: 'staff' })
  }

  const openEdit = (target: SystemUser) => {
    setErrorMessage('')
    setEditTarget(target)
    setEditForm({
      email: target.email,
      full_name: target.full_name,
      role: target.role,
      is_active: target.is_active,
    })
  }

  if (!user) return null
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />

  const userColumns = [
    { key: 'username', header: 'Username', render: (u: SystemUser) => <span className="font-medium">{u.username}</span> },
    { key: 'name', header: 'Full Name', render: (u: SystemUser) => u.full_name },
    { key: 'email', header: 'Email', render: (u: SystemUser) => u.email },
    {
      key: 'role',
      header: 'Role',
      render: (u: SystemUser) => (
        <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700 uppercase">{u.role}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u: SystemUser) =>
        u.is_active ? (
          <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Active</span>
        ) : (
          <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Disabled</span>
        ),
    },
    { key: 'created', header: 'Created', render: (u: SystemUser) => toDate(u.created_at) },
    {
      key: 'actions',
      header: '',
      render: (u: SystemUser) => (
        <div className="flex gap-2 flex-wrap justify-end">
          <Button size="sm" variant="secondary" onClick={() => openEdit(u)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setErrorMessage('')
              setResetTarget(u)
              setNewPassword('')
            }}
          >
            Reset Password
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={u.id === user.id}
            loading={deleteUser.isPending}
            onClick={async () => {
              if (!confirm(`Delete user ${u.username}?`)) return
              try {
                await deleteUser.mutateAsync(u.id)
              } catch (e) {
                alert(getErrorMessage(e, 'Failed to delete user'))
              }
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  const auditColumns = [
    { key: 'when', header: 'When', render: (a: AuditLogEntry) => toDateTime(a.created_at) },
    { key: 'actor', header: 'Actor', render: (a: AuditLogEntry) => a.actor_username ?? 'System' },
    { key: 'action', header: 'Action', render: (a: AuditLogEntry) => readableAction(a.action) },
    { key: 'target', header: 'Target ID', render: (a: AuditLogEntry) => a.target_id ?? '-' },
    { key: 'desc', header: 'Description', render: (a: AuditLogEntry) => a.description ?? '-' },
  ]

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3 items-end">
            <Input
              label="Search"
              placeholder="Username, email, or full name"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            <Button variant="secondary" onClick={() => setSearch(searchInput.trim())}>
              Search
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSearchInput('')
                setSearch('')
              }}
            >
              Clear
            </Button>
            <Select
              label="Role"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              placeholder="All roles"
              options={roleOptions}
            />
            <Select
              label="Status"
              value={activeFilter}
              onChange={e => setActiveFilter(e.target.value)}
              placeholder="All statuses"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Disabled' },
              ]}
            />
            <Button variant="secondary" onClick={() => refetch()}>
              Refresh
            </Button>
          </div>
          <Button onClick={() => { setErrorMessage(''); setCreateOpen(true) }}>+ New User</Button>
        </div>

        {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}

        <Table columns={userColumns} data={pagedUsers} keyExtractor={u => u.id} loading={isLoading} emptyMessage="No users found." />
        <Pagination currentPage={currentPage} pageSize={PAGE_SIZE} totalItems={users.length} onPageChange={setCurrentPage} />
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Recent User Audit Logs</h2>
        <Table
          columns={auditColumns}
          data={recentAudit}
          keyExtractor={a => a.id}
          loading={auditLoading}
          emptyMessage="No audit logs yet."
        />
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              loading={createUser.isPending}
              onClick={async () => {
                if (!createForm.username.trim() || !createForm.full_name.trim() || !createForm.email.trim()) {
                  setErrorMessage('Username, full name, and email are required')
                  return
                }
                if (createForm.password.length < 8) {
                  setErrorMessage('Password must be at least 8 characters')
                  return
                }

                try {
                  setErrorMessage('')
                  await createUser.mutateAsync({
                    ...createForm,
                    username: createForm.username.trim(),
                    full_name: createForm.full_name.trim(),
                    email: createForm.email.trim(),
                  })
                  setCreateOpen(false)
                  resetCreateForm()
                } catch (e) {
                  setErrorMessage(getErrorMessage(e, 'Failed to create user'))
                }
              }}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Username" value={createForm.username} onChange={e => setCreateForm(v => ({ ...v, username: e.target.value }))} />
          <Input label="Full Name" value={createForm.full_name} onChange={e => setCreateForm(v => ({ ...v, full_name: e.target.value }))} />
          <Input label="Email" type="email" value={createForm.email} onChange={e => setCreateForm(v => ({ ...v, email: e.target.value }))} />
          <Select label="Role" value={createForm.role} options={roleOptions} onChange={e => setCreateForm(v => ({ ...v, role: e.target.value as Role }))} />
          <Input label="Password" type="password" value={createForm.password} onChange={e => setCreateForm(v => ({ ...v, password: e.target.value }))} />
        </div>
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title={editTarget ? `Edit ${editTarget.username}` : 'Edit User'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              loading={updateUser.isPending}
              onClick={async () => {
                if (!editTarget) return
                try {
                  setErrorMessage('')
                  await updateUser.mutateAsync({ id: editTarget.id, payload: editForm })
                  setEditTarget(null)
                } catch (e) {
                  setErrorMessage(getErrorMessage(e, 'Failed to update user'))
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input label="Full Name" value={editForm.full_name} onChange={e => setEditForm(v => ({ ...v, full_name: e.target.value }))} />
          <Input label="Email" type="email" value={editForm.email} onChange={e => setEditForm(v => ({ ...v, email: e.target.value }))} />
          <Select label="Role" value={editForm.role} options={roleOptions} onChange={e => setEditForm(v => ({ ...v, role: e.target.value as Role }))} />
          <Select
            label="Status"
            value={editForm.is_active ? 'active' : 'inactive'}
            onChange={e => setEditForm(v => ({ ...v, is_active: e.target.value === 'active' }))}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Disabled' },
            ]}
          />
        </div>
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={resetTarget ? `Reset Password: ${resetTarget.username}` : 'Reset Password'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button
              loading={resetPassword.isPending}
              onClick={async () => {
                if (!resetTarget) return
                try {
                  setErrorMessage('')
                  await resetPassword.mutateAsync({ id: resetTarget.id, newPassword })
                  setResetTarget(null)
                  setNewPassword('')
                } catch (e) {
                  setErrorMessage(getErrorMessage(e, 'Failed to reset password'))
                }
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <Input
          label="New Password"
          type="password"
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </Modal>
    </div>
  )
}




