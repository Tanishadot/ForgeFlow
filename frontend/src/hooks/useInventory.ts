import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import type { InventoryRow } from '../services/supabase'

export function useInventory() {
  const [inventory, setInventory] = useState<InventoryRow[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)

  async function fetch() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('inventory')
      .select('*')
      .order('material_name')
    if (err) {
      setError(err.message)
    } else {
      setInventory((data ?? []) as InventoryRow[])
    }
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  return { inventory, loading, error, refetch: fetch }
}
