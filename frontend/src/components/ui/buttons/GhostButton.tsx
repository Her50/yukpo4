// 📁 src/components/ui/buttons/GhostButton.tsx
import React from 'react';
import { Button, ButtonProps } from '../buttons';

const GhostButton = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button ref={ref} variant="ghost" {...props} />
));

GhostButton.displayName = 'GhostButton';
export default GhostButton;
