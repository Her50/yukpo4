import React from 'react';
import { useAppUpdateCheck } from '../hooks/useAppUpdateCheck';

/**
 * Invisible component that checks for app updates on startup.
 * Must be placed inside AuthProvider so API tokens are available.
 */
const AppUpdateChecker: React.FC = () => {
  useAppUpdateCheck();
  return null;
};

export default AppUpdateChecker;
