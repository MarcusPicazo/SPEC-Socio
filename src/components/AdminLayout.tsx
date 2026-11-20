import { useEffect, useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { signOut, useAuth } from '../lib/auth'
import { SocioLogo } from './brand/SocioLogo'
import { ToastProvider } from './ui/Toast'

// BRAND-PANEL.md §5/§6 — barra lateral fija de 240px en escritorio
// (min-[900px]:), fondo tinta, logo estático arriba, link activo con
// barra terracota de 2px. Bajo 900px se vuelve un menú que se abre con
// un botón.
export function AdminLayout() {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!mobileOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  return (
    <ToastProvider>
      <div className="min-h-screen bg-papel min-[900px]:flex">
        <header className="flex items-center justify-between border-b border-apagado-oscuro bg-tinta px-4 py-3 min-[900px]:hidden">
          <SocioLogo height={22} tone="dark" animated={false} />
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="text-papel"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 6h16M4 12h16M4 18h16"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-tinta/50 min-[900px]:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <aside
          className={[
            'z-50 w-sidebar flex-col bg-tinta px-4 py-6',
            'min-[900px]:static min-[900px]:flex',
            mobileOpen ? 'fixed inset-y-0 left-0 flex' : 'fixed inset-y-0 left-0 hidden',
          ].join(' ')}
        >
          <div className="flex items-center justify-between">
            <Link to="/admin" onClick={() => setMobileOpen(false)}>
              <SocioLogo height={22} tone="dark" animated={false} />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Cerrar menú"
              className="text-papel/70 hover:text-papel min-[900px]:hidden"
            >
              ✕
            </button>
          </div>

          <nav className="mt-8 flex-1">
            <Link
              to="/admin"
              onClick={() => setMobileOpen(false)}
              className="block border-l-2 border-terracota py-2 pl-3 font-mono text-xs uppercase tracking-[0.08em] text-papel"
            >
              Negocios
            </Link>
          </nav>

          <div className="border-t border-apagado-oscuro pt-4 text-sm">
            <p className="truncate text-papel/70">{user?.email}</p>
            <button
              type="button"
              onClick={() => signOut()}
              className="mt-2 font-mono text-xs uppercase tracking-[0.08em] text-papel/70 hover:text-papel"
            >
              Salir
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </ToastProvider>
  )
}
