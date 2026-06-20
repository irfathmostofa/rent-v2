import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Rentals() {
  const [rentals, setRentals] = useState([])
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [tenantName, setTenantName] = useState('')
  const [tenantPhone, setTenantPhone] = useState('')
  const [propertyId, setPropertyId] = useState('')
  const [cottageRoomId, setCottageRoomId] = useState('')
  const [seatsBooked, setSeatsBooked] = useState(1)
  const [monthlyRent, setMonthlyRent] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))

  const selectedProperty = properties.find(p => p.id === propertyId)

  async function loadData() {
    setLoading(true)
    const [{ data: rentalRows }, { data: propertyRows }] = await Promise.all([
      supabase.from('rentals').select('*, tenants(*), properties(name), cottage_rooms(room_number, properties(name))').order('created_at', { ascending: false }),
      supabase.from('properties').select('*, apartment_details(*), cottage_rooms(*)'),
    ])
    setRentals(rentalRows ?? [])
    setProperties(propertyRows ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    // 1. find or create tenant by phone
    let { data: tenant } = await supabase.from('tenants').select('*').eq('phone_number', tenantPhone).maybeSingle()
    if (!tenant) {
      const { data: newTenant, error: tenantError } = await supabase
        .from('tenants').insert({ full_name: tenantName, phone_number: tenantPhone }).select().single()
      if (tenantError) { setError(tenantError.message); setSubmitting(false); return }
      tenant = newTenant
    }

    const isApartment = selectedProperty?.property_type_id === 1

    const rentalPayload = {
      tenant_id: tenant.id,
      property_id: isApartment ? propertyId : null,
      cottage_room_id: isApartment ? null : cottageRoomId,
      seats_booked: isApartment ? 1 : seatsBooked,
      monthly_rent: monthlyRent,
      start_date: startDate,
      due_day_of_month: 1,
      status_id: 1,
    }

    const { data: rental, error: rentalError } = await supabase
      .from('rentals').insert(rentalPayload).select().single()

    if (rentalError) { setError(rentalError.message); setSubmitting(false); return }

    // 2. create first invoice using 30-day month logic (client-side calc, mirrors generate_invoice_period())
    const start = new Date(startDate)
    const periodEnd = new Date(start); periodEnd.setDate(start.getDate() + 29)
    const dueDate = new Date(start); dueDate.setDate(start.getDate() + 30)

    const { error: invoiceError } = await supabase.from('invoices').insert({
      rental_id: rental.id,
      period_start: start.toISOString().slice(0, 10),
      period_end: periodEnd.toISOString().slice(0, 10),
      due_date: dueDate.toISOString().slice(0, 10),
      amount_due: monthlyRent,
    })
    if (invoiceError) { setError(invoiceError.message); setSubmitting(false); return }

    if (!isApartment && cottageRoomId) {
      await supabase.from('cottage_rooms').update({ is_occupied: true }).eq('id', cottageRoomId)
    }

    setSubmitting(false)
    setShowForm(false)
    setTenantName(''); setTenantPhone(''); setPropertyId(''); setCottageRoomId(''); setMonthlyRent('')
    loadData()
  }

  return (
    <div>
      <div className="page-header">
        <h2>Rentals</h2>
        <button onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ New rental'}</button>
      </div>

      {showForm && (
        <form className="card-form" onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}
          <div className="grid-2">
            <label>Tenant name
              <input value={tenantName} onChange={e => setTenantName(e.target.value)} required />
            </label>
            <label>Tenant phone
              <input value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} required />
            </label>
          </div>

          <label>Property
            <select value={propertyId} onChange={e => { setPropertyId(e.target.value); setCottageRoomId('') }} required>
              <option value="">Select property</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.property_type_id === 1 ? 'Apartment' : 'Cottage'})</option>
              ))}
            </select>
          </label>

          {selectedProperty?.property_type_id === 1 && selectedProperty?.apartment_details && (
            <p className="muted">Suggested rent: ৳{selectedProperty.apartment_details.monthly_rent}/mo</p>
          )}

          {selectedProperty?.property_type_id === 2 && (
            <label>Room
              <select value={cottageRoomId} onChange={e => setCottageRoomId(e.target.value)} required>
                <option value="">Select room</option>
                {selectedProperty.cottage_rooms?.filter(r => !r.is_occupied).map(r => (
                  <option key={r.id} value={r.id}>Room {r.room_number} — {r.seat_capacity} seats — ৳{r.seat_cost}/seat</option>
                ))}
              </select>
            </label>
          )}

          {selectedProperty?.property_type_id === 2 && (
            <label>Seats booked
              <input type="number" min="1" value={seatsBooked} onChange={e => setSeatsBooked(e.target.value)} required />
            </label>
          )}

          <div className="grid-2">
            <label>Monthly rent (total)
              <input type="number" min="0" value={monthlyRent} onChange={e => setMonthlyRent(e.target.value)} required />
            </label>
            <label>Start date
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </label>
          </div>

          <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Create rental'}</button>
        </form>
      )}

      {loading ? <p>Loading...</p> : (
        <div className="card-list">
          {rentals.map(r => (
            <div className="item-card" key={r.id}>
              <div className="item-card-header">
                <strong>{r.tenants?.full_name}</strong>
                <span className="badge">{r.status_id === 1 ? 'Active' : 'Closed'}</span>
              </div>
              <p>{r.properties?.name || `${r.cottage_rooms?.properties?.name} — Room ${r.cottage_rooms?.room_number}`}</p>
              <p className="muted">৳{r.monthly_rent}/mo · started {r.start_date}</p>
            </div>
          ))}
          {rentals.length === 0 && <p className="muted">No rentals yet.</p>}
        </div>
      )}
    </div>
  )
}
