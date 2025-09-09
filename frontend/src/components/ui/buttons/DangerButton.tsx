// 📁 src/components/ui/buttons/DangerButton.tsx
import React from 'react';
import { Button, ButtonProps } from '../buttons';

const DangerButton = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button ref={ref} variant="destructive" {...props} />
));

DangerButton.displayName = 'DangerButton';
export default DangerButton;
