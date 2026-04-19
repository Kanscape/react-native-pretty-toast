import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet } from 'react-native';
import ToastViewNativeComponent from './ToastViewNativeComponent';
import type { ToastConfig, ToastRef } from './types';

export const ToastContext = createContext<ToastRef | null>(null);

type ToastEntry = ToastConfig & { id: string };

interface ToastProviderProps {
  children: React.ReactNode;
  useDynamicIsland?: boolean;
}

export function ToastProvider({
  children,
  useDynamicIsland = true,
}: ToastProviderProps) {
  const [current, setCurrent] = useState<ToastEntry | null>(null);
  const [visible, setVisible] = useState(false);

  // Use refs for synchronous state tracking — React state batching
  // causes stale reads when multiple show() calls fire in the same tick.
  const queueRef = useRef<ToastEntry[]>([]);
  const isShowingRef = useRef(false);
  const currentRef = useRef<ToastEntry | null>(null);
  const idCounterRef = useRef(0);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const generateId = useCallback(
    (): string => `toast-${++idCounterRef.current}-${Date.now()}`,
    []
  );

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, []);

  const presentToast = useCallback((entry: ToastEntry) => {
    isShowingRef.current = true;
    currentRef.current = entry;
    setCurrent(entry);
    setVisible(true);
  }, []);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      // Ensure native sees a visible false→true transition.
      // If visible is already true (e.g. swipe-dismissed while visible was still true),
      // we need to set false first so updateProps detects the change.
      setVisible(false);
      // Use setTimeout to ensure React flushes the false before we set true.
      // Tracked in a ref so it can be cancelled on unmount.
      if (transitionTimeoutRef.current !== null) {
        clearTimeout(transitionTimeoutRef.current);
      }
      transitionTimeoutRef.current = setTimeout(() => {
        transitionTimeoutRef.current = null;
        presentToast(next);
      }, 50);
    } else {
      isShowingRef.current = false;
      currentRef.current = null;
      setCurrent(null);
      setVisible(false);
    }
  }, [presentToast]);

  const show = useCallback(
    (config: ToastConfig): string => {
      const id = config.id ?? generateId();
      const entry: ToastEntry = { ...config, id };

      if (!isShowingRef.current) {
        presentToast(entry);
      } else {
        queueRef.current.push(entry);
      }

      return id;
    },
    [presentToast, generateId]
  );

  const dismiss = useCallback((id?: string) => {
    if (id && currentRef.current?.id !== id) {
      queueRef.current = queueRef.current.filter((t) => t.id !== id);
      return;
    }
    setVisible(false);
    // The native onDismiss callback will fire after the animation,
    // which triggers showNext via handleDismiss.
  }, []);

  const dismissAll = useCallback(() => {
    queueRef.current = [];
    setVisible(false);
  }, []);

  const handleDismiss = useCallback(() => {
    // Native animation finished — show next or clear
    showNext();
  }, [showNext]);

  const handlePress = useCallback(() => {
    const entry = currentRef.current;
    if (entry?.onPress) {
      entry.onPress();
      // Only dismiss if onPress is defined
      setVisible(false);
    }
  }, []);

  const ref = useMemo<ToastRef>(
    () => ({ show, dismiss, dismissAll }),
    [show, dismiss, dismissAll]
  );

  return (
    <ToastContext.Provider value={ref}>
      {children}
      <ToastViewNativeComponent
        visible={visible}
        icon={current?.icon ?? ''}
        title={current?.title ?? ''}
        message={current?.message ?? ''}
        duration={current?.duration ?? 3000}
        autoDismiss={current?.autoDismiss ?? true}
        enableSwipeDismiss={current?.enableSwipeDismiss ?? true}
        useDynamicIsland={useDynamicIsland}
        onToastDismiss={handleDismiss}
        onToastPress={handlePress}
        style={styles.hidden}
      />
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});
