import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import type { MachineRow } from '../services/supabase'

export function useMachines() {
  const [machines, setMachines] = useState<MachineRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  async function fetch() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('machines')
      .select('*')
      .order('name')
    if (err) {
      setError(err.message)
    } else {
      setMachines((data ?? []) as MachineRow[])
    }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  return { machines, loading, error, refetch: fetch }
}
