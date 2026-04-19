import React, {
  createContext,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import WebToastView from './WebToastView';
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

  const queueRef = useRef<ToastEntry[]>([]);
  const isShowingRef = useRef(false);
  const currentRef = useRef<ToastEntry | null>(null);
  const idCounterRef = useRef(0);

  const generateId = useCallback(
    (): string => `toast-${++idCounterRef.current}-${Date.now()}`,
    []
  );

  const presentToast = useCallback((entry: ToastEntry) => {
    isShowingRef.current = true;
    currentRef.current = entry;
    setCurrent(entry);
    setVisible(true);
  }, []);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      setVisible(false);
      setTimeout(() => {
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
  }, []);

  const dismissAll = useCallback(() => {
    queueRef.current = [];
    setVisible(false);
  }, []);

  const handleDismiss = useCallback(() => {
    showNext();
  }, [showNext]);

  const handlePress = useCallback(() => {
    const entry = currentRef.current;
    if (entry?.onPress) {
      entry.onPress();
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
      <WebToastView
        visible={visible}
        icon={current?.icon ?? ''}
        title={current?.title ?? ''}
        message={current?.message ?? ''}
        duration={current?.duration ?? 3000}
        autoDismiss={current?.autoDismiss ?? true}
        enableSwipeDismiss={current?.enableSwipeDismiss ?? true}
        useDynamicIsland={useDynamicIsland}
        onToastDismiss={handleDismiss}
        onToastPress={current?.onPress ? handlePress : undefined}
      />
    </ToastContext.Provider>
  );
}
