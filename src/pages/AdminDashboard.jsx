import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

const STATUS_LABELS = { 1: 'Pending verification', 2: 'Active', 3: 'Hold', 4: 'Terminated' }

export default function AdminDashboard() {
  const { user } = useAuth()
  const [owners, setOwners] = useState([])
  const [loading, setLoading] = useState(true)
  const [reasonDrafts, setReasonDrafts] = useState({})

  async function loadOwners() {
    setLoading(true)
    const { data } = await supabase
      .from('owners')
      .select('*, account_status(name), roles(name)')
      .order('created_at', { ascending: false })
    setOwners(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadOwners() }, [])

  async function changeStatus(owner, newStatusId, action) {
    const reason = reasonDrafts[owner.id] || null

    const updatePayload = { status_id: newStatusId }
    if (newStatusId === 2) { updatePayload.approved_at = new Date().toISOString(); updatePayload.approved_by = user.id }
    if (newStatusId === 3) updatePayload.held_reason = reason
    if (newStatusId === 4) updatePayload.terminated_reason = reason

    const { error } = await supabase.from('owners').update(updatePayload).eq('id', owner.id)
    if (!error) {
      await supabase.from('admin_action_logs').insert({
        admin_id: user.id,
        target_owner_id: owner.id,
        action,
        reason,
      })
      loadOwners()
    }
  }

  if (loading) return <p>Loading owners...</p>

  return (
    <div>
      <h2>Super Admin · All Owners</h2>
      <div className="card-list">
        {owners.map(o => (
          <div className="item-card" key={o.id}>
            <div className="item-card-header">
              <strong>{o.full_name}</strong>
              <span className={`badge ${o.status_id === 2 ? 'badge-success' : o.status_id === 4 ? 'badge-danger' : 'badge-warning'}`}>
                {STATUS_LABELS[o.status_id]}
              </span>
            </div>
            <p className="muted">{o.email} · {o.phone_number} · Role: {o.roles?.name}</p>
            {o.held_reason && <p className="muted">Hold reason: {o.held_reason}</p>}
            {o.terminated_reason && <p className="muted">Terminated reason: {o.terminated_reason}</p>}

            {o.roles?.name !== 'super_admin' && (
              <>
                <input
                  placeholder="Reason (for hold/terminate)"
                  value={reasonDrafts[o.id] || ''}
                  onChange={e => setReasonDrafts(d => ({ ...d, [o.id]: e.target.value }))}
                />
                <div className="action-row">
                  {o.status_id !== 2 && <button onClick={() => changeStatus(o, 2, 'activated')}>Activate</button>}
                  {o.status_id !== 3 && <button onClick={() => changeStatus(o, 3, 'held')}>Hold</button>}
                  {o.status_id !== 4 && <button onClick={() => changeStatus(o, 4, 'terminated')} className="danger-btn">Terminate</button>}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
