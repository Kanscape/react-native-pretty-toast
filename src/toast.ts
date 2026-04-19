import type { ToastConfig, ToastRef } from './types';

let activeRef: ToastRef | null = null;

export function _setActiveToastRef(ref: ToastRef | null): void {
  activeRef = ref;
}

declare const __DEV__: boolean | undefined;

function warnNoProvider(method: string): void {
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    console.warn(
      `[react-native-pretty-toast] toast.${method}() called before <ToastProvider> mounted. Call was ignored.`
    );
  }
}

export const toast = {
  show(config: ToastConfig): string {
    if (!activeRef) {
      warnNoProvider('show');
      return '';
    }
    return activeRef.show(config);
  },
  dismiss(id?: string): void {
    if (!activeRef) {
      warnNoProvider('dismiss');
      return;
    }
    activeRef.dismiss(id);
  },
  dismissAll(): void {
    if (!activeRef) {
      warnNoProvider('dismissAll');
      return;
    }
    activeRef.dismissAll();
  },
};
