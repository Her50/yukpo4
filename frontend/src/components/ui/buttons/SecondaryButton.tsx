import React from 'react';
import { Button } from '../buttons';

const SecondaryButton = (props: React.ComponentProps<typeof Button>) => (
  <Button variant="secondary" {...props} />
);

export default SecondaryButton;
