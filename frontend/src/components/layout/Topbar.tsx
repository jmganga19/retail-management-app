import { useLocation } from 'react-router-dom'

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/products': 'Products',
  '/sales': 'Sales History',
  '/sales/new': 'New Sale',
  '/orders': 'Orders',
  '/preorders': 'Pre-orders',
  '/customers': 'Customers',
}

export default function Topbar() {
  const { pathname } = useLocation()
  const title = titles[pathname] ?? 'Retail Manager'

  return (
    <header className="h-14 bg-white border-b border-gray-100 px-6 flex items-center shadow-sm">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
    </header>
  )
}
