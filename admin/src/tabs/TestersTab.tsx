import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, MailPlus } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { LANG_OPTIONS, TESTER_CODES } from '../lib/constants'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { apiDetail } from '../lib/api'
import type { InviteCodeRow } from '../lib/types'

export function TestersTab({ onUsersChanged }: { onUsersChanged: () => void }) {
  const { adminFetch } = useAdmin()
  const { show } = useFlashMessage()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [plan, setPlan] = useState('starter')
  const [code, setCode] = useState('')
  const [lang, setLang] = useState('el')
  const [createSupabaseUser, setCreateSupabaseUser] = useState(true)
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [requirePasswordChange, setRequirePasswordChange] = useState(true)
  const [sending, setSending] = useState(false)
  const [inviteCodes, setInviteCodes] = useState<string[]>(TESTER_CODES)

  const loadInviteCodes = useCallback(async () => {
    try {
      const d = await adminFetch('/admin/invite_codes')
      const rows = (d.codes as InviteCodeRow[]) || []
      const active = rows
        .filter((r) => r.status === 'active')
        .map((r) => r.code)
        .filter(Boolean)
      if (active.length) setInviteCodes(active)
    } catch {
      setInviteCodes(TESTER_CODES)
    }
  }, [adminFetch])

  useEffect(() => {
    void loadInviteCodes()
  }, [loadInviteCodes])

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
          temporary_password: temporaryPassword.trim() || null,
          require_password_change: requirePasswordChange,
        }),
      })
      if (!d.ok) {
        show(apiDetail(d) || 'Αποτυχία', 'err')
        return
      }
      const emailError = typeof d.email_error === 'string' ? d.email_error : ''
      if (d.user_created) {
        if (emailError) {
          show(`Λογαριασμός δημιουργήθηκε, αλλά το email απέτυχε: ${emailError}`, 'err')
        } else if (d.email_sent) {
          show(`Λογαριασμός δημιουργήθηκε — email στάλθηκε στο ${email}`, 'ok')
        } else {
          show(`Λογαριασμός δημιουργήθηκε (${email}) — χωρίς email`, 'ok')
        }
        onUsersChanged()
      } else if (emailError) {
        show(emailError, 'err')
      } else {
        show(`Πρόσκληση στάλθηκε στο ${email} (χωρίς λογαριασμό — ο χρήστης εγγράφεται μόνος του)`, 'ok')
      }
      if (d.user_created || !emailError) {
        setFirstName('')
        setLastName('')
        setEmail('')
        setCode('')
        setTemporaryPassword('')
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
        show(`Διαγράφηκαν ${d.deleted} χρήστες`, 'ok')
        onUsersChanged()
      } else {
        show(apiDetail(d) || 'Αποτυχία', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          <MailPlus size={16} className="h-icon" /> Πρόσκληση Testers
        </h2>
      </div>
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
            {inviteCodes.map((c) => (
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
        <>
          <div className="field-wrap" style={{ marginTop: 8 }}>
            <FieldLabel>Προσωρινός κωδικός (προαιρετικό)</FieldLabel>
            <input
              type="password"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="min 6 χαρακτήρες — αφήστε κενό για reset email"
              autoComplete="new-password"
            />
          </div>
          <div className="checkbox-row" style={{ marginTop: 4 }}>
            <label>
              <input
                type="checkbox"
                checked={requirePasswordChange}
                onChange={(e) => setRequirePasswordChange(e.target.checked)}
                disabled={!temporaryPassword.trim()}
              />
              Αλλαγή κωδικού στην πρώτη σύνδεση
            </label>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
            Με προσωρινό κωδικό: ο χρήστης συνδέεται αμέσως και ορίζει νέο κωδικό στο app.
            Χωρίς κωδικό: χρησιμοποιεί «Ξέχασα τον κωδικό» από το email.
          </p>
        </>
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
      </div>
    </div>
  )
}
