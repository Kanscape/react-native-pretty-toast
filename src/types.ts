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
}

export interface ToastRef {
  show: (config: ToastConfig) => string;
  dismiss: (id?: string) => void;
  dismissAll: () => void;
}
