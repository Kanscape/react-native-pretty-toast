import React, {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AccessibilityInfo, Image, StyleSheet } from 'react-native';
import ToastViewNativeComponent from './ToastViewNativeComponent';
import { _setActiveToastRef } from './toast';
import type {
  PromiseMessages,
  ShowOptions,
  ToastConfig,
  ToastProviderDefaults,
  ToastRef,
} from './types';
import { variantConfig, type ToastVariant } from './variants';

export const ToastContext = createContext<ToastRef | null>(null);

type ToastEntry = ToastConfig & { id: string };

interface ToastProviderProps {
  children: React.ReactNode;
  useDynamicIsland?: boolean;
  /**
   * Default values merged into every toast config. Per-toast values
   * always win.
   */
  defaultConfig?: ToastProviderDefaults;
  /**
   * Maximum queue depth (excluding the currently visible toast). When
   * exceeded, the oldest queued toast is dropped. `0` disables queueing
   * entirely — only one toast can be pending at a time. Defaults to
   * unlimited.
   */
  maxQueue?: number;
}

export function ToastProvider({
  children,
  useDynamicIsland = true,
  defaultConfig,
  maxQueue,
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
  // Tracks whether the current dismissal was caused by the auto-dismiss
  // timer expiring on the native side vs. an explicit programmatic dismiss.
  // The native layer doesn't distinguish these, so we mirror the timer
  // here to fire `onAutoDismiss`.
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const autoDismissedRef = useRef(false);
  const defaultConfigRef = useRef(defaultConfig);
  defaultConfigRef.current = defaultConfig;

  const generateId = useCallback(
    (): string => `toast-${++idCounterRef.current}-${Date.now()}`,
    []
  );

  const clearAutoDismissTimer = useCallback(() => {
    if (autoDismissTimerRef.current !== null) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current !== null) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
      clearAutoDismissTimer();
    };
  }, [clearAutoDismissTimer]);

  const mergeDefaults = useCallback((config: ToastConfig): ToastConfig => {
    const defaults = defaultConfigRef.current;
    if (!defaults) return config;
    return { ...defaults, ...config };
  }, []);

  const armAutoDismissTimer = useCallback(
    (entry: ToastEntry) => {
      clearAutoDismissTimer();
      autoDismissedRef.current = false;
      const autoDismiss = entry.autoDismiss ?? true;
      const duration = entry.duration ?? 3000;
      if (!autoDismiss || duration <= 0) return;
      autoDismissTimerRef.current = setTimeout(() => {
        autoDismissTimerRef.current = null;
        autoDismissedRef.current = true;
      }, duration);
    },
    [clearAutoDismissTimer]
  );

  const presentToast = useCallback(
    (entry: ToastEntry) => {
      isShowingRef.current = true;
      currentRef.current = entry;
      setCurrent(entry);
      setVisible(true);
      armAutoDismissTimer(entry);
      announceToast(entry);
      entry.onShow?.();
    },
    [armAutoDismissTimer]
  );

  const showNext = useCallback(() => {
    const next = queueRef.current.shift();
    if (next) {
      // Ensure native sees a visible false→true transition.
      setVisible(false);
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

  const enqueueOrShow = useCallback(
    (entry: ToastEntry) => {
      if (!isShowingRef.current) {
        presentToast(entry);
        return;
      }
      queueRef.current.push(entry);
      if (typeof maxQueue === 'number' && maxQueue >= 0) {
        while (queueRef.current.length > maxQueue) {
          queueRef.current.shift();
        }
      }
    },
    [maxQueue, presentToast]
  );

  const show = useCallback(
    (config: ToastConfig, options?: ShowOptions): string => {
      const merged = mergeDefaults(config);
      const id = merged.id ?? generateId();
      const entry: ToastEntry = { ...merged, id };

      if (options?.force && isShowingRef.current) {
        queueRef.current.unshift(entry);
        // Mark as programmatic to suppress onAutoDismiss on this dismissal.
        autoDismissedRef.current = false;
        clearAutoDismissTimer();
        setVisible(false);
      } else {
        enqueueOrShow(entry);
      }

      return id;
    },
    [clearAutoDismissTimer, enqueueOrShow, generateId, mergeDefaults]
  );

  const showVariant = useCallback(
    (
      variant: ToastVariant,
      title: string,
      config?: Omit<ToastConfig, 'title'>,
      options?: ShowOptions
    ): string => {
      return show(variantConfig(variant, title, config), options);
    },
    [show]
  );

  const update = useCallback(
    (id: string, partial: Partial<Omit<ToastConfig, 'id'>>) => {
      if (currentRef.current?.id === id) {
        // Mutating state re-renders ToastViewNativeComponent with new props;
        // the native side detects text/icon/duration changes while visible
        // and applies them in place without re-animating.
        const updated: ToastEntry = { ...currentRef.current, ...partial, id };
        currentRef.current = updated;
        setCurrent(updated);
        // Restart the JS-side auto-dismiss mirror so onAutoDismiss fires
        // relative to the updated content.
        armAutoDismissTimer(updated);
        return;
      }
      const idx = queueRef.current.findIndex((t) => t.id === id);
      if (idx !== -1) {
        const existing = queueRef.current[idx] as ToastEntry;
        queueRef.current[idx] = { ...existing, ...partial, id };
      }
    },
    [armAutoDismissTimer]
  );

  const promise = useCallback(
    <T,>(p: Promise<T>, messages: PromiseMessages<T>): Promise<T> => {
      const loadingCfg: ToastConfig =
        typeof messages.loading === 'string'
          ? { title: messages.loading }
          : { ...messages.loading };
      // Loading toasts shouldn't auto-dismiss unless caller opts in.
      if (loadingCfg.autoDismiss === undefined) loadingCfg.autoDismiss = false;
      if (!loadingCfg.icon) loadingCfg.icon = 'arrow.triangle.2.circlepath';
      const id = show(loadingCfg);

      p.then(
        (value) => {
          const next = messages.success;
          const resolved = typeof next === 'function' ? next(value) : next;
          const cfg: ToastConfig =
            typeof resolved === 'string'
              ? { title: resolved }
              : { ...resolved };
          if (!cfg.icon) cfg.icon = 'checkmark.circle.fill';
          if (cfg.autoDismiss === undefined) cfg.autoDismiss = true;
          if (cfg.duration === undefined) cfg.duration = 3000;
          update(id, cfg);
        },
        (err) => {
          const next = messages.error;
          const resolved = typeof next === 'function' ? next(err) : next;
          const cfg: ToastConfig =
            typeof resolved === 'string'
              ? { title: resolved }
              : { ...resolved };
          if (!cfg.icon) cfg.icon = 'xmark.circle.fill';
          if (cfg.autoDismiss === undefined) cfg.autoDismiss = true;
          if (cfg.duration === undefined) cfg.duration = 3000;
          update(id, cfg);
        }
      );

      return p;
    },
    [show, update]
  );

  const dismiss = useCallback(
    (id?: string) => {
      if (id && currentRef.current?.id !== id) {
        queueRef.current = queueRef.current.filter((t) => t.id !== id);
        return;
      }
      // Explicit user dismissal — overrides the mirror timer so the
      // upcoming onToastDismiss event from native doesn't fire
      // onAutoDismiss just because the mirror already ticked over
      // during the 0.35s native collapse window.
      clearAutoDismissTimer();
      autoDismissedRef.current = false;
      setVisible(false);
    },
    [clearAutoDismissTimer]
  );

  const dismissAll = useCallback(() => {
    queueRef.current = [];
    clearAutoDismissTimer();
    autoDismissedRef.current = false;
    setVisible(false);
  }, [clearAutoDismissTimer]);

  const handleDismiss = useCallback(() => {
    const entry = currentRef.current;
    clearAutoDismissTimer();
    if (entry) {
      if (autoDismissedRef.current) entry.onAutoDismiss?.();
      entry.onHide?.();
    }
    autoDismissedRef.current = false;
    showNext();
  }, [clearAutoDismissTimer, showNext]);

  const handleShow = useCallback(() => {
    // Native-side onShow fires when the expand animation finishes.
    // `presentToast` already invoked the JS `onShow`, so no-op here —
    // but this handler exists so the event is observed and not dropped.
  }, []);

  const handlePress = useCallback(() => {
    const entry = currentRef.current;
    if (entry?.onPress) {
      entry.onPress();
      clearAutoDismissTimer();
      autoDismissedRef.current = false;
      setVisible(false);
    }
  }, [clearAutoDismissTimer]);

  const handleActionPress = useCallback(() => {
    const entry = currentRef.current;
    if (entry?.action) {
      entry.action.onPress();
      clearAutoDismissTimer();
      autoDismissedRef.current = false;
      setVisible(false);
    }
  }, [clearAutoDismissTimer]);

  const ref = useMemo<ToastRef>(
    () => ({
      show,
      success: (title, cfg, opts) => showVariant('success', title, cfg, opts),
      error: (title, cfg, opts) => showVariant('error', title, cfg, opts),
      info: (title, cfg, opts) => showVariant('info', title, cfg, opts),
      warning: (title, cfg, opts) => showVariant('warning', title, cfg, opts),
      loading: (title, cfg, opts) => showVariant('loading', title, cfg, opts),
      update,
      promise,
      dismiss,
      dismissAll,
    }),
    [show, showVariant, update, promise, dismiss, dismissAll]
  );

  useEffect(() => {
    _setActiveToastRef(ref);
    return () => {
      _setActiveToastRef(null);
    };
  }, [ref]);

  const iconUri = resolveIconUri(current?.iconSource);

  return (
    <ToastContext.Provider value={ref}>
      {children}
      <ToastViewNativeComponent
        visible={visible}
        icon={current?.icon ?? ''}
        iconUri={iconUri ?? ''}
        title={current?.title ?? ''}
        message={current?.message ?? ''}
        duration={current?.duration ?? 3000}
        autoDismiss={current?.autoDismiss ?? true}
        enableSwipeDismiss={current?.enableSwipeDismiss ?? true}
        useDynamicIsland={useDynamicIsland}
        accentColor={current?.accentColor}
        strokeColor={current?.strokeColor}
        disableBackdropSampling={current?.disableBackdropSampling ?? false}
        actionLabel={current?.action?.label ?? ''}
        onToastDismiss={handleDismiss}
        onToastShow={handleShow}
        onToastPress={handlePress}
        onToastActionPress={handleActionPress}
        style={styles.hidden}
      />
    </ToastContext.Provider>
  );
}

function resolveIconUri(
  source: ToastConfig['iconSource'] | undefined
): string | undefined {
  if (!source) return undefined;
  try {
    const resolved = Image.resolveAssetSource(source);
    return resolved?.uri;
  } catch {
    return undefined;
  }
}

function announceToast(entry: ToastConfig): void {
  const message =
    entry.accessibilityAnnouncement !== undefined
      ? entry.accessibilityAnnouncement
      : [entry.title, entry.message].filter(Boolean).join('. ');
  if (!message) return;
  try {
    AccessibilityInfo.announceForAccessibility(message);
  } catch {
    // announceForAccessibility is best-effort; never throw on a11y failure.
  }
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 0,
    height: 0,
    overflow: 'hidden',
  },
});
