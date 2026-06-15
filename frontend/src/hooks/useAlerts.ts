import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import type { AlertRow } from '../services/supabase'

export function useAlerts() {
  const [alerts,  setAlerts]  = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  async function fetch() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (err) {
      setError(err.message)
    } else {
      setAlerts((data ?? []) as AlertRow[])
    }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  return { alerts, loading, error, refetch: fetch }
}
