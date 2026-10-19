import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, Bell, BookOpen, ChartNoAxesColumnIncreasing, ChevronDown, ChevronLeft, ChevronRight, Download, Dumbbell, Ellipsis, LayoutDashboard, Leaf, LogIn, LogOut, Plus, ScanLine, Settings2, Target, UserRound } from 'lucide-react';
import { AddFoodModal } from '@/components/AddFoodModal';
import { AuthModal } from '@/components/AuthModal';
import { GlobalFeedback, Modal } from '@/components/ui';
import { useApp } from '@/app/AppContext';
import { promptPwaInstall, subscribeInstallPrompt } from '@/pwa';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, mobile: true },
  { to: '/diary', label: 'Food Diary', icon: BookOpen, mobile: true },
  { to: '/scanner', label: 'Food Scanner', icon: ScanLine, mobile: true },
  { to: '/analytics', label: 'Analytics', icon: ChartNoAxesColumnIncreasing, mobile: false },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell, mobile: false },
  { to: '/goals', label: 'Weight & Goals', icon: Target, mobile: false },
  { to: '/profile', label: 'Profile & Settings', icon: Settings2, mobile: false },
];

export function AppShell() {
  const { data, openFoodModal, pushToast, currentUser, isAuthenticated, openAuthModal, logout } = useApp();
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const displayName = currentUser?.name || data.profile?.name || (isAuthenticated ? 'NutriTrack' : 'Guest');
  const initial = displayName.trim().charAt(0).toUpperCase();

  useEffect(() => {
    return subscribeInstallPrompt((available) => {
      setCanInstall(available);
    });
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    const menu = profileMenuRef.current;
    const trigger = profileTriggerRef.current;
    const menuItems = () => Array.from(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const focusFrame = window.requestAnimationFrame(() => menuItems()[0]?.focus());

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !menu?.contains(target) && !trigger?.contains(target)) setProfileOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && !menu?.contains(target) && !trigger?.contains(target)) setProfileOpen(false);
    };
    const onMenuKeyDown = (event: KeyboardEvent) => {
      const items = menuItems();
      if (event.key === 'Escape') {
        event.preventDefault();
        setProfileOpen(false);
        trigger?.focus();
        return;
      }
      if (event.key === 'Tab') {
        setProfileOpen(false);
        return;
      }
      if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? items.length - 1
          : event.key === 'ArrowDown'
            ? (currentIndex + 1 + items.length) % items.length
            : currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
      items[nextIndex]?.focus();
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    menu?.addEventListener('keydown', onMenuKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
      menu?.removeEventListener('keydown', onMenuKeyDown);
    };
  }, [profileOpen]);

  return <div className="app-frame">
    <aside className={`sidebar ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} aria-label="Main navigation">
      <div className="sidebar-brand-row">
        <NavLink to="/" className="brand-lockup">
          <span className="brand-mark"><Leaf size={18} strokeWidth={2.2} /></span>
          <span className="brand-wordmark">nutri<span>track</span><small>AI WELLNESS</small></span>
        </NavLink>
        <button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!sidebarCollapsed} onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}>
          {sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>
      <p className="nav-label">YOUR SPACE</p>
      <nav className="side-nav">
        {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{to === '/scanner' && <span className="nav-new">AI</span>}
        </NavLink>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-tip"><span className="tip-leaf"><Leaf size={15} /></span><p><strong>Small steps add up.</strong><span>Stay curious about your habits.</span></p></div>
        <div
          className="sidebar-account"
          onClick={() => { if (!isAuthenticated) openAuthModal('login'); }}
          style={{ cursor: !isAuthenticated ? 'pointer' : 'default' }}
          title={!isAuthenticated ? 'Click to sign in or register' : undefined}
        >
          <div className="avatar">{initial}</div>
          <div className="account-meta">
            <strong>{displayName}</strong>
            <span>{isAuthenticated ? 'Connected account' : 'Local guest mode (click to sign in)'}</span>
          </div>
          <ChevronDown size={15} />
        </div>
      </div>
    </aside>

    <main className="main-column">
      <header className="topbar">
        <div className="mobile-brand"><span className="brand-mark"><Leaf size={16} /></span><span>nutri<span>track</span></span></div>
        <div className="topbar-context"><span className="context-dot" /> Your wellbeing, in focus</div>
        <div className="topbar-actions">
          {!isAuthenticated ? (
            <button
              type="button"
              className="btn-header-signin"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                background: '#15803d',
                color: '#ffffff',
                border: 'none',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => openAuthModal('login')}
            >
              <LogIn size={14} /> Sign in / Register
            </button>
          ) : (
            <button type="button" className="header-action" aria-label="Notifications" onClick={() => pushToast({ tone: 'info', title: 'You’re all caught up', detail: 'Notifications are a placeholder until account services are connected.' })}><Bell size={18} /><i /></button>
          )}
          <button
            ref={profileTriggerRef}
            type="button"
            className="profile-trigger"
            aria-haspopup="menu"
            aria-controls="profile-menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="avatar avatar-small">{initial}</span><span className="profile-trigger-name">{displayName.split(' ')[0]}</span><ChevronDown size={14} />
          </button>
          {profileOpen && <div ref={profileMenuRef} id="profile-menu" className="profile-popover" role="menu" aria-label="Profile and goal navigation">
            <div className="popover-heading" role="presentation">
              <div className="avatar">{initial}</div>
              <div>
                <strong>{displayName}</strong>
                <span>{currentUser?.email || data.profile?.email || 'Local guest mode'}</span>
              </div>
            </div>
            <NavLink role="menuitem" to="/profile" onClick={() => setProfileOpen(false)}><UserRound size={16} /> Profile &amp; settings</NavLink>
            <NavLink role="menuitem" to="/goals" onClick={() => setProfileOpen(false)}><Target size={16} /> Goals</NavLink>
            {isAuthenticated ? (
              <button
                role="menuitem"
                type="button"
                className="profile-popover-item"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#b91c1c', fontSize: '0.875rem' }}
                onClick={() => { setProfileOpen(false); void logout(); }}
              >
                <LogOut size={16} /> Sign out
              </button>
            ) : (
              <button
                role="menuitem"
                type="button"
                className="profile-popover-item"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '10px 14px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: '#15803d', fontSize: '0.875rem' }}
                onClick={() => { setProfileOpen(false); openAuthModal('login'); }}
              >
                <LogIn size={16} /> Sign in / Register
              </button>
            )}
          </div>}
        </div>
      </header>
      <div className="content-scroll"><Outlet /></div>
      <footer className="app-footer"><span><Activity size={14} /> Progress, not perfection.</span><span>Nutrition estimates are for guidance only.</span></footer>
    </main>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navItems.filter((item) => item.to === '/' || item.to === '/diary').map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
        <Icon size={19} strokeWidth={1.9} /><span>{label === 'Food Diary' ? 'Diary' : label}</span>
      </NavLink>)}
      <button type="button" className="mobile-nav-link mobile-add-link" aria-label="Add food" onClick={() => openFoodModal()}><span className="mobile-add-icon"><Plus size={17} /></span><span>Add</span></button>
      <NavLink to="/scanner" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}><ScanLine size={19} strokeWidth={1.9} /><span>Scan</span></NavLink>
      <button type="button" className={`mobile-nav-link ${moreOpen ? 'active' : ''}`} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}><Ellipsis size={20} /><span>More</span></button>
    </nav>

    <Modal
      open={moreOpen}
      onClose={() => setMoreOpen(false)}
      title="More in NutriTrack"
      panelClassName="mobile-more-panel"
      backdropClassName="mobile-more-backdrop"
    >
      <nav aria-label="More navigation">
        {navItems.filter((item) => !item.mobile).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} onClick={() => setMoreOpen(false)} className={({ isActive }) => `more-sheet-link ${isActive ? 'active' : ''}`}>
          <Icon size={19} /><span>{label}</span>
        </NavLink>)}
        {canInstall && (
          <button
            type="button"
            className="more-sheet-link"
            style={{
              width: '100%',
              textAlign: 'left',
              background: 'rgba(36, 76, 58, 0.08)',
              color: '#244C3A',
              fontWeight: 600,
              marginTop: '10px',
              border: '1px solid rgba(36, 76, 58, 0.2)',
              borderRadius: '10px',
              padding: '12px 14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
            onClick={async () => {
              setMoreOpen(false);
              await promptPwaInstall();
            }}
          >
            <Download size={19} />
            <span>Install App on Device</span>
          </button>
        )}
      </nav>
    </Modal>
    <AddFoodModal />
    <AuthModal />
    <GlobalFeedback />
  </div>;
}
