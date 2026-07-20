import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Database, RefreshCw, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel } from '../components/ui'
import { ValuePairs } from '../components/ValuePairs'
import { pathForTab } from '../lib/constants'
import { formatUserDataJson, parseUserDataValue } from '../lib/parseUserDataValue'
import {
  orderedUserDataKeys,
  userDataKeyIcon,
  userDataKeyLabel,
  USER_DATA_KEYS,
} from '../lib/userDataKeys'
import { userDataKeyCount } from '../lib/userDataKeyCount'
import type { UserRow } from '../lib/types'

type UserDataMeta = Record<string, { updated_at?: string | null }>

interface FamilyChild {
  name: string
  birthDate?: string
  birth_date?: string
  photo?: string
}

interface FamilyMember {
  id?: string
  name: string
  relationship?: string
  role?: string
  relatedTo?: string
  related_to?: string
  email?: string
  phone?: string
  birthDate?: string
  birth_date?: string
  note?: string
  photo?: string
}

function formatWhen(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

function EmptyKey({ label }: { label: string }) {
  return <div className="empty">No {label.toLowerCase()} data saved for this user.</div>
}

function FamilyPanel({ value }: { value: unknown }) {
  const parsed = parseUserDataValue(value)
  if (!parsed) return <EmptyKey label="family" />

  let children: FamilyChild[] = []
  let members: FamilyMember[] = []
  let selfPhoto: string | undefined

  if (Array.isArray(parsed)) {
    members = parsed as FamilyMember[]
  } else if (typeof parsed === 'object') {
    const o = parsed as {
      children?: FamilyChild[]
      members?: FamilyMember[]
      selfPhoto?: string
    }
    children = Array.isArray(o.children) ? o.children : []
    members = Array.isArray(o.members) ? o.members : []
    if (typeof o.selfPhoto === 'string' && o.selfPhoto.trim()) selfPhoto = o.selfPhoto.trim()
  }

  if (children.length === 0 && members.length === 0 && !selfPhoto) {
    return <EmptyKey label="family" />
  }

  return (
    <div className="user-data-panels">
      {selfPhoto && (
        <section className="user-data-section">
          <h3>Self photo</h3>
          <FamilyPhotoThumb src={selfPhoto} />
        </section>
      )}
      {children.length > 0 && (
        <section className="user-data-section">
          <h3>Children</h3>
          <div className="table-wrap">
            <table className="data-table user-data-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Birth date</th>
                </tr>
              </thead>
              <tbody>
                {children.map((c, i) => (
                  <tr key={i}>
                    <td><FamilyPhotoThumb src={c.photo} /></td>
                    <td>{c.name || '—'}</td>
                    <td>{c.birthDate || c.birth_date || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {members.length > 0 && (
        <section className="user-data-section">
          <h3>Members</h3>
          <div className="table-wrap">
            <table className="data-table user-data-table">
              <thead>
                <tr>
                  <th>Photo</th>
                  <th>Name</th>
                  <th>Relationship</th>
                  <th>Related to</th>
                  <th>Birth date</th>
                  <th>Note</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Id</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id || i}>
                    <td><FamilyPhotoThumb src={m.photo} /></td>
                    <td>{m.name || '—'}</td>
                    <td>{m.relationship || m.role || '—'}</td>
                    <td>{m.relatedTo || m.related_to || '—'}</td>
                    <td>{m.birthDate || m.birth_date || '—'}</td>
                    <td>{m.note || '—'}</td>
                    <td>{m.email || '—'}</td>
                    <td>{m.phone || '—'}</td>
                    <td style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11 }}>{m.id || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function isImageSrc(val: unknown): val is string {
  if (typeof val !== 'string' || !val.trim()) return false
  return (
    val.startsWith('data:image/') ||
    val.startsWith('http://') ||
    val.startsWith('https://') ||
    val.startsWith('blob:') ||
    val.startsWith('/')
  )
}

function FamilyPhotoThumb({ src }: { src?: string }) {
  if (!isImageSrc(src)) return <span className="user-data-family-photo-empty">—</span>
  return (
    <span className="user-data-family-photo">
      <img src={src} alt="" />
    </span>
  )
}


interface MemoryItem {
  emoji?: string
  text?: string
  date?: string
  img?: string
  ref?: string
  createdAt?: string
}

function MemoriesPanel({ value }: { value: unknown }) {
  const parsed = parseUserDataValue(value)
  const memories = Array.isArray(parsed) ? (parsed as MemoryItem[]) : []
  if (memories.length === 0) return <EmptyKey label="memories" />

  return (
    <div className="user-data-memories">
      {memories.map((m, i) => {
        const hasImg = isImageSrc(m.img)
        const displayText = m.text && m.text !== '📷' ? m.text : ''
        return (
          <div key={i} className="user-data-memory">
            <div className="user-data-memory-head">
              <div className="user-data-memory-thumb">
                {hasImg ? (
                  <img src={m.img} alt="" />
                ) : (
                  <span>{m.emoji || '🤍'}</span>
                )}
              </div>
              <div className="user-data-memory-meta">
                {m.ref && <div className="user-data-memory-ref">{m.ref}</div>}
                {displayText && <div className="user-data-memory-text">{displayText}</div>}
                {m.date && <div className="user-data-memory-date">{m.date}</div>}
                {m.createdAt && <div className="user-data-memory-date">{new Date(m.createdAt).toLocaleString()}</div>}
                {!displayText && !hasImg && m.emoji && (
                  <div className="user-data-memory-emoji-only">{m.emoji}</div>
                )}
              </div>
            </div>
            {hasImg && (
              <img src={m.img} alt="Memory" className="user-data-memory-img" />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ChatPanel({ value }: { value: unknown }) {
  const parsed = parseUserDataValue(value)
  const messages = Array.isArray(parsed) ? parsed : []
  if (messages.length === 0) return <EmptyKey label="chat" />

  return (
    <div className="user-data-chat">
      {messages.map((m, i) => {
        const msg = m as { role?: string; content?: string }
        const role = msg.role || 'unknown'
        return (
          <div key={i} className={`user-data-chat-msg user-data-chat-${role}`}>
            <div className="user-data-chat-role">{role}</div>
            <div className="user-data-chat-body">{msg.content || '—'}</div>
          </div>
        )
      })}
    </div>
  )
}

function ListPanel({
  value,
  label,
  fields,
}: {
  value: unknown
  label: string
  fields?: string[]
}) {
  const parsed = parseUserDataValue(value)
  if (parsed == null || parsed === '') return <EmptyKey label={label} />

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return <EmptyKey label={label} />
    if (parsed.every((v) => typeof v === 'string')) {
      return (
        <ul className="user-data-list">
          {parsed.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      )
    }
    return (
      <div className="user-data-cards">
        {parsed.map((item, i) => (
          <div key={i} className="user-data-card">
            {typeof item === 'object' && item !== null ? (
              <ValuePairs value={item as Record<string, unknown>} />
            ) : (
              String(item)
            )}
          </div>
        ))}
      </div>
    )
  }

  if (typeof parsed === 'object') {
    if (fields) {
      const rows = Object.entries(parsed as Record<string, unknown>)
      if (rows.length === 0) return <EmptyKey label={label} />
      return (
        <div className="user-data-cards">
          {rows.map(([ref, checks]) => (
            <div key={ref} className="user-data-card">
              <div className="user-data-card-title">{ref}</div>
              {Array.isArray(checks) ? (
                <div className="user-data-checks">
                  {checks.map((on, idx) => (
                    <span key={idx} className={on ? 'check on' : 'check'}>
                      {idx + 1}
                    </span>
                  ))}
                </div>
              ) : (
                <ValuePairs value={checks as Record<string, unknown>} nested />
              )}
            </div>
          ))}
        </div>
      )
    }
    return <ValuePairs value={parsed as Record<string, unknown>} />
  }

  return <pre className="user-data-json">{String(parsed)}</pre>
}

function KeyPanel({ keyId, value }: { keyId: string; value: unknown }) {
  if (value == null || value === '') {
    return <EmptyKey label={userDataKeyLabel(keyId)} />
  }

  switch (keyId) {
    case 'family':
      return <FamilyPanel value={value} />
    case 'chat':
      return <ChatPanel value={value} />
    case 'threads':
      return <ListPanel value={value} label="threads" />
    case 'memories':
      return <MemoriesPanel value={value} />
    case 'docs':
      return <ListPanel value={value} label={userDataKeyLabel(keyId)} />
    case 'shopitems':
    case 'superitems':
      return <ListPanel value={value} label={userDataKeyLabel(keyId)} />
    case 'milestones_map':
      return <ListPanel value={value} label="milestones" fields={['ref']} />
    case 'ttsused':
    case 'phone':
      return <pre className="user-data-json">{formatUserDataJson(parseUserDataValue(value))}</pre>
    default:
      return <pre className="user-data-json">{formatUserDataJson(parseUserDataValue(value))}</pre>
  }
}

export function UserDataTab() {
  const { adminFetch } = useAdmin()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [users, setUsers] = useState<UserRow[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userId, setUserId] = useState(() => searchParams.get('user') || '')
  const [inviteToken, setInviteToken] = useState('')
  const [data, setData] = useState<Record<string, unknown>>({})
  const [meta, setMeta] = useState<UserDataMeta>({})
  const [transactionCounts, setTransactionCounts] = useState<Record<string, number>>({})
  const [activeKey, setActiveKey] = useState<string>(USER_DATA_KEYS[0].id)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState(false)
  const [userQuery, setUserQuery] = useState('')

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const d = await adminFetch('/admin/users')
      setUsers((d.users as UserRow[]) || [])
    } catch {
      setUsers([])
    } finally {
      setUsersLoading(false)
    }
  }, [adminFetch])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  useEffect(() => {
    const fromUrl = searchParams.get('user') || ''
    setUserId(fromUrl)
    if (fromUrl) setInviteToken('')
  }, [searchParams])

  const selectUser = (id: string) => {
    setUserId(id)
    setInviteToken('')
    if (id) {
      setSearchParams({ user: id }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }

  const loadData = useCallback(async () => {
    const token = inviteToken.trim()
    if (!userId && !token) {
      setData({})
      setMeta({})
      setTransactionCounts({})
      return
    }
    setLoading(true)
    setErr(false)
    try {
      const qs = new URLSearchParams()
      if (userId) qs.set('user_id', userId)
      else if (token) qs.set('token', token)
      const d = await adminFetch(`/admin/user_data?${qs.toString()}`)
      const nextData = (d.data as Record<string, unknown>) || {}
      setData(nextData)
      setMeta((d.meta as UserDataMeta) || {})
      setTransactionCounts((d.transaction_counts as Record<string, number>) || {})
      const keys = orderedUserDataKeys(Object.keys(nextData))
      setActiveKey((prev) => (keys.includes(prev) ? prev : keys[0] || USER_DATA_KEYS[0].id))
    } catch {
      setErr(true)
      setData({})
      setMeta({})
      setTransactionCounts({})
    } finally {
      setLoading(false)
    }
  }, [adminFetch, userId, inviteToken])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q),
    )
  }, [users, userQuery])

  const tabKeys = useMemo(() => {
    const fromData = Object.keys(data)
    if (fromData.length === 0) return USER_DATA_KEYS.map((k) => k.id)
    return orderedUserDataKeys(fromData)
  }, [data])

  const selectedUser = users.find((u) => u.id === userId)
  const updatedAt = meta[activeKey]?.updated_at

  return (
    <div className="card">
      <div className="card-head">
        <h2>
          <Database size={16} className="h-icon" /> User Data
        </h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {userId && (
            <button
              type="button"
              className="ghost sm"
              onClick={() => navigate(pathForTab('users'))}
            >
              <ArrowLeft size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Back to users
            </button>
          )}
          <button
            type="button"
            className="sec sm"
            onClick={() => {
              void loadUsers()
              void loadData()
            }}
            disabled={loading}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <p className="card-desc">
        Browse persisted app data from the <code>user_data</code> table — chat, family,
        memories, milestones, and more.
      </p>

      <div className="user-data-filters">
        <div className="field-wrap">
          <FieldLabel>User</FieldLabel>
          <div className="search-wrap">
            <Search className="search-icon" size={16} />
            <input
              type="search"
              placeholder="Filter users…"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              disabled={usersLoading}
            />
          </div>
          <select
            value={userId}
            onChange={(e) => selectUser(e.target.value)}
            disabled={usersLoading}
          >
            <option value="">Select a user…</option>
            {filteredUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name || u.email}
                {u.email && u.name ? ` (${u.email})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field-wrap">
          <FieldLabel>Invite token (optional)</FieldLabel>
          <input
            value={inviteToken}
            onChange={(e) => {
              setInviteToken(e.target.value)
              if (e.target.value.trim()) {
                setUserId('')
                setSearchParams({}, { replace: true })
              }
            }}
            placeholder="Beta / invite token"
          />
        </div>
      </div>

      {!userId && !inviteToken.trim() && (
        <div className="empty">Select a user or enter an invite token to view their data.</div>
      )}

      {(userId || inviteToken.trim()) && loading && <div className="empty">Loading…</div>}
      {(userId || inviteToken.trim()) && err && !loading && (
        <div className="msg err">Failed to load user data</div>
      )}

      {(userId || inviteToken.trim()) && !loading && !err && (
        <>
          <div className="user-data-subject">
            {selectedUser ? (
              <>
                <strong>{selectedUser.name || selectedUser.email}</strong>
                {selectedUser.email && selectedUser.name && (
                  <span className="user-data-subject-meta"> · {selectedUser.email}</span>
                )}
              </>
            ) : (
              <strong>Token: {inviteToken.trim()}</strong>
            )}
            {updatedAt && (
              <span className="user-data-subject-meta">
                {' '}
                · Updated {formatWhen(updatedAt)}
              </span>
            )}
          </div>

          <div className="user-data-key-tabs" role="tablist">
            {tabKeys.map((keyId) => {
              const hasData = Object.prototype.hasOwnProperty.call(data, keyId)
              const itemCount = hasData ? userDataKeyCount(keyId, data[keyId]) : 0
              const txCount = transactionCounts[keyId] || 0
              const badgeCount = Math.max(itemCount, txCount)
              return (
                <button
                  key={keyId}
                  type="button"
                  role="tab"
                  aria-selected={activeKey === keyId}
                  className={`user-data-key-tab${activeKey === keyId ? ' active' : ''}${hasData ? '' : ' empty-key'}`}
                  onClick={() => setActiveKey(keyId)}
                >
                  <span className="user-data-key-icon">{userDataKeyIcon(keyId)}</span>
                  {userDataKeyLabel(keyId)}
                  {badgeCount > 0 && (
                    <span
                      className="user-data-key-badge"
                      title={
                        txCount > 0 && itemCount !== txCount
                          ? `${itemCount} items · ${txCount} point transactions`
                          : txCount > 0
                            ? `${txCount} point transactions`
                            : `${itemCount} items`
                      }
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="user-data-panel" role="tabpanel">
            <KeyPanel keyId={activeKey} value={data[activeKey]} />
          </div>
        </>
      )}
    </div>
  )
}
