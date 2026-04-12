export interface ToastConfig {
  id?: string;
  icon?: string;
  title?: string;
  message?: string;
  duration?: number;
  autoDismiss?: boolean;
  enableSwipeDismiss?: boolean;
  onPress?: () => void;
}

export interface ToastRef {
  show: (config: ToastConfig) => string;
  dismiss: (id?: string) => void;
  dismissAll: () => void;
}
