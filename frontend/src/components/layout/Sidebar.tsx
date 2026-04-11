import { NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useLowStockProducts } from '../../hooks/useProducts'
import { useSettings } from '../../hooks/useSettings'

type UserRole = 'admin' | 'manager' | 'staff'

interface NavItem {
  to: string
  label: string
  icon: JSX.Element
  showLowStock?: boolean
  allowedRoles?: UserRole[]
}

const navItems: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-9 5v6h4v-6m-4 0H7m10 0h-2" />
      </svg>
    ),
  },
  {
    to: '/reports',
    label: 'Reports',
    allowedRoles: ['admin', 'manager'],
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6m3 6V7m3 10v-4m3 8H6a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    to: '/categories',
    label: 'Categories',
    allowedRoles: ['admin', 'manager'],
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10M4 7h.01M4 12h.01M4 17h.01" />
      </svg>
    ),
  },
  {
    to: '/products',
    label: 'Products',
    allowedRoles: ['admin', 'manager'],
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    showLowStock: true,
  },
  {
    to: '/sales',
    label: 'Sales',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-1.4 7h12.8M9 20a1 1 0 100 2 1 1 0 000-2zm8 0a1 1 0 100 2 1 1 0 000-2z" />
      </svg>
    ),
  },
  {
    to: '/stock-management',
    label: 'Stock Management',
    allowedRoles: ['admin', 'manager'],
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M6 7V5a2 2 0 012-2h8a2 2 0 012 2v2m-1 4H5m2 0v8a2 2 0 002 2h6a2 2 0 002-2v-8" />
      </svg>
    ),
  },
  {
    to: '/orders',
    label: 'Orders',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    to: '/preorders',
    label: 'Pre-orders',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    to: '/customers',
    label: 'Customers',
    allowedRoles: ['admin', 'manager'],
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 4a3 3 0 11-6 0 3 3 0 016 0zM3 11a3 3 0 116 0 3 3 0 01-6 0z" />
      </svg>
    ),
  },
]

const usersNavItem: NavItem = {
  to: '/users',
  label: 'Users',
  icon: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m8-6a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
}

const settingsNavItem: NavItem = {
  to: '/settings',
  label: 'Settings',
  icon: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.983 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4 8.5h2.2a6.98 6.98 0 011.2-2.1L6 4.8 7.8 3l1.6 1.4A6.98 6.98 0 0111.5 3V1h2v2a6.98 6.98 0 012.1 1.2L17.2 3 19 4.8l-1.4 1.6a6.98 6.98 0 011.2 2.1H21v2h-2.2a6.98 6.98 0 01-1.2 2.1l1.4 1.6-1.8 1.8-1.6-1.4a6.98 6.98 0 01-2.1 1.2V21h-2v-2.2a6.98 6.98 0 01-2.1-1.2L7.8 19 6 17.2l1.4-1.6a6.98 6.98 0 01-1.2-2.1H4v-2z" />
    </svg>
  ),
}

const stockAuditNavItem: NavItem = {
  to: '/stock-audit',
  label: 'Stock Audit',
  icon: (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2V7m3 10v-6M5 21h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
}

export default function Sidebar() {
  const { data: lowStock } = useLowStockProducts()
  const { data: settings } = useSettings()
  const { user } = useAuth()
  const lowStockCount = lowStock?.length ?? 0

  const role = user?.role ?? 'staff'
  const visibleMainItems = navItems.filter(item => !item.allowedRoles || item.allowedRoles.includes(role))
  const adminItems = role === 'admin' ? [usersNavItem, settingsNavItem, stockAuditNavItem] : []
  const items = [...visibleMainItems, ...adminItems]

  return (
    <aside className="w-60 min-h-screen bg-white border-r border-gray-100 flex flex-col shadow-sm">
      <div className="px-6 py-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <span className="text-base font-bold text-gray-900">{settings?.app_name ?? 'RetailPro'}</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {items.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              ].join(' ')
            }
          >
            <span className="flex items-center gap-3">
              {item.icon}
              {item.label}
            </span>
            {item.showLowStock && lowStockCount > 0 && (
              <span className="bg-red-100 text-red-600 text-xs font-semibold px-1.5 py-0.5 rounded-full">{lowStockCount}</span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-gray-100 text-xs text-gray-400 text-center">{settings?.app_name ?? 'RetailPro'}</div>
    </aside>
  )
}
