import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AppShell } from '@/app/AppShell';
import { useApp } from '@/app/AppContext';
import { SplashScreen } from '@/components/SplashScreen';

// Safe chunk dynamic loader with single-reload auto-recovery from stale deployment hashes
function lazyWithRetry<T extends React.ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>
) {
  return lazy(async () => {
    try {
      const component = await factory();
      window.sessionStorage.removeItem('nt_chunk_reload_lock');
      return component;
    } catch (error) {
      const hasRetried = window.sessionStorage.getItem('nt_chunk_reload_lock');
      if (!hasRetried) {
        window.sessionStorage.setItem('nt_chunk_reload_lock', 'true');
        console.warn('[NutriTrack] Stale chunk detected; reloading latest application version...');
        window.location.reload();
        return new Promise<{ default: T }>(() => {});
      }
      window.sessionStorage.removeItem('nt_chunk_reload_lock');
      throw error;
    }
  });
}

const DashboardPage = lazyWithRetry(() => import('@/features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const DiaryPage = lazyWithRetry(() => import('@/features/diary/DiaryPage').then((module) => ({ default: module.DiaryPage })));
const ScannerPage = lazyWithRetry(() => import('@/features/scanner/ScannerPage').then((module) => ({ default: module.ScannerPage })));
const AnalyticsPage = lazyWithRetry(() => import('@/features/analytics/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const WorkoutsPage = lazyWithRetry(() => import('@/features/workouts/WorkoutsPage').then((module) => ({ default: module.WorkoutsPage })));
const GoalsPage = lazyWithRetry(() => import('@/features/goals/GoalsPage').then((module) => ({ default: module.GoalsPage })));
const ProfilePage = lazyWithRetry(() => import('@/features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })));

function RouteLoading() {
  return <div className="route-loading" role="status"><span /><p>Loading your space…</p></div>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

const page = (content: ReactNode) => <Suspense fallback={<RouteLoading />}>{content}</Suspense>;

export function App() {
  const { isAuthLoading } = useApp();
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      <ScrollToTop />
      <AnimatePresence mode="wait">
        {showSplash && (
          <SplashScreen
            isLoading={isAuthLoading}
            onFinish={() => setShowSplash(false)}
          />
        )}
      </AnimatePresence>

      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={page(<DashboardPage />)} />
          <Route path="/diary" element={page(<DiaryPage />)} />
          <Route path="/scanner" element={page(<ScannerPage />)} />
          <Route path="/analytics" element={page(<AnalyticsPage />)} />
          <Route path="/workouts" element={page(<WorkoutsPage />)} />
          <Route path="/goals" element={page(<GoalsPage />)} />
          <Route path="/profile" element={page(<ProfilePage />)} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </>
  );
}
