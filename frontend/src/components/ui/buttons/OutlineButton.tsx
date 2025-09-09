// 📁 src/components/ui/buttons/OutlineButton.tsx
import React from 'react';
import { Button, ButtonProps } from '../buttons';

const OutlineButton = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <Button ref={ref} variant="outline" {...props} />
));

OutlineButton.displayName = 'OutlineButton';
export default OutlineButton;
