import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth'
import AppShell from './components/layout/AppShell'
import CategoriesPage from './pages/CategoriesPage'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
import NewSalePage from './pages/NewSalePage'
import OrdersPage from './pages/OrdersPage'
import PreordersPage from './pages/PreordersPage'
import ProductsPage from './pages/ProductsPage'
import ReportsPage from './pages/ReportsPage'
import SalesPage from './pages/SalesPage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth />}>
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="categories" element={<CategoriesPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="sales" element={<SalesPage />} />
            <Route path="sales/new" element={<NewSalePage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="preorders" element={<PreordersPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
