import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronsLeft,
  CreditCard,
  Database,
  Globe2,
  LayoutDashboard,
  LogOut,
  KeyRound,
  MailPlus,
  Megaphone,
  Menu,
  MousePointerClick,
  Bot,
  Ban,
  BarChart3,
  BookOpen,
  MessageSquareWarning,
  Receipt,
  RefreshCw,
  ScrollText,
  Trophy,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import { AdminBrandLogo } from './AdminBrandLogo'
import {
  NAV_GROUPS,
  pathForTab,
  TAB_SUBTITLES,
  TAB_TITLES,
  tabIdFromLocation,
  type TabId,
} from '../lib/constants'
import { OverviewTab } from '../tabs/OverviewTab'
import { InsightsTab } from '../tabs/InsightsTab'
import { QualityTab } from '../tabs/QualityTab'
import { TestersTab } from '../tabs/TestersTab'
import { ContentTab } from '../tabs/ContentTab'
import { UsersTab } from '../tabs/UsersTab'
import { CancellationsTab } from '../tabs/CancellationsTab'
import { InviteCodesTab } from '../tabs/InviteCodesTab'
import { RegionsTab } from '../tabs/RegionsTab'
import { GamificationTab } from '../tabs/GamificationTab'
import { PlansTab } from '../tabs/PlansTab'
import { ToolsTab } from '../tabs/ToolsTab'
import { ActivityLogTab } from '../tabs/ActivityLogTab'
import { UserDataTab } from '../tabs/UserDataTab'
import { UserActivityLogTab } from '../tabs/UserActivityLogTab'
import { ChatPromptTab } from '../tabs/ChatPromptTab'
import { RagSourcesTab } from '../tabs/RagSourcesTab'
import { LlmTransactionsTab } from '../tabs/LlmTransactionsTab'
import { UserFinancialsTab } from '../tabs/UserFinancialsTab'
import { SidebarUser } from './SidebarUser'

const NAV_ICONS: Record<TabId, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  insights: BarChart3,
  quality: MessageSquareWarning,
  testers: MailPlus,
  invites: KeyRound,
  regions: Globe2,
  points: Trophy,
  plans: CreditCard,
  content: Megaphone,
  sources: BookOpen,
  users: Users,
  cancellations: Ban,
  userdata: Database,
  useractivity: MousePointerClick,
  chatprompt: Bot,
  llmtransactions: Receipt,
  userfinancials: Wallet,
  activity: ScrollText,
  tools: Wrench,
}

export function AdminShell() {
  const { logout, adminFetch } = useAdmin()
  const navigate = useNavigate()
  const location = useLocation()
  const tab = tabIdFromLocation(location.pathname)

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('hm_admin_collapsed') === '1',
  )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userCount, setUserCount] = useState<number | null>(null)
  const [pendingCancels, setPendingCancels] = useState<number | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const switchTab = (id: TabId) => {
    navigate(pathForTab(id))
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
    let cancelled = false
    adminFetch('/admin/subscription-cancellations?status=pending')
      .then((d) => {
        if (cancelled) return
        const list = (d.requests as unknown[]) || []
        setPendingCancels(list.length)
      })
      .catch(() => {
        if (!cancelled) setPendingCancels(null)
      })
    return () => {
      cancelled = true
    }
  }, [adminFetch, refreshKey])

  // Lightweight user total for Overview without requiring a visit to Users.
  useEffect(() => {
    let cancelled = false
    adminFetch('/admin/insights?days=14')
      .then((d) => {
        if (cancelled) return
        const n = (d.kpis as { total_users?: number } | undefined)?.total_users
        if (typeof n === 'number') setUserCount(n)
      })
      .catch(() => {
        /* Overview can still show — from Users tab later */
      })
    return () => {
      cancelled = true
    }
  }, [adminFetch, refreshKey])

  useEffect(() => {
    if (collapsed && window.innerWidth <= 768) setCollapsed(false)
  }, [collapsed])

  const subtitle = useMemo(() => TAB_SUBTITLES[tab] || '', [tab])

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
            <AdminBrandLogo />
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

        <nav className="sidebar-nav" aria-label="Admin">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label" aria-hidden={collapsed}>
                {group.label}
              </div>
              {group.ids.map((id) => {
                const Icon = NAV_ICONS[id]
                return (
                  <button
                    key={id}
                    type="button"
                    className={tab === id ? 'active' : ''}
                    data-tab={id}
                    data-tip={TAB_TITLES[id]}
                    onClick={() => switchTab(id)}
                  >
                    <Icon className="nav-icon" size={18} strokeWidth={2} />
                    <span className="nav-label">
                      {TAB_TITLES[id]}
                      {id === 'cancellations' && pendingCancels != null && pendingCancels > 0 ? (
                        <span className="nav-badge" aria-label={`${pendingCancels} pending`}>
                          {pendingCancels > 99 ? '99+' : pendingCancels}
                        </span>
                      ) : null}
                    </span>
                  </button>
                )
              })}
            </div>
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
        <SidebarUser />
      </aside>

      <div className="content-wrap">
        <header className="content-header">
          <div className="content-header-lead">
            <button
              type="button"
              className="menu-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="content-header-titles">
              <h1>{TAB_TITLES[tab]}</h1>
              {subtitle ? <p className="content-header-sub">{subtitle}</p> : null}
            </div>
          </div>
        </header>

        <main
          className={`main${
            tab === 'testers' || tab === 'chatprompt' ? ' main-narrow' : ''
          }`}
        >
          <Routes>
            <Route
              index
              element={<OverviewTab key={`ov-${refreshKey}`} userCount={userCount} />}
            />
            <Route path="insights" element={<InsightsTab key={`in-${refreshKey}`} />} />
            <Route path="quality" element={<QualityTab key={`ql-${refreshKey}`} />} />
            <Route
              path="testers"
              element={<TestersTab key={`te-${refreshKey}`} onUsersChanged={refreshAll} />}
            />
            <Route path="invite-codes" element={<InviteCodesTab key={`ic-${refreshKey}`} />} />
            <Route path="regions" element={<RegionsTab key={`rg-${refreshKey}`} />} />
            <Route path="points" element={<GamificationTab key={`gm-${refreshKey}`} />} />
            <Route path="levels" element={<Navigate to="/points" replace />} />
            <Route path="plans" element={<PlansTab key={`pl-${refreshKey}`} />} />
            <Route path="content" element={<ContentTab key={`co-${refreshKey}`} />} />
            <Route path="sources" element={<RagSourcesTab key={`rs-${refreshKey}`} />} />
            <Route
              path="users"
              element={<UsersTab key={`us-${refreshKey}`} onCount={onUserCount} />}
            />
            <Route
              path="cancellations"
              element={<CancellationsTab key={`cx-${refreshKey}`} />}
            />
            <Route path="user-data" element={<UserDataTab key={`ud-${refreshKey}`} />} />
            <Route path="user-activity" element={<UserActivityLogTab key={`ua-${refreshKey}`} />} />
            <Route path="chat-prompt" element={<ChatPromptTab key={`cp-${refreshKey}`} />} />
            <Route
              path="llm-transactions"
              element={<LlmTransactionsTab key={`lt-${refreshKey}`} />}
            />
            <Route
              path="user-financials"
              element={<UserFinancialsTab key={`uf-${refreshKey}`} />}
            />
            <Route path="activity-log" element={<ActivityLogTab key={`al-${refreshKey}`} />} />
            <Route path="tools" element={<ToolsTab key={`to-${refreshKey}`} onSeeded={refreshAll} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
