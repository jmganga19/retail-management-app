import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import DashboardPage from './pages/DashboardPage'
import ProductsPage from './pages/ProductsPage'
import SalesPage from './pages/SalesPage'
import NewSalePage from './pages/NewSalePage'
import OrdersPage from './pages/OrdersPage'
import PreordersPage from './pages/PreordersPage'
import CustomersPage from './pages/CustomersPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="sales" element={<SalesPage />} />
          <Route path="sales/new" element={<NewSalePage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="preorders" element={<PreordersPage />} />
          <Route path="customers" element={<CustomersPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
