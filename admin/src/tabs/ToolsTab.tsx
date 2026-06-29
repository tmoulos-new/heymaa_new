import { useState, type KeyboardEvent } from 'react'
import { MessageCircle, Sprout } from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail, getApiBase } from '../lib/api'

export function ToolsTab({ onSeeded }: { onSeeded: () => void }) {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [seedCountry, setSeedCountry] = useState('GR')
  const [seedPregnant, setSeedPregnant] = useState('true')
  const [seedChildren, setSeedChildren] = useState('0')
  const [seedCity, setSeedCity] = useState('')
  const [seedZip, setSeedZip] = useState('')
  const [chatToken, setChatToken] = useState('')
  const [chatMsg, setChatMsg] = useState('')
  const [chatResult, setChatResult] = useState('')
  const [chatVisible, setChatVisible] = useState(false)

  const seed = async () => {
    if (!confirm('Seed profiles for all 15 beta testers?')) return
    show('Seeding… please wait.', 'info')
    try {
      const d = await adminFetch('/admin/profiles/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country: seedCountry,
          pregnancy_active: seedPregnant === 'true',
          child_count: parseInt(seedChildren, 10),
          city: seedCity.trim() || null,
          zip: seedZip.trim() || null,
        }),
      })
      if (d.ok) {
        show(`✅ Seeded ${d.seeded} profiles.`, 'ok')
        onSeeded()
      } else {
        show(`Error: ${apiDetail(d) || 'Unknown'}`, 'err')
      }
    } catch {
      show('Network error', 'err')
    }
  }

  const sendChat = async () => {
    if (!chatToken.trim() || !chatMsg.trim()) {
      alert('Συμπλήρωσε token και μήνυμα')
      return
    }
    setChatVisible(true)
    setChatResult('Αποστολή…')
    try {
      const api = getApiBase()
      const r = await fetch(`${api}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-token': chatToken.trim() },
        body: JSON.stringify({ message: chatMsg.trim(), history: [] }),
      })
      const d = (await r.json()) as { response?: string }
      setChatResult(d.response || JSON.stringify(d, null, 2))
    } catch (e) {
      setChatResult(`Σφάλμα: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  const onChatKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') void sendChat()
  }

  return (
    <div className="grid-2">
      <div className="card">
        <div className="card-head">
          <h2>
            <Sprout size={16} className="h-icon" /> Beta Profile Seed
          </h2>
        </div>
        <p className="card-desc">
          Seeds profiles for all 15 beta testers (HeyMaa_CD_Test_01–15) with{' '}
          <code>consent_marketing=true</code>.
        </p>
        {Message}
        <div className="row">
          <select value={seedCountry} onChange={(e) => setSeedCountry(e.target.value)}>
            <option value="GR">🇬🇷 Greece</option>
            <option value="CY">🇨🇾 Cyprus</option>
            <option value="DE">🇩🇪 Germany</option>
            <option value="GB">🇬🇧 UK</option>
            <option value="US">🇺🇸 US</option>
          </select>
          <select value={seedPregnant} onChange={(e) => setSeedPregnant(e.target.value)}>
            <option value="true">🤰 Pregnant</option>
            <option value="false">👶 Has children</option>
          </select>
          <select value={seedChildren} onChange={(e) => setSeedChildren(e.target.value)}>
            <option value="0">0 children</option>
            <option value="1">1 child</option>
            <option value="2">2 children</option>
          </select>
        </div>
        <div className="row">
          <input value={seedCity} onChange={(e) => setSeedCity(e.target.value)} placeholder="City (optional)" />
          <input value={seedZip} onChange={(e) => setSeedZip(e.target.value)} placeholder="ZIP (optional)" />
        </div>
        <button type="button" className="teal" style={{ width: '100%' }} onClick={() => void seed()}>
          <Sprout size={15} style={{ verticalAlign: -2, marginRight: 6 }} /> Seed all 15 beta profiles →
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <MessageCircle size={16} className="h-icon" /> Chat Test
          </h2>
        </div>
        <p className="card-desc">Paste a user&apos;s session token and send a message to test Maa&apos;s response.</p>
        <FieldLabel>Session token</FieldLabel>
        <input
          value={chatToken}
          onChange={(e) => setChatToken(e.target.value)}
          placeholder="x-token from Supabase users table"
          style={{ fontSize: 12 }}
        />
        <FieldLabel>Message</FieldLabel>
        <div className="row">
          <input
            value={chatMsg}
            onChange={(e) => setChatMsg(e.target.value)}
            onKeyDown={onChatKey}
            placeholder="Γεια σου Maa…"
            style={{ marginBottom: 0 }}
          />
          <button type="button" onClick={() => void sendChat()} style={{ whiteSpace: 'nowrap', flex: '0 0 auto' }}>
            ▶ Send
          </button>
        </div>
        {chatVisible && <div className="chat-result">{chatResult}</div>}
      </div>
    </div>
  )
}
