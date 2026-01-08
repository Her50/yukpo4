/**
 * HOC (Higher Order Component) pour envelopper automatiquement un écran avec KeyboardAwareScreen
 * 
 * Usage:
 * ```tsx
 * export default withKeyboardAware(MyScreen);
 * ```
 */

import React, { ComponentType } from 'react';
import { KeyboardAwareScreen } from './KeyboardAwareScreen';

interface WithKeyboardAwareOptions {
  disableScroll?: boolean;
  extraScrollHeight?: number;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

/**
 * HOC qui enveloppe un composant avec KeyboardAwareScreen
 */
export function withKeyboardAware<P extends object>(
  Component: ComponentType<P>,
  options: WithKeyboardAwareOptions = {}
) {
  const WrappedComponent: React.FC<P> = (props) => {
    return (
      <KeyboardAwareScreen
        disableScroll={options.disableScroll}
        extraScrollHeight={options.extraScrollHeight}
        keyboardShouldPersistTaps={options.keyboardShouldPersistTaps}
      >
        <Component {...props} />
      </KeyboardAwareScreen>
    );
  };

  WrappedComponent.displayName = `withKeyboardAware(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

export default withKeyboardAware;

