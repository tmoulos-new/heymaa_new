import { useMemo, useRef, useState } from 'react'
import { ConfirmDialog } from './ConfirmDialog'
import { FeatureUpgradeGate } from './FeatureUpgradeGate'
import {
  DOC_CATEGORIES,
  type DocCategoryKey,
  type DocEntry,
  type DocFile,
  docCategoryLabel,
  docCategoryMeta,
  downloadDocFile,
  formatDocDateDisplay,
  formatDocDateInput,
  newDocId,
  readDocFile,
} from '../lib/familyDocuments'
import type { FamilyChild, FamilyMemberRecord } from '../lib/familyData'
import { memberDisplayLabel, memberMemoryRef } from '../lib/familyData'
import { relationshipLabel } from '../lib/familyTree'
import { HmDateField } from './HmDateField'

type MemberRef = { label: string; value: string }

export function FamilyDocumentsPanel({
  lang,
  docs,
  onDocsChange,
  familyChildren,
  members,
  pregnancyActive,
  userName,
  featureAllowed = true,
  featureLabel,
  requiredPlanLabel,
  onUpgrade,
}: {
  lang: string
  docs: DocEntry[]
  onDocsChange: (next: DocEntry[]) => void
  familyChildren: FamilyChild[]
  members: FamilyMemberRecord[]
  pregnancyActive: boolean
  userName: string
  featureAllowed?: boolean
  featureLabel?: string
  requiredPlanLabel?: string
  onUpgrade?: () => void
}) {
  const el = lang === 'el'
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [filterRef, setFilterRef] = useState<string>('__all__')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [formCat, setFormCat] = useState<DocCategoryKey>('blood')
  const [formTitle, setFormTitle] = useState('')
  const [formDate, setFormDate] = useState(formatDocDateInput())
  const [formRef, setFormRef] = useState('')
  const [formProvider, setFormProvider] = useState('')
  const [formNote, setFormNote] = useState('')
  const [formFile, setFormFile] = useState<DocFile | null>(null)
  const [fileError, setFileError] = useState('')
  const [saving, setSaving] = useState(false)

  const copy = useMemo(
    () => ({
      title: el ? 'Αρχείο Εγγράφων' : 'Document Archive',
      subtitle: el ? 'Εξετάσεις · Εμβόλια · Συνταγές' : 'Tests · Vaccines · Prescriptions',
      empty: el ? 'Κανένα έγγραφο ακόμη' : 'No documents yet',
      emptyCta: el ? 'Καταχώρησε το πρώτο' : 'Add your first one',
      emptyFiltered: el ? 'Δεν υπάρχουν έγγραφα για αυτό το μέλος.' : 'No documents for this member.',
      add: el ? 'Νέο Έγγραφο' : 'New Document',
      edit: el ? 'Επεξεργασία Εγγράφου' : 'Edit Document',
      editBtn: el ? 'Επεξεργασία' : 'Edit',
      category: el ? 'Κατηγορία' : 'Category',
      titleLabel: el ? 'Τίτλος' : 'Title',
      titlePh: el ? 'π.χ. Γενική εξέταση αίματος' : 'e.g. General blood test',
      date: el ? 'Ημερομηνία' : 'Date',
      member: el ? 'Μέλος' : 'Member',
      memberPh: el ? 'Επίλεξε μέλος' : 'Select member',
      provider: el ? 'Γιατρός / Εργαστήριο' : 'Doctor / Lab',
      providerPh: el ? 'π.χ. Παιδίατρος · Δρ. Γεωργίου' : 'e.g. Pediatrician · Dr. Smith',
      note: el ? 'Σημείωση' : 'Note',
      notePh: el ? 'Αποτελέσματα, οδηγίες, επόμενο ραντεβού…' : 'Results, instructions, next appointment…',
      fileLabel: el ? 'Εύρεση εγγράφου (φωτογραφία / αρχείο)' : 'Attach document (photo / file)',
      fileBtn: el ? 'Πρόσθεσε φωτογραφία ή αρχείο' : 'Add photo or file',
      fileHint: el ? 'Έγγραφο, εξέταση, συνταγή…' : 'Document, test, prescription…',
      save: el ? 'Αποθήκευση' : 'Save',
      cancel: el ? 'Ακύρωση' : 'Cancel',
      download: el ? 'Λήψη' : 'Download',
      delete: el ? 'Διαγραφή' : 'Delete',
      deleteTitle: el ? 'Διαγραφή εγγράφου' : 'Delete document',
      removeFile: el ? 'Αφαίρεση αρχείου' : 'Remove file',
      all: el ? 'Όλα' : 'All',
      general: el ? 'Γενικά' : 'General',
      pregnancy: el ? 'Εγκυμοσύνη' : 'Pregnancy',
      you: el ? 'Εσύ' : 'You',
      fileTooLarge: el ? 'Το αρχείο είναι πολύ μεγάλο (max 4MB).' : 'File is too large (max 4MB).',
    }),
    [el],
  )

  const memberRefs = useMemo((): MemberRef[] => {
    const refs: MemberRef[] = [{ label: copy.general, value: '' }]
    if (pregnancyActive) refs.push({ label: copy.pregnancy, value: 'pregnancy' })
    refs.push({ label: copy.you, value: '__self__' })
    familyChildren.forEach((ch) => refs.push({ label: ch.name, value: ch.name }))
    members.forEach((m) =>
      refs.push({ label: memberDisplayLabel(m, members, relationshipLabel(m.relationship, lang)), value: memberMemoryRef(m.id) }),
    )
    return refs
  }, [copy, pregnancyActive, familyChildren, members, lang])

  const refLabel = (ref: string) => {
    if (!ref) return copy.general
    if (ref === 'pregnancy') return copy.pregnancy
    if (ref === '__self__') return userName || copy.you
    const child = familyChildren.find((c) => c.name === ref)
    if (child) return child.name
    const member = members.find((m) => memberMemoryRef(m.id) === ref)
    if (member) return memberDisplayLabel(member, members, relationshipLabel(member.relationship, lang))
    return ref
  }

  const filtered = useMemo(() => {
    const list =
      filterRef === '__all__' ? docs : docs.filter((d) => d.ref === filterRef)
    return [...list].sort((a, b) => {
      const da = a.date || a.addedDate
      const db = b.date || b.addedDate
      return db.localeCompare(da)
    })
  }, [docs, filterRef])

  const resetForm = () => {
    setEditingId(null)
    setFormCat('blood')
    setFormTitle('')
    setFormDate(formatDocDateInput())
    setFormRef(filterRef === '__all__' ? '' : filterRef)
    setFormProvider('')
    setFormNote('')
    setFormFile(null)
    setFileError('')
  }

  const closeForm = () => {
    setShowForm(false)
    resetForm()
  }

  const categoryKeyFromDoc = (category: string): DocCategoryKey => {
    const hit = DOC_CATEGORIES.find((c) => c.key === category)
    return hit ? hit.key : 'other'
  }

  const dateForInput = (date: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ''

  const openForm = () => {
    if (!featureAllowed) {
      onUpgrade?.()
      return
    }
    resetForm()
    setShowForm(true)
  }

  const openEdit = (doc: DocEntry) => {
    if (!featureAllowed) {
      onUpgrade?.()
      return
    }
    setEditingId(doc.id)
    setFormCat(categoryKeyFromDoc(doc.category))
    setFormTitle(doc.title)
    setFormDate(dateForInput(doc.date) || formatDocDateInput())
    setFormRef(doc.ref)
    setFormProvider(doc.provider || '')
    setFormNote(doc.note || '')
    setFormFile(doc.file || null)
    setFileError('')
    setShowForm(true)
  }

  const onPickFile = async (file: File | null) => {
    if (!file) return
    if (!featureAllowed) {
      onUpgrade?.()
      return
    }
    setFileError('')
    try {
      setSaving(true)
      const parsed = await readDocFile(file)
      setFormFile(parsed)
    } catch {
      setFileError(copy.fileTooLarge)
    } finally {
      setSaving(false)
    }
  }

  const saveDoc = () => {
    if (!formTitle.trim()) return
    if (editingId) {
      onDocsChange(
        docs.map((d) =>
          d.id === editingId
            ? {
                ...d,
                title: formTitle.trim(),
                date: formDate,
                category: formCat,
                ref: formRef,
                note: formNote.trim() || undefined,
                provider: formProvider.trim() || undefined,
                file: formFile || undefined,
              }
            : d,
        ),
      )
    } else {
      const entry: DocEntry = {
        id: newDocId(),
        title: formTitle.trim(),
        date: formDate,
        category: formCat,
        ref: formRef,
        addedDate: new Date().toLocaleDateString(lang, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        note: formNote.trim() || undefined,
        provider: formProvider.trim() || undefined,
        file: formFile || undefined,
      }
      onDocsChange([entry, ...docs])
    }
    closeForm()
  }

  const confirmDeleteDoc = () => {
    if (!deleteConfirmId) return
    onDocsChange(docs.filter((d) => d.id !== deleteConfirmId))
    setDeleteConfirmId(null)
    if (editingId === deleteConfirmId) closeForm()
  }

  const docPendingDelete = deleteConfirmId
    ? docs.find((d) => d.id === deleteConfirmId)
    : undefined

  return (
    <>
      <div className="hm-family-docs">
        <div className="hm-family-docs__head">
          <div>
            <div className="hm-family-docs__title">{copy.title}</div>
            <div className="hm-family-docs__subtitle">{copy.subtitle}</div>
          </div>
          <button
            type="button"
            className="hm-family-docs__add-btn"
            onClick={openForm}
            aria-label={featureAllowed ? copy.add : (el ? 'Upgrade' : 'Upgrade')}
          >
            +
          </button>
        </div>

        {!featureAllowed && featureLabel && requiredPlanLabel && onUpgrade ? (
          <FeatureUpgradeGate
            lang={lang}
            featureLabel={featureLabel}
            requiredPlanLabel={requiredPlanLabel}
            onUpgrade={onUpgrade}
          />
        ) : (
          <>
        {memberRefs.length > 2 && docs.length > 0 && (
          <div className="hm-family-docs__filters">
            <button
              type="button"
              className={`hm-family-docs__chip${filterRef === '__all__' ? ' hm-family-docs__chip--active' : ''}`}
              onClick={() => setFilterRef('__all__')}
            >
              {copy.all}
            </button>
            {memberRefs.map((r) => (
              <button
                key={r.value || '__general__'}
                type="button"
                className={`hm-family-docs__chip${filterRef === r.value ? ' hm-family-docs__chip--active' : ''}`}
                onClick={() => setFilterRef(r.value)}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        {docs.length === 0 ? (
          <div className="hm-family-docs__empty-state">
            <div className="hm-family-docs__empty-icon" aria-hidden="true">
              📁
            </div>
            <p className="hm-family-docs__empty-text">{copy.empty}</p>
            <button type="button" className="hm-family-docs__empty-cta" onClick={openForm}>
              {copy.emptyCta}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="hm-family-docs__empty">{copy.emptyFiltered}</div>
        ) : (
          <div className="hm-family-docs__list">
            {filtered.map((doc) => {
              const meta = docCategoryMeta(doc.category)
              return (
                <article key={doc.id} className="hm-family-docs__card">
                  <div className="hm-family-docs__card-top">
                    <div className="hm-family-docs__card-icon" style={{ background: meta.tint }}>
                      {meta.icon}
                    </div>
                    <div className="hm-family-docs__card-head">
                      <div className="hm-family-docs__card-title">{doc.title}</div>
                    </div>
                    <span className="hm-family-docs__card-badge">
                      {docCategoryLabel(doc.category, lang)}
                    </span>
                  </div>
                  <div className="hm-family-docs__card-meta">
                    {doc.date && (
                      <span className="hm-family-docs__meta-item">
                        <span aria-hidden="true">📅</span>
                        {formatDocDateDisplay(doc.date, lang)}
                      </span>
                    )}
                    <span className="hm-family-docs__meta-item">
                      <span aria-hidden="true">👤</span>
                      {refLabel(doc.ref)}
                    </span>
                    {doc.provider && (
                      <span className="hm-family-docs__meta-item">
                        <span aria-hidden="true">🏥</span>
                        {doc.provider}
                      </span>
                    )}
                  </div>
                  {doc.note && <div className="hm-family-docs__card-note">{doc.note}</div>}
                  {doc.file && (
                    <div className="hm-family-docs__preview">
                      {doc.file.mime.startsWith('image/') ? (
                        <img src={doc.file.dataUrl} alt="" className="hm-family-docs__preview-img" />
                      ) : (
                        <div className="hm-family-docs__preview-file">📎 {doc.file.name}</div>
                      )}
                    </div>
                  )}
                  <div className="hm-family-docs__card-actions">
                    <button
                      type="button"
                      className="hm-family-docs__action hm-family-docs__action--edit"
                      onClick={() => openEdit(doc)}
                    >
                      ✎ {copy.editBtn}
                    </button>
                    {doc.file && (
                      <button
                        type="button"
                        className="hm-family-docs__action hm-family-docs__action--download"
                        onClick={() => downloadDocFile(doc.file!)}
                      >
                        ↓ {copy.download}
                      </button>
                    )}
                    <button
                      type="button"
                      className="hm-family-docs__action hm-family-docs__action--delete"
                      onClick={() => setDeleteConfirmId(doc.id)}
                    >
                      🗑 {copy.delete}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
          </>
        )}
      </div>

      {showForm && (
        <div className="hm-sheet-overlay" onClick={closeForm}>
          <div
            className="hm-sheet-panel hm-sheet-panel--scroll hm-family-docs__sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hm-family-docs__sheet-head">
              <div className="hm-family-docs__sheet-title">
                {editingId ? copy.edit : copy.add}
              </div>
              <button
                type="button"
                className="hm-family-docs__sheet-close"
                onClick={closeForm}
                aria-label={copy.cancel}
              >
                ×
              </button>
            </div>

            <div className="hm-family-docs__field-label">{copy.category}</div>
            <div className="hm-family-docs__cat-grid">
              {DOC_CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`hm-family-docs__cat${formCat === c.key ? ' hm-family-docs__cat--active' : ''}`}
                  onClick={() => setFormCat(c.key)}
                >
                  <span className="hm-family-docs__cat-icon">{c.icon}</span>
                  <span>{el ? c.el : c.en}</span>
                </button>
              ))}
            </div>

            <label className="hm-family-docs__field-label">{copy.titleLabel}</label>
            <input
              className="hm-family-docs__input"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder={copy.titlePh}
            />

            <div className="hm-family-docs__row">
              <div className="hm-family-docs__col">
                <label className="hm-family-docs__field-label">{copy.date}</label>
                <HmDateField
                  lang={lang}
                  value={formDate}
                  onChange={setFormDate}
                  variant="cream"
                  ariaLabel={copy.date}
                />
              </div>
              <div className="hm-family-docs__col">
                <label className="hm-family-docs__field-label">{copy.member}</label>
                <select
                  className="hm-family-docs__input hm-family-docs__select"
                  value={formRef}
                  onChange={(e) => setFormRef(e.target.value)}
                >
                  {memberRefs.map((r) => (
                    <option key={r.value || '__general__'} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="hm-family-docs__field-label">{copy.provider}</label>
            <input
              className="hm-family-docs__input"
              value={formProvider}
              onChange={(e) => setFormProvider(e.target.value)}
              placeholder={copy.providerPh}
            />

            <label className="hm-family-docs__field-label">{copy.note}</label>
            <textarea
              className="hm-family-docs__input hm-family-docs__textarea"
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder={copy.notePh}
              rows={3}
            />

            <div className="hm-family-docs__field-label">{copy.fileLabel}</div>
            {!featureAllowed && featureLabel && requiredPlanLabel && onUpgrade ? (
              <FeatureUpgradeGate
                lang={lang}
                featureLabel={featureLabel}
                requiredPlanLabel={requiredPlanLabel}
                onUpgrade={onUpgrade}
                compact
              />
            ) : (
              <>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,application/pdf"
              className="hm-family-docs__file-input"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="hm-family-docs__upload"
              onClick={() => fileRef.current?.click()}
              disabled={saving}
            >
              <span className="hm-family-docs__upload-icon">📷</span>
              <span className="hm-family-docs__upload-title">
                {formFile ? formFile.name : copy.fileBtn}
              </span>
              <span className="hm-family-docs__upload-hint">{copy.fileHint}</span>
            </button>
            {fileError && <div className="hm-family-docs__file-error">{fileError}</div>}
            {formFile?.mime.startsWith('image/') && (
              <img src={formFile.dataUrl} alt="" className="hm-family-docs__upload-preview" />
            )}
            {formFile && (
              <button
                type="button"
                className="hm-family-docs__remove-file"
                onClick={() => setFormFile(null)}
              >
                {copy.removeFile}
              </button>
            )}
              </>
            )}

            <button
              type="button"
              className="hm-btn hm-btn--primary hm-family-docs__save"
              onClick={saveDoc}
              disabled={!formTitle.trim() || saving}
            >
              {copy.save}
            </button>
          </div>
        </div>
      )}

      {deleteConfirmId && docPendingDelete && (
        <ConfirmDialog
          open
          title={copy.deleteTitle}
          message={
            el
              ? `Είσαι σίγουρη/ος ότι θέλεις να διαγράψεις το «${docPendingDelete.title}»;`
              : `Are you sure you want to delete "${docPendingDelete.title}"?`
          }
          confirmLabel={copy.delete}
          cancelLabel={copy.cancel}
          variant="danger"
          onConfirm={confirmDeleteDoc}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}
    </>
  )
}
