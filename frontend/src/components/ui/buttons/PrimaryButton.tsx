// 📁 src/components/ui/buttons/PrimaryButton.tsx
import React from 'react';
import { Button, ButtonProps } from '../buttons';

const PrimaryButton = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button ref={ref} variant="default" {...props} />
));

PrimaryButton.displayName = 'PrimaryButton';
export default PrimaryButton;
