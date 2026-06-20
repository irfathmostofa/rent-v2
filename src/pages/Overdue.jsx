import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'

export default function Overdue() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('overdue_invoices').select('*').order('days_overdue', { ascending: false })
      setRows(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <h2>Overdue Invoices</h2>
      <p className="muted">Months are counted as fixed 30-day cycles from each rental's start date.</p>
      <div className="card-list">
        {rows.map(r => (
          <div className="item-card item-card-danger" key={r.invoice_id}>
            <div className="item-card-header">
              <strong>{r.tenant_name}</strong>
              <span className="badge badge-danger">{r.days_overdue} days overdue</span>
            </div>
            <p className="muted">{r.phone_number}</p>
            <p>Amount due: ৳{r.amount_due} · Due date: {r.due_date}</p>
            <button onClick={() => navigate('/dashboard/messages', { state: { invoiceId: r.invoice_id, rentalId: r.rental_id, phone: r.phone_number, tenantName: r.tenant_name, amount: r.amount_due, dueDate: r.due_date } })}>
              Send reminder
            </button>
          </div>
        ))}
        {rows.length === 0 && <p className="muted">No overdue invoices 🎉</p>}
      </div>
    </div>
  )
}
