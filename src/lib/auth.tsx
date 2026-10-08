import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthState {
  loading: boolean
  session: Session | null
  user: User | null
  isOperator: boolean
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    loading: true,
    session: null,
    user: null,
    isOperator: false,
  })

  useEffect(() => {
    let active = true

    async function loadOperatorFlag(user: User | null): Promise<boolean> {
      if (!user) return false
      const { data } = await supabase
        .from('operators')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      return data !== null
    }

    supabase.auth.getSession().then(async ({ data }) => {
      const isOperator = await loadOperatorFlag(data.session?.user ?? null)
      if (!active) return
      setState({
        loading: false,
        session: data.session,
        user: data.session?.user ?? null,
        isOperator,
      })
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      loadOperatorFlag(session?.user ?? null).then((isOperator) => {
        if (!active) return
        setState({ loading: false, session, user: session?.user ?? null, isOperator })
      })
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}
