import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import RequireAuth from './auth/RequireAuth'
import RequireRoles from './auth/RequireRoles'
import AppShell from './components/layout/AppShell'
import CategoriesPage from './pages/CategoriesPage'
import CustomersPage from './pages/CustomersPage'
import DashboardPage from './pages/DashboardPage'
import DataMigrationPage from './pages/DataMigrationPage'
import LoginPage from './pages/LoginPage'
import NewSalePage from './pages/NewSalePage'
import OrdersPage from './pages/OrdersPage'
import PreordersPage from './pages/PreordersPage'
import ProductsPage from './pages/ProductsPage'
import ReportsPage from './pages/ReportsPage'
import SalesPage from './pages/SalesPage'
import SettingsPage from './pages/SettingsPage'
import StockAuditPage from './pages/StockAuditPage'
import StockManagementPage from './pages/StockManagementPage'
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
            <Route
              path="reports"
              element={
                <RequireRoles allowed={['admin', 'manager']}>
                  <ReportsPage />
                </RequireRoles>
              }
            />
            <Route
              path="categories"
              element={
                <RequireRoles allowed={['admin', 'manager']}>
                  <CategoriesPage />
                </RequireRoles>
              }
            />
            <Route
              path="products"
              element={
                <RequireRoles allowed={['admin', 'manager']}>
                  <ProductsPage />
                </RequireRoles>
              }
            />
            <Route path="sales" element={<SalesPage />} />
            <Route path="sales/new" element={<NewSalePage />} />
            <Route
              path="stock-management"
              element={
                <RequireRoles allowed={['admin', 'manager']}>
                  <StockManagementPage />
                </RequireRoles>
              }
            />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="preorders" element={<PreordersPage />} />
            <Route
              path="customers"
              element={
                <RequireRoles allowed={['admin', 'manager']}>
                  <CustomersPage />
                </RequireRoles>
              }
            />
            <Route
              path="data-migration"
              element={
                <RequireRoles allowed={['admin', 'manager']}>
                  <DataMigrationPage />
                </RequireRoles>
              }
            />
            <Route
              path="users"
              element={
                <RequireRoles allowed={['admin']}>
                  <UsersPage />
                </RequireRoles>
              }
            />
            <Route
              path="settings"
              element={
                <RequireRoles allowed={['admin']}>
                  <SettingsPage />
                </RequireRoles>
              }
            />
            <Route
              path="stock-audit"
              element={
                <RequireRoles allowed={['admin']}>
                  <StockAuditPage />
                </RequireRoles>
              }
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
