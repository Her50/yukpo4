import { toast } from 'react-toastify';

export function notify(title: string, message: string) {
  toast.info(`${title}: ${message}`, {
    position: 'top-right',
    autoClose: 5000,
    closeOnClick: true,
    pauseOnHover: true,
  });
}
