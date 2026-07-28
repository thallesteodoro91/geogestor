import { toast } from 'sonner';

type NotificationOptions = {
  description?: string;
  duration?: number;
};

export const notifications = {
  success(message: string, options?: NotificationOptions) {
    return toast.success(message, options);
  },
  error(message: string, options?: NotificationOptions) {
    return toast.error(message, options);
  },
  info(message: string, options?: NotificationOptions) {
    return toast.info(message, options);
  },
  warning(message: string, options?: NotificationOptions) {
    return toast.warning(message, options);
  }
};
