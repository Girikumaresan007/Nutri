import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/app/AppShell';

const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const DiaryPage = lazy(() => import('@/features/diary/DiaryPage').then((module) => ({ default: module.DiaryPage })));
const ScannerPage = lazy(() => import('@/features/scanner/ScannerPage').then((module) => ({ default: module.ScannerPage })));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const WorkoutsPage = lazy(() => import('@/features/workouts/WorkoutsPage').then((module) => ({ default: module.WorkoutsPage })));
const GoalsPage = lazy(() => import('@/features/goals/GoalsPage').then((module) => ({ default: module.GoalsPage })));
const ProfilePage = lazy(() => import('@/features/profile/ProfilePage').then((module) => ({ default: module.ProfilePage })));

function RouteLoading() {
  return <div className="route-loading" role="status"><span /><p>Loading your space…</p></div>;
}

const page = (content: ReactNode) => <Suspense fallback={<RouteLoading />}>{content}</Suspense>;

export function App() {
  return <Routes>
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
  </Routes>;
}
