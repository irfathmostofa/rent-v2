import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'

function renderTemplate(content, vars) {
  return content.replace(/{(\w+)}/g, (_, key) => vars[key] ?? `{${key}}`)
}

export default function Messages() {
  const { user } = useAuth()
  const location = useLocation()
  const prefill = location.state // { invoiceId, rentalId, phone, tenantName, amount, dueDate } if coming from Overdue page

  const [templates, setTemplates] = useState([])
  const [logs, setLogs] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [templateType, setTemplateType] = useState('reminder')
  const [content, setContent] = useState('Hi {tenant_name}, your rent of ৳{amount} was due on {due_date}. Please pay at your earliest convenience.')

  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [phone, setPhone] = useState(prefill?.phone ?? '')
  const [previewVars, setPreviewVars] = useState({
    tenant_name: prefill?.tenantName ?? '',
    amount: prefill?.amount ?? '',
    due_date: prefill?.dueDate ?? '',
  })

  async function loadData() {
    const [{ data: t }, { data: l }] = await Promise.all([
      supabase.from('message_templates').select('*').order('created_at', { ascending: false }),
      supabase.from('message_logs').select('*').order('sent_at', { ascending: false }).limit(20),
    ])
    setTemplates(t ?? [])
    setLogs(l ?? [])
  }

  useEffect(() => { loadData() }, [])

  async function saveTemplate(e) {
    e.preventDefault()
    await supabase.from('message_templates').insert({ owner_id: user.id, template_type: templateType, content })
    setShowForm(false)
    setContent('')
    loadData()
  }

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const finalMessage = selectedTemplate ? renderTemplate(selectedTemplate.content, previewVars) : ''

  async function sendViaWhatsApp() {
    if (!selectedTemplate || !phone) return
    await supabase.from('message_logs').insert({
      rental_id: prefill?.rentalId ?? null,
      invoice_id: prefill?.invoiceId ?? null,
      template_id: selectedTemplate.id,
      channel: 'whatsapp',
      recipient_phone: phone,
      final_message: finalMessage,
      status: 'sent',
    })
    const cleanPhone = phone.replace(/[^\d]/g, '')
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(finalMessage)}`, '_blank')
    loadData()
  }

  return (
    <div>
      <h2>SMS / WhatsApp</h2>

      <div className="page-header">
        <h3>Templates</h3>
        <button onClick={() => setShowForm(s => !s)}>{showForm ? 'Cancel' : '+ New template'}</button>
      </div>

      {showForm && (
        <form className="card-form" onSubmit={saveTemplate}>
          <label>Type
            <select value={templateType} onChange={e => setTemplateType(e.target.value)}>
              <option value="reminder">Reminder</option>
              <option value="invoice">Invoice</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>
          <label>Message (use {'{tenant_name}'}, {'{amount}'}, {'{due_date}'})
            <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} required />
          </label>
          <button type="submit">Save template</button>
        </form>
      )}

      <div className="card-list">
        {templates.map(t => (
          <div className="item-card" key={t.id}>
            <span className="badge">{t.template_type}</span>
            <p>{t.content}</p>
          </div>
        ))}
      </div>

      <h3>Send a message</h3>
      <div className="card-form">
        <label>Template
          <select value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
            <option value="">Select template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.template_type}: {t.content.slice(0, 30)}...</option>)}
          </select>
        </label>
        <label>Recipient phone
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="8801XXXXXXXXX" />
        </label>
        <div className="grid-2">
          <label>Tenant name
            <input value={previewVars.tenant_name} onChange={e => setPreviewVars(v => ({ ...v, tenant_name: e.target.value }))} />
          </label>
          <label>Amount
            <input value={previewVars.amount} onChange={e => setPreviewVars(v => ({ ...v, amount: e.target.value }))} />
          </label>
          <label>Due date
            <input value={previewVars.due_date} onChange={e => setPreviewVars(v => ({ ...v, due_date: e.target.value }))} />
          </label>
        </div>
        {finalMessage && <p className="preview-box">{finalMessage}</p>}
        <button onClick={sendViaWhatsApp} disabled={!selectedTemplateId || !phone}>Send via WhatsApp</button>
      </div>

      <h3>Recent message log</h3>
      <div className="card-list">
        {logs.map(l => (
          <div className="item-card" key={l.id}>
            <div className="item-card-header">
              <span>{l.recipient_phone}</span>
              <span className="badge">{l.channel} · {l.status}</span>
            </div>
            <p className="muted">{l.final_message}</p>
          </div>
        ))}
        {logs.length === 0 && <p className="muted">No messages sent yet.</p>}
      </div>
    </div>
  )
}
