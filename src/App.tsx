import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { PublicQuotePage } from './pages/PublicQuotePage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/q/:token" element={<PublicQuotePage />} />
    </Routes>
  )
}
