import { Link, Outlet } from 'react-router-dom'
import { signOut, useAuth } from '../lib/auth'

export function AdminLayout() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <Link to="/admin" className="text-base font-semibold text-gray-900">
          Socio · Panel interno
        </Link>
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span>{user?.email}</span>
          <button
            onClick={() => signOut()}
            className="rounded border border-gray-300 px-3 py-1 text-gray-700 hover:bg-gray-100"
          >
            Salir
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
