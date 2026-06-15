import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '../services/supabase'
import type { Profile, CompanyRow } from '../services/supabase'

interface AuthContextType {
  user:                    User | null
  session:                 Session | null
  profile:                 Profile | null
  role:                    'employee' | 'manager' | 'admin' | null
  companyId:               string | null
  companyName:             string | null
  employeeId:              string | null
  passwordResetRequired:   boolean
  loading:                 boolean
  signOut:                 () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user:                    null,
  session:                 null,
  profile:                 null,
  role:                    null,
  companyId:               null,
  companyName:             null,
  employeeId:              null,
  passwordResetRequired:   false,
  loading:                 true,
  signOut:                 async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,        setUser]        = useState<User | null>(null)
  const [session,     setSession]     = useState<Session | null>(null)
  const [profile,     setProfile]     = useState<Profile | null>(null)
  const [companyName, setCompanyName] = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)

  async function fetchProfile(uid: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()

    if (!error && data) {
      const prof = data as Profile
      setProfile(prof)

      if (prof.company_id) {
        const { data: company } = await supabase
          .from('companies')
          .select('company_name')
          .eq('id', prof.company_id)
          .single()
        if (company) setCompanyName((company as CompanyRow).company_name)
      }
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      if (data.session?.user) fetchProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess)
        setUser(sess?.user ?? null)
        if (sess?.user) {
          await fetchProfile(sess.user.id)
        } else {
          setProfile(null)
          setCompanyName(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setCompanyName(null)
  }

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role:                    profile?.role ?? null,
      companyId:               profile?.company_id ?? null,
      companyName,
      employeeId:              profile?.employee_id ?? null,
      passwordResetRequired:   profile?.password_reset_required ?? false,
      loading,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
