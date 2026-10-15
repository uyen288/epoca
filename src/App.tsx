import { lazy, Suspense, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { BookOpen, CalendarDays, CheckSquare2, ChevronDown, CircleHelp, Command, LayoutDashboard, LayoutGrid, Menu, PanelsTopLeft, Sparkles, StickyNote, X } from 'lucide-react';
import type { User } from '@/types';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const KanbanPage = lazy(() => import('@/features/tasks/KanbanPage').then((module) => ({ default: module.KanbanPage })));
const TasksPage = lazy(() => import('@/features/tasks/TasksPage').then((module) => ({ default: module.TasksPage })));
const NotesPage = lazy(() => import('@/features/notes/NotesPage').then((module) => ({ default: module.NotesPage })));

const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare2 },
  { to: '/kanban', label: 'Kanban', icon: LayoutGrid },
  { to: '/notes', label: 'Notes', icon: StickyNote },
];

const LATER_ITEMS = [
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/projects', label: 'Projects', icon: PanelsTopLeft },
];

const GUEST_USER: User = {
  id: 'guest',
  name: 'Guest',
  email: 'Guest workspace',
};

function PageComingSoon({ title }: { title: string }) {
  return <div className="coming-soon"><span className="coming-icon"><Sparkles size={22} /></span><span className="eyebrow">A LITTLE LATER</span><h1>{title}</h1><p>This part of época is still taking shape. Your tasks, notes, and daily overview are ready in the meantime.</p><Link className="button button-secondary" to="/">Back to overview</Link></div>;
}

function AppShell({ user }: { user: User }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const currentLabel = [...NAV_ITEMS, ...LATER_ITEMS].find((item) => item.to === location.pathname)?.label ?? 'Workspace';

  function closeMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-shell">
      {mobileMenuOpen && <button className="mobile-scrim" type="button" aria-label="Close menu" onClick={closeMenu} />}
      <aside className={`sidebar ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        <Link className="brand" to="/" onClick={closeMenu}><span className="brand-mark">e</span><span>época</span><span className="brand-period">.</span></Link>
        <div className="workspace-switcher"><span className="workspace-avatar">{user.name.charAt(0).toUpperCase()}</span><span className="workspace-text"><strong>My workspace</strong><small>This browser</small></span><ChevronDown size={15} /></div>
        <span className="nav-caption">WORKSPACE</span>
        <nav className="primary-nav" aria-label="Main navigation">{NAV_ITEMS.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`} onClick={closeMenu}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Tasks' && <span className="nav-hint"><Command size={11} /> T</span>}</NavLink>)}</nav>
        <span className="nav-caption later-caption">YOUR LIFE, IN TIME</span>
        <nav className="secondary-nav" aria-label="More workspace sections">{LATER_ITEMS.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'nav-active' : ''}`} onClick={closeMenu}><Icon size={18} strokeWidth={1.8} /><span>{label}</span><span className="soon-dot" aria-label="Coming soon" /></NavLink>)}</nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-note"><span className="sidebar-note-icon"><Sparkles size={16} /></span><p>Small steps still move you forward.</p></div>
        <div className="sidebar-bottom">
          <a href="mailto:hello@epoca.app" className="nav-link support-link"><CircleHelp size={18} /><span>Help & feedback</span></a>
          <div className="profile-row"><span className="profile-avatar">{user.name.charAt(0).toUpperCase()}</span><div className="profile-details"><strong>{user.name}</strong><small>{user.email}</small></div></div>
        </div>
        <button className="mobile-close icon-button" type="button" onClick={closeMenu} aria-label="Close navigation"><X size={19} /></button>
      </aside>
      <main className="main-area">
        <header className="topbar"><button className="mobile-menu-button icon-button" type="button" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-separator">/</span><strong>{currentLabel}</strong></div><div className="topbar-right"><span className="today-indicator"><span />Guest workspace</span><span className="topbar-divider" /><button className="topbar-avatar" type="button" aria-label="Guest workspace">{user.name.charAt(0).toUpperCase()}</button></div></header>
        <Suspense fallback={<div className="loading-panel"><span className="spinner" />Opening this part of your workspace…</div>}>
          <Routes>
            <Route path="/" element={<DashboardPage userName={user.name} />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/kanban" element={<KanbanPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/journal" element={<PageComingSoon title="Journal" />} />
            <Route path="/calendar" element={<PageComingSoon title="Calendar" />} />
            <Route path="/projects" element={<PageComingSoon title="Projects" />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">{NAV_ITEMS.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-nav-link ${isActive ? 'mobile-nav-active' : ''}`}><Icon size={19} /><span>{label}</span></NavLink>)}</nav>
    </div>
  );
}

export default function App() {
  return <AppShell user={GUEST_USER} />;
}
