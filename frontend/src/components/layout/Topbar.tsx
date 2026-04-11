import { useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/reports': 'Reports',
  '/categories': 'Categories',
  '/products': 'Products',
  '/sales': 'Sales History',
  '/sales/new': 'New Sale',
  '/stock-management': 'Stock Management',
  '/orders': 'Orders',
  '/preorders': 'Pre-orders',
  '/customers': 'Customers',
  '/data-migration': 'Data Migration',
  '/users': 'User Management',
  '/settings': 'Settings',
  '/stock-audit': 'Stock Audit',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const title = titles[pathname] ?? 'Retail Manager'

  return (
    <header className="h-14 bg-white border-b border-gray-100 px-6 flex items-center justify-between shadow-sm">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
          <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Logout
        </button>
      </div>
    </header>
  )
}


