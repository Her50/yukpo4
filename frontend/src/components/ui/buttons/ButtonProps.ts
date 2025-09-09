// ✅ Type centralisé pour tous les boutons Yukpo

import * as React from 'react';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-lg';
export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'destructive'
  | 'ghost'
  | 'loading';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}
