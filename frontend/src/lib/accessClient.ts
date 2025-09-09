// src/lib/accessClient.ts
import accessData from './access_registry.json';

export interface AccessRule {
  component: string;
  path: string;
  role: string;
  plan: string;
}

export const ACCESS_REGISTRY: AccessRule[] = accessData;

export function getAccessRules(): Promise<AccessRule[]> {
  return Promise.resolve(ACCESS_REGISTRY);
}

export function saveAccessRule(rule: AccessRule): Promise<void> {
  console.log("💾 Simuler sauvegarde de la règle :", rule);
  return Promise.resolve(); // simulate saving
}

export function getAccessFor(path: string): AccessRule | undefined {
  return ACCESS_REGISTRY.find((e) => e.path === path);
}

export function updateAccess(component: string, newRole: string, newPlan: string) {
  const item = ACCESS_REGISTRY.find((e) => e.component === component);
  if (item) {
    item.role = newRole;
    item.plan = newPlan;
  }
}
