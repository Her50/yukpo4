import React from 'react';
import { Button } from '../buttons';
import { Loader2 } from 'lucide-react';

interface LoadingButtonProps extends React.ComponentProps<typeof Button> {
  loading?: boolean;
}

const LoadingButton: React.FC<LoadingButtonProps> = ({ loading = false, children, ...props }) => (
  <Button disabled={loading} {...props}>
    {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />} {children}
  </Button>
);

export default LoadingButton;
