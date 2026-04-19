/* eslint-disable react-native/no-inline-styles */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';

export interface WebToastViewProps {
  visible: boolean;
  icon?: string;
  title?: string;
  message?: string;
  duration?: number;
  autoDismiss?: boolean;
  enableSwipeDismiss?: boolean;
  useDynamicIsland?: boolean;
  onToastDismiss?: () => void;
  onToastPress?: () => void;
}

const ICON_MAP: Array<[string, { glyph: string; color: string }]> = [
  ['checkmark', { glyph: '✓', color: '#30D158' }],
  ['xmark', { glyph: '✕', color: '#FF453A' }],
  ['info', { glyph: 'ℹ', color: '#0A84FF' }],
  ['exclamation', { glyph: '!', color: '#FF9F0A' }],
  ['heart', { glyph: '♥', color: '#FF375F' }],
  ['arrow.up', { glyph: '↑', color: '#0A84FF' }],
  ['arrow.down', { glyph: '↓', color: '#0A84FF' }],
  ['envelope', { glyph: '✉', color: '#FFFFFF' }],
  ['wifi', { glyph: '📶', color: '#FFFFFF' }],
  ['hand.tap', { glyph: '👆', color: '#FFFFFF' }],
];

function getIcon(symbol: string): { glyph: string; color: string } {
  for (const [key, value] of ICON_MAP) {
    if (symbol.includes(key)) return value;
  }
  return { glyph: '•', color: '#8E8E93' };
}

function hexToRgba(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const ENTER_MS = 300;
const EXIT_MS = 250;
const ENTER_EASING = 'cubic-bezier(0.22, 1.2, 0.36, 1)';
const EXIT_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
const SWIPE_THRESHOLD = -40;

export default function WebToastView({
  visible,
  icon = '',
  title = '',
  message = '',
  duration = 3000,
  autoDismiss = true,
  enableSwipeDismiss = true,
  onToastDismiss,
  onToastPress,
}: WebToastViewProps) {
  const [mounted, setMounted] = useState(false);
  const [entered, setEntered] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  const dragStartYRef = useRef<number | null>(null);
  const lastDragYRef = useRef(0);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearAutoDismiss = () => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  };

  const clearExit = () => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  };

  // When the parent flips `visible` to true for a new toast, reset local
  // lifecycle state and start the enter animation.
  useEffect(() => {
    if (!visible) return;
    clearExit();
    clearAutoDismiss();
    setMounted(true);
    setEntered(false);
    setDismissing(false);
    setDragY(0);
    setIsDragging(false);
  }, [visible]);

  // Start the exit animation whenever we should be hiding — either because
  // the parent requested it (`visible=false`) or we initiated dismissal
  // ourselves (auto-dismiss timer, swipe past threshold). Only fires
  // `onToastDismiss` once the exit transition has actually completed, so
  // queued toasts arrive on a clean slate instead of interrupting the exit.
  useEffect(() => {
    const shouldExit = mounted && (!visible || dismissing);
    if (!shouldExit || exitTimerRef.current) return;
    setEntered(false);
    clearAutoDismiss();
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      setMounted(false);
      setDismissing(false);
      setDragY(0);
      onToastDismiss?.();
    }, EXIT_MS);
  }, [mounted, visible, dismissing, onToastDismiss]);

  useLayoutEffect(() => {
    if (!mounted || !visible || dismissing) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [mounted, visible, dismissing]);

  useEffect(() => {
    if (!mounted || !visible || !entered || dismissing) return;
    clearAutoDismiss();
    if (autoDismiss && duration > 0) {
      autoDismissTimerRef.current = setTimeout(() => {
        setDismissing(true);
      }, duration);
    }
    return clearAutoDismiss;
  }, [mounted, visible, entered, dismissing, autoDismiss, duration]);

  useEffect(() => {
    return () => {
      clearAutoDismiss();
      clearExit();
    };
  }, []);

  if (typeof document === 'undefined' || !mounted) return null;

  const { glyph, color } = getIcon(icon);

  const isExiting = !visible || dismissing;

  let transform: string;
  let transition: string;
  if (isDragging) {
    transform = `translate(-50%, ${dragY}px) scale(1)`;
    transition = 'none';
  } else if (isExiting) {
    const exitY = dragY < 0 ? dragY - 40 : -20;
    transform = `translate(-50%, ${exitY}px) scale(1)`;
    transition = `transform ${EXIT_MS}ms ${EXIT_EASING}, opacity ${EXIT_MS}ms ${EXIT_EASING}`;
  } else if (entered) {
    transform = 'translate(-50%, 0) scale(1)';
    transition = `transform ${ENTER_MS}ms ${ENTER_EASING}, opacity ${ENTER_MS}ms ${ENTER_EASING}`;
  } else {
    transform = 'translate(-50%, -30px) scale(0.85)';
    transition = `transform ${ENTER_MS}ms ${ENTER_EASING}, opacity ${ENTER_MS}ms ${ENTER_EASING}`;
  }
  const opacity = isExiting ? 0 : entered ? 1 : 0;

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!enableSwipeDismiss || e.button !== 0) return;
    dragStartYRef.current = e.clientY;
    lastDragYRef.current = 0;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const dy = Math.min(0, e.clientY - dragStartYRef.current);
    lastDragYRef.current = dy;
    if (!isDragging && dy < -2) setIsDragging(true);
    if (isDragging || dy < -2) setDragY(dy);
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStartYRef.current === null) return;
    const dy = lastDragYRef.current;
    dragStartYRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);

    setIsDragging(false);

    if (dy < SWIPE_THRESHOLD) {
      // Keep dragY so the exit animation continues upward from the drag
      // position rather than snapping back to 0 before fading.
      setDismissing(true);
    } else {
      setDragY(0);
    }
  };

  const handleClick = () => {
    if (lastDragYRef.current < -4) return;
    if (onToastPress) onToastPress();
  };

  const pill = (
    <div
      role="status"
      aria-live="polite"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform,
        opacity,
        transition,
        zIndex: 2147483647,
        width: 'min(360px, calc(100vw - 20px))',
        boxSizing: 'border-box',
        background: '#000',
        border: isDark ? `2px solid ${hexToRgba(color, 0.2)}` : 'none',
        borderRadius: 30,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
        touchAction: 'none',
        cursor: onToastPress ? 'pointer' : 'default',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.35)',
      }}
    >
      <div
        style={{
          width: 50,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 35,
          lineHeight: 1,
          color,
        }}
      >
        {glyph}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? (
          <div
            style={{
              color: '#fff',
              fontWeight: 600,
              fontSize: 15,
              lineHeight: '20px',
              wordBreak: 'break-word',
            }}
          >
            {title}
          </div>
        ) : null}
        {message ? (
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: 12,
              lineHeight: '16px',
              marginTop: title ? 4 : 0,
              wordBreak: 'break-word',
            }}
          >
            {message}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(pill, document.body);
}
