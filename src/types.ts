import type { SFSymbols7_0 } from './sf-symbols-typescript';

/**
 * Name of an [SF Symbol](https://developer.apple.com/sf-symbols/) to display
 * as the toast icon. Browse the full catalog in Apple's SF Symbols app or
 * online at https://sfsymbols.com.
 *
 * Common symbols are suggested via autocomplete; any SF Symbol name is
 * accepted.
 *
 * @example "checkmark.seal.fill"
 */
export type SFSymbolName = SFSymbols7_0 | (string & Record<never, never>);

export interface ToastConfig {
  id?: string;
  icon?: SFSymbolName;
  title?: string;
  message?: string;
  duration?: number;
  autoDismiss?: boolean;
  enableSwipeDismiss?: boolean;
  onPress?: () => void;
  onShow?: () => void;
  onHide?: () => void;
  onAutoDismiss?: () => void;
}

export interface ShowOptions {
  /**
   * Present this toast immediately, dismissing the currently visible one
   * and clearing the queue policy's dedupe behavior. Useful for critical
   * interrupts like session-expiry notifications.
   */
  force?: boolean;
}

export type PromiseMessages<T> = {
  loading: string | Omit<ToastConfig, 'id'>;
  success: string | ((value: T) => string | Omit<ToastConfig, 'id'>);
  error: string | ((error: unknown) => string | Omit<ToastConfig, 'id'>);
};

export interface ToastRef {
  show: (config: ToastConfig, options?: ShowOptions) => string;
  success: (
    title: string,
    config?: Omit<ToastConfig, 'title'>,
    options?: ShowOptions
  ) => string;
  error: (
    title: string,
    config?: Omit<ToastConfig, 'title'>,
    options?: ShowOptions
  ) => string;
  info: (
    title: string,
    config?: Omit<ToastConfig, 'title'>,
    options?: ShowOptions
  ) => string;
  warning: (
    title: string,
    config?: Omit<ToastConfig, 'title'>,
    options?: ShowOptions
  ) => string;
  loading: (
    title: string,
    config?: Omit<ToastConfig, 'title'>,
    options?: ShowOptions
  ) => string;
  update: (id: string, partial: Partial<Omit<ToastConfig, 'id'>>) => void;
  promise: <T>(promise: Promise<T>, messages: PromiseMessages<T>) => Promise<T>;
  dismiss: (id?: string) => void;
  dismissAll: () => void;
}

export interface ToastProviderDefaults extends Omit<
  ToastConfig,
  'id' | 'title' | 'message' | 'icon' | 'onPress'
> {}
