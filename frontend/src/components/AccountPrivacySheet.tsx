import { useEffect, useState } from 'react'
import { deleteAccount, exportAccountData } from '../lib/accountApi'
import { disablePush, enablePush, pushPermission, pushSupported } from '../lib/inboxNotifications'
import { isIosDevice, isStandaloneDisplay } from '../lib/pushAlerts'
import { AppDialog } from './AppDialog'
import { ConfirmDialog } from './ConfirmDialog'
import { DialogPanel } from './ui/DialogPanel'
import { SheetHeader } from './ui/SheetHeader'

type Props = {
  open: boolean
  lang: string
  token: string
  consentMarketing: boolean
  pushAlertsOptIn: boolean
  onConsentChange: (next: boolean) => Promise<boolean>
  onPushAlertsChange: (next: boolean) => Promise<boolean>
  onAccountDeleted: () => void | Promise<void>
  onClose: () => void
  onToast: (text: string, kind: 'ok' | 'err') => void
}

export function AccountPrivacySheet({
  open,
  lang,
  token,
  consentMarketing,
  pushAlertsOptIn,
  onConsentChange,
  onPushAlertsChange,
  onAccountDeleted,
  onClose,
  onToast,
}: Props) {
  const isEl = lang === 'el'
  const [marketing, setMarketing] = useState(consentMarketing)
  const [marketingSaving, setMarketingSaving] = useState(false)
  const [pushOptIn, setPushOptIn] = useState(pushAlertsOptIn)
  const [pushSaving, setPushSaving] = useState(false)
  const [pushState, setPushState] = useState(pushPermission)
  const [exporting, setExporting] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteErrors, setDeleteErrors] = useState<{ password?: string; confirm?: string }>({})
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    setMarketing(consentMarketing)
  }, [consentMarketing])
  useEffect(() => {
    setPushOptIn(pushAlertsOptIn)
  }, [pushAlertsOptIn])
  useEffect(() => {
    setPushState(pushPermission())
  }, [open])

  const confirmPhrase = isEl ? 'ΔΙΑΓΡΑΦΗ' : 'DELETE'
  const needsHomeScreen = isIosDevice() && !isStandaloneDisplay()

  const toggleMarketing = async () => {
    const next = !marketing
    setMarketingSaving(true)
    const ok = await onConsentChange(next)
    setMarketingSaving(false)
    if (ok) {
      setMarketing(next)
      onToast(isEl ? 'Οι προτιμήσεις marketing ενημερώθηκαν.' : 'Marketing preferences updated.', 'ok')
    } else {
      onToast(isEl ? 'Αποτυχία αποθήκευσης.' : 'Could not save preferences.', 'err')
    }
  }

  const togglePush = async () => {
    setPushSaving(true)
    try {
      if (pushState === 'granted' || pushOptIn) {
        await disablePush(token)
        const ok = await onPushAlertsChange(false)
        if (ok) setPushOptIn(false)
        setPushState(pushPermission())
        onToast(isEl ? 'Οι ειδοποιήσεις απενεργοποιήθηκαν.' : 'Phone alerts turned off.', 'ok')
      } else if (needsHomeScreen) {
        const ok = await onPushAlertsChange(true)
        if (ok) setPushOptIn(true)
        onToast(
          isEl
            ? 'Πρόσθεσε την HeyMaa στην Αρχική οθόνη και άνοιξέ την από εκεί για ειδοποιήσεις.'
            : 'Add HeyMaa to your Home Screen and open it from there to enable alerts.',
          'ok',
        )
      } else {
        const result = await enablePush(token)
        setPushState(result === 'unsupported' ? 'unsupported' : result)
        const ok = await onPushAlertsChange(result === 'granted')
        if (ok) setPushOptIn(result === 'granted')
        onToast(
          result === 'granted'
            ? (isEl ? 'Οι ειδοποιήσεις ενεργοποιήθηκαν.' : 'Phone alerts enabled.')
            : (isEl ? 'Η άδεια ειδοποιήσεων δεν δόθηκε.' : 'Notification permission was not granted.'),
          result === 'granted' ? 'ok' : 'err',
        )
      }
    } catch {
      onToast(isEl ? 'Αποτυχία αποθήκευσης.' : 'Could not save preferences.', 'err')
    } finally {
      setPushSaving(false)
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportAccountData(token)
      onToast(isEl ? 'Τα δεδομένα σου κατέβηκαν.' : 'Your data download started.', 'ok')
    } catch (e) {
      onToast(e instanceof Error ? e.message : isEl ? 'Αποτυχία εξαγωγής.' : 'Export failed.', 'err')
    } finally {
      setExporting(false)
    }
  }

  const validateDeleteForm = (): boolean => {
    const errors: { password?: string; confirm?: string } = {}
    if (deletePassword.length < 6) {
      errors.password = isEl ? 'Βάλε τον κωδικό σου.' : 'Enter your password.'
    }
    if (deleteConfirm.trim().toUpperCase() !== confirmPhrase) {
      errors.confirm = isEl ? `Γράψε ${confirmPhrase} για επιβεβαίωση.` : `Type ${confirmPhrase} to confirm.`
    }
    setDeleteErrors(errors)
    return Object.keys(errors).length === 0
  }

  const requestDelete = () => {
    if (!validateDeleteForm()) return
    setShowDeleteConfirm(true)
  }

  const performDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount(token, deletePassword)
      setShowDeleteConfirm(false)
      await onAccountDeleted()
    } catch (e) {
      setShowDeleteConfirm(false)
      onToast(e instanceof Error ? e.message : isEl ? 'Αποτυχία διαγραφής.' : 'Delete failed.', 'err')
      setDeleting(false)
    }
  }

  return (
    <>
      <AppDialog
        open={open}
        onClose={onClose}
        size="md"
        ariaLabel={isEl ? 'Απόρρητο & δεδομένα' : 'Privacy & data'}
        closeOnBackdrop={!deleting}
        panelClassName="hm-privacy-dialog"
      >
        <DialogPanel variant="cream" padding="md" className="hm-privacy-panel">
          <SheetHeader
            title={isEl ? 'Απόρρητο & δεδομένα' : 'Privacy & data'}
            subtitle={isEl ? 'Διαχείριση συγκαταθέσεων και λογαριασμού' : 'Manage consents and your account'}
            onBack={onClose}
            backLabel={isEl ? 'Πίσω' : 'Back'}
          />

          <div className="hm-privacy-grid">
          <section className="hm-panel-section">
            <div className="hm-section-label">
              {isEl ? 'ΕΠΙΚΟΙΝΩΝΙΑ MARKETING' : 'MARKETING'}
            </div>
            <label className="hm-checkbox-label">
              <input
                type="checkbox"
                checked={marketing}
                disabled={marketingSaving}
                onChange={() => void toggleMarketing()}
              />
              <span>
                {isEl
                  ? 'Συναινώ σε εξατομικευμένες προσφορές από την Care Direct (GDPR).'
                  : 'I agree to receive personalised offers from Care Direct (GDPR).'}
              </span>
            </label>
          </section>

          {pushSupported() ? (
            <section className="hm-panel-section">
              <div className="hm-section-label">
                {isEl ? 'ΕΙΔΟΠΟΙΗΣΕΙΣ ΚΙΝΗΤΟΥ' : 'PHONE ALERTS'}
              </div>
              <p className="hm-dialog-subtitle" style={{ marginBottom: 12 }}>
                {needsHomeScreen
                  ? (isEl
                    ? 'Στο iPhone χρειάζεται «Προσθήκη στην αρχική οθόνη». Μετά μπορείς να επιτρέψεις ειδοποιήσεις κλειδώματος.'
                    : 'On iPhone, add HeyMaa to the Home Screen first. Then you can allow lock-screen alerts.')
                  : (isEl
                    ? 'Μηνύματα ακόμα και όταν η εφαρμογή είναι κλειστή (οθόνη κλειδώματος / μπάρα ειδοποιήσεων).'
                    : 'Messages even when the app is closed (lock screen / notification tray).')}
              </p>
              <label className="hm-checkbox-label">
                <input
                  type="checkbox"
                  checked={pushOptIn || pushState === 'granted'}
                  disabled={pushSaving || pushState === 'unsupported'}
                  onChange={() => void togglePush()}
                />
                <span>
                  {pushState === 'denied'
                    ? (isEl
                      ? 'Έχεις μπλοκάρει τις ειδοποιήσεις στο πρόγραμμα περιήγησης — άλλαξέ το από τις ρυθμίσεις του browser.'
                      : 'Notifications are blocked in the browser — change this in browser settings.')
                    : (isEl ? 'Επιτρέπω ειδοποιήσεις στο κινητό' : 'Allow phone alerts')}
                </span>
              </label>
            </section>
          ) : null}

          <section className="hm-panel-section">
            <div className="hm-section-label">
              {isEl ? 'COOKIES' : 'COOKIES'}
            </div>
            <p className="hm-dialog-subtitle" style={{ marginBottom: 12 }}>
              {isEl
                ? 'Διαχειρίσου τα προαιρετικά cookies στατιστικών (Google Tag Manager / Analytics).'
                : 'Manage optional statistics cookies (Google Tag Manager / Analytics).'}
            </p>
            <button
              type="button"
              className="hm-btn hm-btn--outline hm-btn--block"
              onClick={() => {
                onClose()
                void import('../lib/cookieConsent').then((m) => m.openCookieSettings())
              }}
            >
              {isEl ? 'Ρυθμίσεις cookies' : 'Cookie settings'}
            </button>
          </section>

          <section className="hm-panel-section">
            <div className="hm-section-label">
              {isEl ? 'ΕΞΑΓΩΓΗ ΔΕΔΟΜΕΝΩΝ' : 'DATA EXPORT'}
            </div>
            <p className="hm-dialog-subtitle" style={{ marginBottom: 12 }}>
              {isEl
                ? 'Κατέβασε αντίγραφο του προφίλ, των αναμνήσεων και των δεδομένων σου (JSON).'
                : 'Download a copy of your profile, memories, and app data (JSON).'}
            </p>
            <button
              type="button"
              onClick={() => void handleExport()}
              disabled={exporting}
              className="hm-btn hm-btn--outline hm-btn--block"
            >
              {exporting
                ? (isEl ? 'Εξαγωγή…' : 'Exporting…')
                : (isEl ? 'Λήψη των δεδομένων μου' : 'Download my data')}
            </button>
          </section>

          <section className="hm-panel-section" style={{ marginBottom: 0 }}>
            <div className="hm-section-label hm-section-label--danger">
              {isEl ? 'ΔΙΑΓΡΑΦΗ ΛΟΓΑΡΙΑΣΜΟΥ' : 'DELETE ACCOUNT'}
            </div>
            <p className="hm-dialog-subtitle" style={{ marginBottom: 12 }}>
              {isEl
                ? 'Η ενέργεια είναι μόνιμη. Όλα τα δεδομένα σου θα διαγραφούν.'
                : 'This is permanent. All your data will be removed.'}
            </p>
            <input
              type="password"
              className={`hm-input${deleteErrors.password ? ' hm-input--invalid' : ''}`}
              value={deletePassword}
              onChange={(e) => {
                setDeletePassword(e.target.value)
                if (deleteErrors.password) setDeleteErrors((prev) => ({ ...prev, password: undefined }))
              }}
              placeholder={isEl ? 'Κωδικός σου' : 'Your password'}
              autoComplete="current-password"
              aria-invalid={!!deleteErrors.password}
              aria-describedby={deleteErrors.password ? 'delete-password-error' : undefined}
              style={{ marginBottom: deleteErrors.password ? 4 : 10, background: 'var(--hm-cream)' }}
            />
            {deleteErrors.password ? (
              <p id="delete-password-error" className="hm-field-error" role="alert" style={{ marginBottom: 10 }}>
                {deleteErrors.password}
              </p>
            ) : null}
            <input
              type="text"
              className={`hm-input${deleteErrors.confirm ? ' hm-input--invalid' : ''}`}
              value={deleteConfirm}
              onChange={(e) => {
                setDeleteConfirm(e.target.value)
                if (deleteErrors.confirm) setDeleteErrors((prev) => ({ ...prev, confirm: undefined }))
              }}
              placeholder={isEl ? `Γράψε ${confirmPhrase} για επιβεβαίωση` : `Type ${confirmPhrase} to confirm`}
              aria-invalid={!!deleteErrors.confirm}
              aria-describedby={deleteErrors.confirm ? 'delete-confirm-error' : undefined}
              style={{ marginBottom: deleteErrors.confirm ? 4 : 12, background: 'var(--hm-cream)' }}
            />
            {deleteErrors.confirm ? (
              <p id="delete-confirm-error" className="hm-field-error" role="alert" style={{ marginBottom: 12 }}>
                {deleteErrors.confirm}
              </p>
            ) : null}
            <button
              type="button"
              onClick={requestDelete}
              disabled={deleting}
              className="hm-btn hm-btn--destructive hm-btn--block"
            >
              {isEl ? 'Διαγραφή λογαριασμού' : 'Delete my account'}
            </button>
          </section>
          </div>
        </DialogPanel>
      </AppDialog>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={isEl ? 'Οριστική διαγραφή;' : 'Delete permanently?'}
        message={
          isEl
            ? 'Όλα τα δεδομένα σου θα διαγραφούν και δεν μπορείς να τα ανακτήσεις.'
            : 'All your data will be removed and cannot be recovered.'
        }
        confirmLabel={deleting ? (isEl ? 'Διαγραφή…' : 'Deleting…') : (isEl ? 'Ναι, διαγραφή' : 'Yes, delete')}
        cancelLabel={isEl ? 'Ακύρωση' : 'Cancel'}
        variant="danger"
        loading={deleting}
        onConfirm={() => void performDelete()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
