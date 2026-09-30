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
  const [deleteConfirm, setDeleteConfirm] = useState('')

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
    if (deleteConfirm.trim() !== 'DELETE ALL') {
      show('Type DELETE ALL to confirm', 'err')
      return
    }
    if (!confirm('Final confirmation: delete ALL users? This cannot be undone.')) return
    try {
      const d = await adminFetch('/admin/users/delete_all', { method: 'DELETE' })
      if (d.ok) {
        show(`Deleted ${d.deleted} users`, 'ok')
        setDeleteConfirm('')
        onUsersChanged()
      } else {
        show(apiDetail(d) || 'Failed', 'err')
      }
    } catch (e) {
      show(e instanceof Error ? e.message : 'Network error', 'err')
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          <MailPlus size={16} className="h-icon" /> Invite tester
        </h2>
      </div>
      <p className="card-desc">
        Creates a tester account and sends the HeyMaa invite email. Pick an <strong>active invite
        code</strong> from Invite Codes — that code is what they use to access the app in beta.
      </p>
      <div className="admin-howto" role="note">
        <div className="admin-howto-title">Steps</div>
        <ol className="admin-howto-steps">
          <li>
            <strong>Create a code</strong>
            <span>Invite Codes → New invite code (if you do not already have one).</span>
          </li>
          <li>
            <strong>Fill the form</strong>
            <span>Name, email, plan after sign-in, invite code, and app language.</span>
          </li>
          <li>
            <strong>Optional Auth account</strong>
            <span>Tick Supabase Auth to create a password login; otherwise email invite only.</span>
          </li>
        </ol>
      </div>
      <div className="row">
        <div className="field-wrap">
          <FieldLabel required>First name</FieldLabel>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Maria" />
        </div>
        <div className="field-wrap">
          <FieldLabel required>Last name</FieldLabel>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Papadopoulou" />
        </div>
      </div>
      <div className="row">
        <div className="field-wrap">
          <FieldLabel required>Email</FieldLabel>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="maria@example.com" />
        </div>
        <div className="field-wrap">
          <FieldLabel>Plan after sign-in</FieldLabel>
          <select value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="starter">Starter</option>
            <option value="premium">Premium</option>
          </select>
        </div>
      </div>
      <div className="row">
        <div className="field-wrap">
          <FieldLabel required>Invite code</FieldLabel>
          <select value={code} onChange={(e) => setCode(e.target.value)}>
            <option value="">— Select —</option>
            {inviteCodes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field-wrap">
          <FieldLabel>App language</FieldLabel>
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
          Also create a Supabase Auth account (no Supabase welcome email)
        </label>
      </div>
      {createSupabaseUser && (
        <>
          <div className="field-wrap" style={{ marginTop: 8 }}>
            <FieldLabel>Temporary password (optional)</FieldLabel>
            <input
              type="password"
              value={temporaryPassword}
              onChange={(e) => setTemporaryPassword(e.target.value)}
              placeholder="Min 6 characters — leave blank to use reset-password email"
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
              Require password change on first sign-in
            </label>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 8px' }}>
            With a temporary password: they can sign in immediately and set a new one in the app.
            Without one: they use &quot;Forgot password&quot; from email.
          </p>
        </>
      )}
      <button
        type="button"
        style={{ width: '100%', marginTop: 4 }}
        disabled={!canInvite || sending}
        onClick={() => void sendInvite()}
      >
        {createSupabaseUser ? 'Create account & invite →' : 'Send invite email →'}
      </button>

      <div className="danger-zone">
        <h3>
          <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 5 }} /> Danger zone
        </h3>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Deletes <strong>every</strong> user from the database. Do not use on production unless you
          intend a full wipe. Type <strong>DELETE ALL</strong> to enable.
        </p>
        <input
          type="text"
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder="DELETE ALL"
          autoComplete="off"
          style={{ marginBottom: 10, width: '100%' }}
        />
        <button
          type="button"
          className="del"
          style={{ width: '100%', padding: 11 }}
          disabled={deleteConfirm.trim() !== 'DELETE ALL'}
          onClick={() => void deleteAll()}
        >
          Delete all users
        </button>
      </div>
    </div>
  )
}
