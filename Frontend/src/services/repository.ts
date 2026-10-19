import type { AppData } from '@/types';

const STORAGE_KEY = 'nutritrack.local-development.v1';
export const emptyAppData: AppData = { entries: [], goals: [], workouts: [], weights: [], profile: null };

export interface AppRepository {
  load(): AppData;
  save(data: AppData): void;
  clear(): void;
}

export class LocalDevelopmentRepository implements AppRepository {
  load(): AppData {
    if (typeof window === 'undefined') return emptyAppData;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyAppData;
      const value = JSON.parse(raw) as Partial<AppData>;
      return {
        entries: Array.isArray(value.entries) ? value.entries : [],
        goals: Array.isArray(value.goals) ? value.goals : [],
        workouts: Array.isArray(value.workouts) ? value.workouts : [],
        weights: Array.isArray(value.weights) ? value.weights : [],
        profile: value.profile ?? null,
      };
    } catch {
      return emptyAppData;
    }
  }

  save(data: AppData): void {
    if (typeof window === 'undefined') return;
    // This development adapter stores structured app records only; scanner image bytes and URLs are never passed here.
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // A browser may disable storage or run out of space; current in-memory state remains usable.
    }
  }

  clear(): void {
    if (typeof window === 'undefined') return;
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* Keep the app usable if storage is unavailable. */ }
  }
}

export const repository: AppRepository = new LocalDevelopmentRepository();

import { request as apiRequest } from './api';

export const apiClient = {
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8081',
  async request<T>(path: string, init?: RequestInit): Promise<T> {
    return apiRequest<T>(path, init as Parameters<typeof apiRequest>[1]);
  },
};

