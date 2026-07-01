import { useCallback, useEffect, useState } from 'react'
import {
  ChevronsLeft,
  Globe2,
  LayoutDashboard,
  LogOut,
  KeyRound,
  MailPlus,
  Megaphone,
  Menu,
  RefreshCw,
  Users,
  Wrench,
} from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import { TAB_TITLES, type TabId } from '../lib/constants'
import { OverviewTab } from '../tabs/OverviewTab'
import { TestersTab } from '../tabs/TestersTab'
import { ContentTab } from '../tabs/ContentTab'
import { UsersTab } from '../tabs/UsersTab'
import { InviteCodesTab } from '../tabs/InviteCodesTab'
import { RegionsTab } from '../tabs/RegionsTab'
import { ToolsTab } from '../tabs/ToolsTab'

const NAV: { id: TabId; icon: typeof LayoutDashboard; tip: string }[] = [
  { id: 'overview', icon: LayoutDashboard, tip: 'Overview' },
  { id: 'testers', icon: MailPlus, tip: 'Testers' },
  { id: 'invites', icon: KeyRound, tip: 'Invite Codes' },
  { id: 'regions', icon: Globe2, tip: 'Regions' },
  { id: 'content', icon: Megaphone, tip: 'Offers & Promos' },
  { id: 'users', icon: Users, tip: 'Users' },
  { id: 'tools', icon: Wrench, tip: 'Tools' },
]

export function AdminShell() {
  const { logout } = useAdmin()
  const [tab, setTab] = useState<TabId>(
    () => (sessionStorage.getItem('hm_admin_tab') as TabId) || 'overview',
  )
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('hm_admin_collapsed') === '1',
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userCount, setUserCount] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const switchTab = (id: TabId) => {
    setTab(id)
    sessionStorage.setItem('hm_admin_tab', id)
    setSidebarOpen(false)
  }

  const toggleCollapse = () => {
    if (window.innerWidth <= 768) return
    setCollapsed((c) => {
      const next = !c
      localStorage.setItem('hm_admin_collapsed', next ? '1' : '0')
      return next
    })
  }

  const refreshAll = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const onUserCount = useCallback((n: number) => setUserCount(n), [])

  useEffect(() => {
    if (collapsed && window.innerWidth <= 768) setCollapsed(false)
  }, [collapsed])

  return (
    <div className="shell">
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        onKeyDown={() => {}}
        role="presentation"
      />

      <aside className={`sidebar${collapsed ? ' collapsed' : ''}${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-head">
          <div className="sidebar-brand">
            <span className="brand-mark">H</span>
            <span className="brand-text">
              Hey<span>Maa</span>
            </span>
          </div>
          <button
            type="button"
            className="icon-btn collapse-btn"
            onClick={toggleCollapse}
            data-tip={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <ChevronsLeft size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map(({ id, icon: Icon, tip }) => (
            <button
              key={id}
              type="button"
              className={tab === id ? 'active' : ''}
              data-tab={id}
              data-tip={tip}
              onClick={() => switchTab(id)}
            >
              <Icon className="nav-icon" size={18} strokeWidth={2} />
              <span className="nav-label">{TAB_TITLES[id]}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button type="button" className="sec sm sidebar-action" data-tip="Refresh all" onClick={refreshAll}>
            <RefreshCw size={16} />
            <span className="action-label">Refresh all</span>
          </button>
          <button type="button" className="ghost sm sidebar-action" data-tip="Sign out" onClick={logout}>
            <LogOut size={16} />
            <span className="action-label">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="content-wrap">
        <header className="content-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h1>{TAB_TITLES[tab]}</h1>
          </div>
        </header>

        <main className="main">
          <section className={`section${tab === 'overview' ? ' active' : ''}`}>
            <OverviewTab key={`ov-${refreshKey}`} userCount={userCount} />
          </section>
          <section className={`section${tab === 'testers' ? ' active' : ''}`}>
            <TestersTab key={`te-${refreshKey}`} onUsersChanged={refreshAll} />
          </section>
          <section className={`section${tab === 'invites' ? ' active' : ''}`}>
            <InviteCodesTab key={`ic-${refreshKey}`} />
          </section>
          <section className={`section${tab === 'regions' ? ' active' : ''}`}>
            <RegionsTab key={`rg-${refreshKey}`} />
          </section>
          <section className={`section${tab === 'content' ? ' active' : ''}`}>
            <ContentTab key={`co-${refreshKey}`} />
          </section>
          <section className={`section${tab === 'users' ? ' active' : ''}`}>
            <UsersTab key={`us-${refreshKey}`} onCount={onUserCount} />
          </section>
          <section className={`section${tab === 'tools' ? ' active' : ''}`}>
            <ToolsTab key={`to-${refreshKey}`} onSeeded={refreshAll} />
          </section>
        </main>
      </div>
    </div>
  )
}
