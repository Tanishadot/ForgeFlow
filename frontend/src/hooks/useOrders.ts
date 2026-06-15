import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import type { OrderRow } from '../services/supabase'

export function useOrders() {
  const [orders,  setOrders]  = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  async function fetch() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('orders')
      .select('*')
      .order('updated_at', { ascending: false })
    if (err) {
      setError(err.message)
    } else {
      setOrders((data ?? []) as OrderRow[])
    }
    setLoading(false)
  }

  async function updateStatus(
    orderCode: string,
    status: OrderRow['status'],
    notes: string,
    userId: string,
  ) {
    const { error: err } = await supabase
      .from('orders')
      .update({
        status,
        notes,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('order_code', orderCode)

    if (err) throw new Error(err.message)
    await fetch()
  }

  useEffect(() => { fetch() }, [])

  return { orders, loading, error, refetch: fetch, updateStatus }
}
