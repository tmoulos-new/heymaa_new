import { useAdmin } from '../context/AdminContext'
import { avatarBackground, userDisplayName, userInitials } from '../lib/userDisplay'

export function SidebarUser() {
  const { user } = useAdmin()

  if (!user) return null

  const label = userDisplayName(user.name, user.email)
  const tip = user.email || label

  return (
    <div className="sidebar-user" data-tip={tip} title={tip}>
      <div
        className="sidebar-user-avatar"
        style={{ background: avatarBackground(user.id) }}
        aria-hidden
      >
        {userInitials(user.name, user.email)}
      </div>
      <div className="sidebar-user-meta">
        <span className="sidebar-user-name">{label}</span>
        {user.email && <span className="sidebar-user-email">{user.email}</span>}
      </div>
    </div>
  )
}
