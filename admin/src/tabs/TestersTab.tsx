import { useState } from 'react'
import { AlertTriangle, MailPlus } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { LANG_OPTIONS, TESTER_CODES } from '../lib/constants'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { apiDetail } from '../lib/api'

export function TestersTab({ onUsersChanged }: { onUsersChanged: () => void }) {
  const { adminFetch } = useAdmin()
  const { show, Message } = useFlashMessage()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState('starter')
  const [code, setCode] = useState('')
  const [lang, setLang] = useState('el')
  const [createSupabaseUser, setCreateSupabaseUser] = useState(false)
  const [deleteAllMsg, setDeleteAllMsg] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)
  const [sending, setSending] = useState(false)

  const canInvite = firstName.trim() && lastName.trim() && email.trim() && code

  const sendInvite = async () => {
    if (!canInvite) {
      show('Συμπλήρωσε όλα τα υποχρεωτικά πεδία (*)', 'err')
      return
    }
    setSending(true)
    show('Αποστολή…', 'info')
    try {
      const d = await adminFetch('/admin/invite_tester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          plan,
          invite_code: code,
          lang,
          create_supabase_user: createSupabaseUser,
        }),
      })
      if (d.ok) {
        show(
          createSupabaseUser
            ? d.email_sent
              ? `✅ Λογαριασμός Supabase δημιουργήθηκε — οδηγίες στάλθηκαν στο ${email}`
              : `✅ Λογαριασμός Supabase δημιουργήθηκε (${email}) — χωρίς email`
            : `✅ Πρόσκληση στάλθηκε στο ${email}`,
          'ok',
        )
        setFirstName('')
        setLastName('')
        setEmail('')
        setCode('')
        onUsersChanged()
      } else {
        show(`❌ ${apiDetail(d) || 'Αποτυχία'}`, 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    } finally {
      setSending(false)
    }
  }

  const deleteAll = async () => {
    if (!confirm('ΠΡΟΣΟΧΗ: Θα διαγραφούν ΟΛΟΙ οι χρήστες. Συνέχεια;')) return
    if (!confirm('Είσαι απολύτως σίγουρος; Αυτό δεν αναστρέφεται.')) return
    try {
      const d = await adminFetch('/admin/users/delete_all', { method: 'DELETE' })
      if (d.ok) {
        setDeleteAllMsg({ text: `✅ Διαγράφηκαν ${d.deleted} χρήστες.`, kind: 'ok' })
        onUsersChanged()
      } else {
        setDeleteAllMsg({ text: `❌ ${apiDetail(d) || 'Αποτυχία'}`, kind: 'err' })
      }
    } catch (e) {
      setDeleteAllMsg({ text: 'Network error', kind: 'err' })
      void e
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          <MailPlus size={16} className="h-icon" /> Πρόσκληση Testers
        </h2>
      </div>
      {Message}
      <div className="row">
        <div className="field-wrap">
          <FieldLabel required>Όνομα</FieldLabel>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Maria" />
        </div>
        <div className="field-wrap">
          <FieldLabel required>Επώνυμο</FieldLabel>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Papadopoulou" />
        </div>
      </div>
      <div className="row">
        <div className="field-wrap">
          <FieldLabel required>Email</FieldLabel>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@example.com" />
        </div>
        <div className="field-wrap">
          <FieldLabel>Plan</FieldLabel>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="starter">Starter</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field-wrap">
          <FieldLabel required>Κωδικός Εισόδου</FieldLabel>
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">-- Επιλογή --</option>
            {TESTER_CODES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field-wrap">
          <FieldLabel>Γλώσσα</FieldLabel>
          <select value={lang} onChange={(e) => setLang(e.target.value)}>
            {LANG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="checkbox-row" style={{ marginTop: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={createSupabaseUser}
            onChange={(e) => setCreateSupabaseUser(e.target.checked)}
          />
          Δημιουργία λογαριασμού Supabase Auth (χωρίς email από Supabase)
        </label>
      </div>
      {createSupabaseUser && (
        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
          Δημιουργεί χρήστη στο auth.users + public.users αμέσως — χωρίς Supabase invite/rate limit.
          Προαιρετικά στέλνει οδηγίες μέσω Resend. Ο tester ορίζει password με «Ξέχασα τον κωδικό».
        </p>
      )}
      <button
        type="button"
        style={{ width: '100%', marginTop: 4 }}
        disabled={!canInvite || sending}
        onClick={() => void sendInvite()}
      >
        {createSupabaseUser ? '🔐 Δημιουργία λογαριασμού →' : '📧 Αποστολή Πρόσκλησης →'}
      </button>

      <div className="danger-zone">
        <h3>
          <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Danger zone
        </h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Διαγράφει όλους τους χρήστες από τη βάση. Μη αναστρέψιμη ενέργεια.
        </p>
        <button type="button" className="del" style={{ width: '100%', padding: 11 }} onClick={() => void deleteAll()}>
          Διαγραφή Όλων των Χρηστών
        </button>
        {deleteAllMsg && (
          <div className={`msg ${deleteAllMsg.kind}`} style={{ marginTop: 10 }}>
            {deleteAllMsg.text}
          </div>
        )}
      </div>
    </div>
  )
}
