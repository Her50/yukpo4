import React from 'react';
import { Button } from '../buttons';

interface IconButtonProps extends React.ComponentProps<typeof Button> {
  icon: React.ReactNode;
  position?: 'left' | 'right';
}

const IconButton: React.FC<IconButtonProps> = ({ icon, position = 'left', children, ...props }) => (
  <Button {...props}>
    {position === 'left' && icon}
    {children && <span className="mx-1">{children}</span>}
    {position === 'right' && icon}
  </Button>
);

export default IconButton;
