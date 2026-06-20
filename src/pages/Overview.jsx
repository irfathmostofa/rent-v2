import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Overview() {
  const [stats, setStats] = useState({ properties: 0, rentals: 0, overdue: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStats() {
      const [{ count: properties }, { count: rentals }, { data: overdueRows }] = await Promise.all([
        supabase.from('properties').select('*', { count: 'exact', head: true }),
        supabase.from('rentals').select('*', { count: 'exact', head: true }).eq('status_id', 1),
        supabase.from('overdue_invoices').select('invoice_id'),
      ])
      setStats({
        properties: properties ?? 0,
        rentals: rentals ?? 0,
        overdue: overdueRows?.length ?? 0,
      })
      setLoading(false)
    }
    loadStats()
  }, [])

  if (loading) return <p>Loading overview...</p>

  return (
    <div>
      <h2>Overview</h2>
      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-number">{stats.properties}</span>
          <span className="stat-label">Properties</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{stats.rentals}</span>
          <span className="stat-label">Active Rentals</span>
        </div>
        <div className="stat-card stat-warning">
          <span className="stat-number">{stats.overdue}</span>
          <span className="stat-label">Overdue Invoices</span>
        </div>
      </div>
    </div>
  )
}
