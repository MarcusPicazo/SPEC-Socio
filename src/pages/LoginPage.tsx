import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, type Location } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { signInWithPassword, useAuth } from '../lib/auth'

export function LoginPage() {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) {
    const from = (location.state as { from?: Location })?.from
    return <Navigate to={from?.pathname ?? '/admin'} replace />
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await signInWithPassword(email, password)
    } catch {
      setError('Correo o contraseña incorrectos.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-papel px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm border border-linea bg-superficie p-6">
        <h1 className="text-[18px] font-medium text-tinta">Panel de Socio</h1>
        <p className="mt-1 text-sm text-gris-texto">Entra con tu cuenta de operador.</p>

        <div className="mt-4">
          <Input
            label="Correo"
            type="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="mt-3">
          <Input
            label="Contraseña"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <p className="mt-3 text-sm text-error">{error}</p>}

        <Button type="submit" variant="primary" disabled={submitting} className="mt-5 w-full">
          {submitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </div>
  )
}
