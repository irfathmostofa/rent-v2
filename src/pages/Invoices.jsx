import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [payingId, setPayingId] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')

  async function loadInvoices() {
    setLoading(true)
    const { data } = await supabase
      .from('invoices')
      .select('*, rentals(tenant_id, monthly_rent, tenants(full_name, phone_number)), payments(amount_paid)')
      .order('due_date', { ascending: true })
    setInvoices(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadInvoices() }, [])

  function totalPaid(invoice) {
    return (invoice.payments ?? []).reduce((sum, p) => sum + Number(p.amount_paid), 0)
  }

  async function recordPayment(invoice) {
    const { error } = await supabase.from('payments').insert({
      invoice_id: invoice.id,
      amount_paid: payAmount,
      payment_method: payMethod,
    })
    if (!error) {
      const newTotal = totalPaid(invoice) + Number(payAmount)
      if (newTotal >= Number(invoice.amount_due)) {
        await supabase.from('invoices').update({ is_paid: true }).eq('id', invoice.id)
      }
      setPayingId(null)
      setPayAmount('')
      loadInvoices()
    }
  }

  // generates the NEXT invoice for a rental, exactly 30 days after the previous period_start
  async function generateNextInvoice(invoice) {
    const prevStart = new Date(invoice.period_start)
    const nextStart = new Date(prevStart); nextStart.setDate(prevStart.getDate() + 30)
    const nextEnd = new Date(nextStart); nextEnd.setDate(nextStart.getDate() + 29)
    const nextDue = new Date(nextStart); nextDue.setDate(nextStart.getDate() + 30)

    await supabase.from('invoices').insert({
      rental_id: invoice.rentals ? invoice.rental_id : invoice.rental_id,
      period_start: nextStart.toISOString().slice(0, 10),
      period_end: nextEnd.toISOString().slice(0, 10),
      due_date: nextDue.toISOString().slice(0, 10),
      amount_due: invoice.amount_due,
    })
    loadInvoices()
  }

  if (loading) return <p>Loading...</p>

  return (
    <div>
      <h2>Invoices</h2>
      <div className="card-list">
        {invoices.map(inv => {
          const paid = totalPaid(inv)
          const remaining = Number(inv.amount_due) - paid
          return (
            <div className="item-card" key={inv.id}>
              <div className="item-card-header">
                <strong>{inv.rentals?.tenants?.full_name}</strong>
                <span className={`badge ${inv.is_paid ? 'badge-success' : 'badge-warning'}`}>
                  {inv.is_paid ? 'Paid' : 'Unpaid'}
                </span>
              </div>
              <p className="muted">Period: {inv.period_start} → {inv.period_end} · Due: {inv.due_date}</p>
              <p>Amount due: ৳{inv.amount_due} {paid > 0 && `(paid ৳${paid}, remaining ৳${remaining})`}</p>

              {!inv.is_paid && (
                payingId === inv.id ? (
                  <div className="inline-form">
                    <input type="number" placeholder="Amount" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                      <option value="cash">Cash</option>
                      <option value="bkash">bKash</option>
                      <option value="nagad">Nagad</option>
                      <option value="bank">Bank</option>
                    </select>
                    <button onClick={() => recordPayment(inv)}>Confirm</button>
                    <button onClick={() => setPayingId(null)}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => { setPayingId(inv.id); setPayAmount(String(remaining)) }}>Record payment</button>
                )
              )}

              {inv.is_paid && (
                <button onClick={() => generateNextInvoice(inv)}>Generate next month's invoice</button>
              )}
            </div>
          )
        })}
        {invoices.length === 0 && <p className="muted">No invoices yet.</p>}
      </div>
    </div>
  )
}
