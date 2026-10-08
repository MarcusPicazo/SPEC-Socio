import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from './components/AdminLayout'
import { RequireOperator } from './components/RequireOperator'
import { BusinessDetailPage } from './pages/BusinessDetailPage'
import { BusinessFormPage } from './pages/BusinessFormPage'
import { BusinessListPage } from './pages/BusinessListPage'
import { LoginPage } from './pages/LoginPage'
import { PublicQuotePage } from './pages/PublicQuotePage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireOperator>
            <AdminLayout />
          </RequireOperator>
        }
      >
        <Route index element={<BusinessListPage />} />
        <Route path="negocios/nuevo" element={<BusinessFormPage />} />
        <Route path="negocios/:id" element={<BusinessDetailPage />} />
        <Route path="negocios/:id/editar" element={<BusinessFormPage />} />
      </Route>
      <Route path="/q/:token" element={<PublicQuotePage />} />
    </Routes>
  )
}
