// src/config/plan_pages.ts
import React from 'react';

// ✅ Typage explicite
export type Role = 'admin' | 'client' | 'user' | 'public';

export const PLAN_PAGES: Record<string, { plans: string[]; roles: Role[] }> = {
  overview: { plans: ['pro', 'enterprise'], roles: ['admin', 'user'] },     // ← à ajuster selon ton cas
  alerts: { plans: ['pro'], roles: ['admin', 'client'] },
  history: { plans: ['free', 'pro', 'enterprise'], roles: ['user', 'client'] },
};
