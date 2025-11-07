import React from 'react';
import { SafeNativeView } from '../components/SafeNativeView';
import { modernColors } from '../theme/modernTheme';

type NavigatorSafeAreaOptions = {
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  backgroundColor?: string;
};

type SafeAwareComponent<P> = React.ComponentType<P> & {
  disableNavigatorSafeArea?: boolean;
};

export function withNavigatorSafeArea<P>(
  Component: SafeAwareComponent<P>,
  options: NavigatorSafeAreaOptions = {}
): React.FC<P> {
  const { edges = ['top'], backgroundColor = modernColors.background } = options;

  const WrappedComponent: React.FC<P> = (props) => {
    if (Component.disableNavigatorSafeArea) {
      return <Component {...props} />;
    }

    return (
      <SafeNativeView edges={edges} backgroundColor={backgroundColor} style={{ flex: 1 }}>
        <Component {...props} />
      </SafeNativeView>
    );
  };

  WrappedComponent.displayName = `withNavigatorSafeArea(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}

export function markNavigatorSafeAreaHandled(component: SafeAwareComponent<any>) {
  if (component) {
    component.disableNavigatorSafeArea = true;
  }
}

