import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const FACILITY_OPTIONS = ['water', 'electricity', 'wifi', 'parking', 'gas']

export default function Properties() {
  const { user } = useAuth()
  const [properties, setProperties] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [type, setType] = useState('apartment')

  // shared fields
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')

  // apartment fields
  const [bedrooms, setBedrooms] = useState(1)
  const [bathrooms, setBathrooms] = useState(1)
  const [balconies, setBalconies] = useState(0)
  const [areaSqft, setAreaSqft] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [securityDeposit, setSecurityDeposit] = useState(0)

  // cottage fields: dynamic room list
  const [rooms, setRooms] = useState([{ room_number: '1', seat_capacity: 4, seat_cost: '' }])

  const [selectedFacilities, setSelectedFacilities] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function loadProperties() {
    setLoading(true)
    const { data, error } = await supabase
      .from('properties')
      .select('*, apartment_details(*), cottage_rooms(*)')
      .order('created_at', { ascending: false })
    if (!error) setProperties(data)
    setLoading(false)
  }

  useEffect(() => { loadProperties() }, [])

  function addRoomRow() {
    setRooms([...rooms, { room_number: String(rooms.length + 1), seat_capacity: 4, seat_cost: '' }])
  }
  function updateRoom(i, field, value) {
    const copy = [...rooms]
    copy[i][field] = value
    setRooms(copy)
  }
  function removeRoom(i) {
    setRooms(rooms.filter((_, idx) => idx !== i))
  }

  function toggleFacility(name) {
    setSelectedFacilities(prev =>
      prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]
    )
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const propertyTypeId = type === 'apartment' ? 1 : 2

    const { data: property, error: propError } = await supabase
      .from('properties')
      .insert({ owner_id: user.id, property_type_id: propertyTypeId, name, address, city })
      .select()
      .single()

    if (propError) {
      setError(propError.message)
      setSubmitting(false)
      return
    }

    if (type === 'apartment') {
      const { error: detailError } = await supabase.from('apartment_details').insert({
        property_id: property.id,
        bedrooms, bathrooms, balconies,
        area_sqft: areaSqft || null,
        monthly_rent: monthlyRent,
        security_deposit: securityDeposit,
      })
      if (detailError) { setError(detailError.message); setSubmitting(false); return }
    } else {
      const roomRows = rooms.map(r => ({
        property_id: property.id,
        room_number: r.room_number,
        seat_capacity: r.seat_capacity,
        seat_cost: r.seat_cost,
      }))
      const { error: roomError } = await supabase.from('cottage_rooms').insert(roomRows)
      if (roomError) { setError(roomError.message); setSubmitting(false); return }
    }

    // facilities: look up facility ids then insert property_facilities
    if (selectedFacilities.length > 0) {
      const { data: facilityRows } = await supabase
        .from('facilities')
        .select('id, name')
        .in('name', selectedFacilities)

      const facilityInserts = facilityRows.map(f => ({
        property_id: property.id,
        facility_id: f.id,
        is_included: true,
      }))
      await supabase.from('property_facilities').insert(facilityInserts)
    }

    setSubmitting(false)
    setShowForm(false)
    resetForm()
    loadProperties()
  }

  function resetForm() {
    setName(''); setAddress(''); setCity('')
    setBedrooms(1); setBathrooms(1); setBalconies(0); setAreaSqft(''); setMonthlyRent(''); setSecurityDeposit(0)
    setRooms([{ room_number: '1', seat_capacity: 4, seat_cost: '' }])
    setSelectedFacilities([])
  }

  return (
    <div>
      <div className="page-header">
        <h2>Properties</h2>
        <button onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ Add property'}</button>
      </div>

      {showForm && (
        <form className="card-form" onSubmit={handleSubmit}>
          {error && <p className="error-text">{error}</p>}

          <div className="type-toggle">
            <button type="button" className={type === 'apartment' ? 'active' : ''} onClick={() => setType('apartment')}>Apartment</button>
            <button type="button" className={type === 'cottage' ? 'active' : ''} onClick={() => setType('cottage')}>Cottage</button>
          </div>

          <label>Property name
            <input value={name} onChange={e => setName(e.target.value)} required />
          </label>
          <label>Address
            <input value={address} onChange={e => setAddress(e.target.value)} required />
          </label>
          <label>City
            <input value={city} onChange={e => setCity(e.target.value)} />
          </label>

          {type === 'apartment' ? (
            <div className="grid-2">
              <label>Bedrooms
                <input type="number" min="0" value={bedrooms} onChange={e => setBedrooms(e.target.value)} required />
              </label>
              <label>Bathrooms
                <input type="number" min="0" value={bathrooms} onChange={e => setBathrooms(e.target.value)} required />
              </label>
              <label>Balconies
                <input type="number" min="0" value={balconies} onChange={e => setBalconies(e.target.value)} />
              </label>
              <label>Area (sqft)
                <input type="number" value={areaSqft} onChange={e => setAreaSqft(e.target.value)} />
              </label>
              <label>Monthly rent
                <input type="number" min="0" value={monthlyRent} onChange={e => setMonthlyRent(e.target.value)} required />
              </label>
              <label>Security deposit
                <input type="number" min="0" value={securityDeposit} onChange={e => setSecurityDeposit(e.target.value)} />
              </label>
            </div>
          ) : (
            <div>
              <p className="section-label">Rooms</p>
              {rooms.map((room, i) => (
                <div className="room-row" key={i}>
                  <input placeholder="Room #" value={room.room_number} onChange={e => updateRoom(i, 'room_number', e.target.value)} required />
                  <input type="number" placeholder="Seats" min="1" value={room.seat_capacity} onChange={e => updateRoom(i, 'seat_capacity', e.target.value)} required />
                  <input type="number" placeholder="Cost per seat" min="0" value={room.seat_cost} onChange={e => updateRoom(i, 'seat_cost', e.target.value)} required />
                  {rooms.length > 1 && <button type="button" onClick={() => removeRoom(i)}>✕</button>}
                </div>
              ))}
              <button type="button" onClick={addRoomRow}>+ Add room</button>
            </div>
          )}

          <p className="section-label">Facilities</p>
          <div className="facility-chips">
            {FACILITY_OPTIONS.map(f => (
              <label key={f} className={`chip ${selectedFacilities.includes(f) ? 'chip-active' : ''}`}>
                <input type="checkbox" checked={selectedFacilities.includes(f)} onChange={() => toggleFacility(f)} />
                {f}
              </label>
            ))}
          </div>

          <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save property'}</button>
        </form>
      )}

      {loading ? <p>Loading...</p> : (
        <div className="card-list">
          {properties.map(p => (
            <div className="item-card" key={p.id}>
              <div className="item-card-header">
                <strong>{p.name}</strong>
                <span className="badge">{p.property_type_id === 1 ? 'Apartment' : 'Cottage'}</span>
              </div>
              <p>{p.address}{p.city ? `, ${p.city}` : ''}</p>
              {p.apartment_details && (
                <p className="muted">
                  {p.apartment_details.bedrooms} bed · {p.apartment_details.bathrooms} bath · ৳{p.apartment_details.monthly_rent}/mo
                </p>
              )}
              {p.cottage_rooms?.length > 0 && (
                <p className="muted">{p.cottage_rooms.length} room(s) listed</p>
              )}
            </div>
          ))}
          {properties.length === 0 && <p className="muted">No properties yet — add your first one.</p>}
        </div>
      )}
    </div>
  )
}
