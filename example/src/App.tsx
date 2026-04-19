import { useMemo, useState } from 'react';
import {
  Alert,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
  View,
  Image,
  Platform,
  useColorScheme,
} from 'react-native';
import {
  toast as imperativeToast,
  ToastProvider,
  useToast,
} from 'react-native-pretty-toast';
import { version } from '../../package.json';

// Imperative API demo: these helpers live outside the component tree
// and can be called from anywhere (API clients, redux middleware, utils).
async function simulateApiCall() {
  const work = new Promise<{ items: number }>((resolve) =>
    setTimeout(() => resolve({ items: 42 }), 1500)
  );
  await imperativeToast.promise(work, {
    loading: { title: 'Syncing...', message: 'Fetching latest data' },
    success: (value) => ({
      title: 'Sync complete',
      message: `${value.items} items up to date`,
    }),
    error: 'Sync failed',
  });
}

function reportErrorFromModule(err: Error) {
  imperativeToast.error('Unexpected error', {
    message: err.message,
    duration: 4000,
  });
}

function makeColors(isDark: boolean) {
  if (isDark) {
    return {
      systemGroupedBackground: '#000000',
      secondaryGroupedBackground: '#1C1C1E',
      separator: 'rgba(84, 84, 88, 0.65)',
      label: '#FFFFFF',
      secondaryLabel: 'rgba(235, 235, 245, 0.6)',
      tertiaryLabel: 'rgba(235, 235, 245, 0.3)',
      chevron: 'rgba(235, 235, 245, 0.3)',
      cellHighlight: '#2C2C2E',
      badgeBackground: 'rgba(120, 120, 128, 0.24)',
      systemGreen: '#30D158',
      systemRed: '#FF453A',
      systemBlue: '#0A84FF',
      systemOrange: '#FF9F0A',
      systemPurple: '#BF5AF2',
      systemPink: '#FF375F',
      systemIndigo: '#5E5CE6',
      systemTeal: '#64D2FF',
      systemMint: '#63E6E2',
      systemCyan: '#64D2FF',
      systemGray: '#8E8E93',
    };
  }
  return {
    systemGroupedBackground: '#F2F2F7',
    secondaryGroupedBackground: '#FFFFFF',
    separator: 'rgba(60, 60, 67, 0.29)',
    label: '#000000',
    secondaryLabel: 'rgba(60, 60, 67, 0.6)',
    tertiaryLabel: 'rgba(60, 60, 67, 0.3)',
    chevron: 'rgba(60, 60, 67, 0.3)',
    cellHighlight: '#D1D1D6',
    badgeBackground: 'rgba(60, 60, 67, 0.08)',
    systemGreen: '#34C759',
    systemRed: '#FF3B30',
    systemBlue: '#007AFF',
    systemOrange: '#FF9500',
    systemPurple: '#AF52DE',
    systemPink: '#FF2D55',
    systemIndigo: '#5856D6',
    systemTeal: '#5AC8FA',
    systemMint: '#00C7BE',
    systemCyan: '#32ADE6',
    systemGray: '#8E8E93',
  };
}

type ThemeColors = ReturnType<typeof makeColors>;
type AppStyles = ReturnType<typeof makeStyles>;

type Row = {
  id: string;
  title: string;
  subtitle?: string;
  glyph: string;
  glyphStyle?: 'default' | 'serifItalic';
  tint: string;
  onPress: () => void;
};

type Section = {
  title: string;
  footer?: string;
  rows: Row[];
};

function Cell({
  row,
  showSeparator,
  styles,
}: {
  row: Row;
  showSeparator: boolean;
  styles: AppStyles;
}) {
  return (
    <Pressable
      onPress={row.onPress}
      style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
    >
      <View style={[styles.glyphTile, { backgroundColor: row.tint }]}>
        <Text
          style={[
            styles.glyph,
            row.glyphStyle === 'serifItalic' && styles.glyphSerifItalic,
          ]}
          allowFontScaling={false}
        >
          {row.glyph}
        </Text>
      </View>
      <View style={styles.cellContent}>
        <View style={styles.cellText}>
          <Text style={styles.cellTitle} numberOfLines={1}>
            {row.title}
          </Text>
          {row.subtitle ? (
            <Text style={styles.cellSubtitle} numberOfLines={1}>
              {row.subtitle}
            </Text>
          ) : null}
        </View>
        <Text style={styles.chevron} allowFontScaling={false}>
          ›
        </Text>
      </View>
      {showSeparator ? <View style={styles.separator} /> : null}
    </Pressable>
  );
}

function SectionBlock({
  section,
  styles,
}: {
  section: Section;
  styles: AppStyles;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{section.title}</Text>
      <View style={styles.sectionBody}>
        {section.rows.map((row, idx) => (
          <Cell
            key={row.id}
            row={row}
            showSeparator={idx < section.rows.length - 1}
            styles={styles}
          />
        ))}
      </View>
      {section.footer ? (
        <Text style={styles.sectionFooter}>{section.footer}</Text>
      ) : null}
    </View>
  );
}

function HomeScreen() {
  const toast = useToast();
  const systemIsDark = useColorScheme() === 'dark';
  const [inverted, setInverted] = useState(false);
  const isDark = inverted ? !systemIsDark : systemIsDark;
  const colors = useMemo(() => makeColors(isDark), [isDark]);
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [count, setCount] = useState(0);

  const sections: Section[] = [
    {
      title: 'Variants',
      footer: 'Preset shortcuts: toast.success / error / info / warning.',
      rows: [
        {
          id: 'success',
          title: 'Success',
          subtitle: 'toast.success(…)',
          glyph: '✓',
          tint: colors.systemGreen,
          onPress: () => {
            setCount((c) => c + 1);
            toast.success('Transaction Success!', {
              message: `Payment #${count + 1} completed`,
            });
          },
        },
        {
          id: 'error',
          title: 'Error',
          subtitle: 'toast.error(…)',
          glyph: '✕',
          tint: colors.systemRed,
          onPress: () => {
            toast.error('Transaction Failed!', {
              message: 'Please try again later',
              duration: 4000,
            });
          },
        },
        {
          id: 'info',
          title: 'Info',
          subtitle: 'toast.info(…)',
          glyph: 'i',
          glyphStyle: 'serifItalic',
          tint: colors.systemBlue,
          onPress: () => {
            toast.info('Info', { message: 'Tap the button to continue' });
          },
        },
        {
          id: 'warning',
          title: 'Warning',
          subtitle: 'toast.warning(…)',
          glyph: '!',
          tint: colors.systemOrange,
          onPress: () => {
            toast.warning('Warning', { message: 'Low battery' });
          },
        },
      ],
    },
    {
      title: 'Promise & Update',
      footer:
        'toast.promise morphs loading → result. toast.update mutates an existing toast.',
      rows: [
        {
          id: 'promise',
          title: 'toast.promise',
          subtitle: 'Loading → success in one call',
          glyph: '↻',
          tint: colors.systemIndigo,
          onPress: () => {
            const work = new Promise<number>((resolve) =>
              setTimeout(() => resolve(Math.floor(Math.random() * 100)), 1800)
            );
            toast.promise(work, {
              loading: 'Uploading…',
              success: (n) => `Uploaded ${n} files`,
              error: 'Upload failed',
            });
          },
        },
        {
          id: 'promise-reject',
          title: 'Promise rejects',
          subtitle: 'loading → error',
          glyph: '⚠',
          tint: colors.systemOrange,
          onPress: () => {
            const work = new Promise<void>((_, reject) =>
              setTimeout(() => reject(new Error('Network')), 1400)
            );
            toast
              .promise(work, {
                loading: 'Saving…',
                success: 'Saved',
                error: (e) => `Failed: ${(e as Error).message}`,
              })
              .catch(() => {});
          },
        },
        {
          id: 'update',
          title: 'toast.update',
          subtitle: 'Live-mutate the active toast',
          glyph: '✎',
          tint: colors.systemTeal,
          onPress: () => {
            const id = toast.loading('Preparing…', {
              message: 'Step 1 of 3',
            });
            setTimeout(() => toast.update(id, { message: 'Step 2 of 3' }), 900);
            setTimeout(() => {
              toast.update(id, {
                icon: 'checkmark.circle.fill',
                title: 'Done',
                message: 'All 3 steps complete',
                autoDismiss: true,
                duration: 2500,
              });
            }, 1800);
          },
        },
      ],
    },
    {
      title: 'Styling',
      footer: 'Override tint/outline per toast or supply a custom icon image.',
      rows: [
        {
          id: 'accent',
          title: 'Custom accent color',
          subtitle: 'Overrides the icon-derived tint',
          glyph: '●',
          tint: colors.systemPurple,
          onPress: () => {
            toast.show({
              icon: 'sparkles',
              title: 'Purple rain',
              message: 'accentColor drives icon + stroke',
              accentColor: colors.systemPurple,
            });
          },
        },
        {
          id: 'stroke',
          title: 'Fixed stroke color',
          subtitle: 'Static outline, sampler off',
          glyph: '◯',
          tint: colors.systemCyan,
          onPress: () => {
            toast.show({
              icon: 'wifi',
              title: 'Hard-coded outline',
              message: 'strokeColor + disableBackdropSampling',
              strokeColor: colors.systemCyan,
              disableBackdropSampling: true,
            });
          },
        },
        {
          id: 'custom-icon',
          title: 'Custom icon image',
          subtitle: 'Uses iconSource (require)',
          glyph: 'I',
          tint: colors.systemPink,
          onPress: () => {
            toast.show({
              iconSource: require('../assets/icon.png'),
              title: 'Custom asset',
              message: 'iconSource wins over icon',
            });
          },
        },
      ],
    },
    {
      title: 'Action button',
      footer: 'Adds a trailing button inside the pill (sonner-style "Undo").',
      rows: [
        {
          id: 'undo',
          title: 'With Undo',
          subtitle: 'Tap "Undo" to reverse',
          glyph: '↩',
          tint: colors.systemOrange,
          onPress: () => {
            const ok = toast.success('Deleted', {
              message: 'Item moved to Trash',
              duration: 5000,
              action: {
                label: 'Undo',
                onPress: () => toast.info('Restored'),
              },
            });
            return ok;
          },
        },
      ],
    },
    {
      title: 'Advanced',
      footer: 'force bypasses the queue. Lifecycle callbacks log to console.',
      rows: [
        {
          id: 'force',
          title: 'Force (interrupt)',
          subtitle: 'Queues a slow toast, then forces over it',
          glyph: '⚡',
          tint: colors.systemPurple,
          onPress: () => {
            toast.show({
              icon: 'info.circle.fill',
              title: 'Background task',
              message: 'Will be interrupted',
              duration: 10000,
            });
            setTimeout(() => {
              toast.show(
                {
                  icon: 'exclamationmark.triangle.fill',
                  title: 'Session expired',
                  message: 'Please log in again',
                  duration: 3500,
                },
                { force: true }
              );
            }, 600);
          },
        },
        {
          id: 'lifecycle',
          title: 'Lifecycle callbacks',
          subtitle: 'onShow / onHide / onAutoDismiss',
          glyph: '◎',
          tint: colors.systemMint,
          onPress: () => {
            toast.info('Watching lifecycle', {
              message: 'Check the JS console',
              duration: 1500,
              onShow: () => console.log('[toast] onShow'),
              onHide: () => console.log('[toast] onHide'),
              onAutoDismiss: () => console.log('[toast] onAutoDismiss'),
            });
          },
        },
      ],
    },
    {
      title: 'Interactive',
      footer: 'Toasts can respond to taps or stay until dismissed.',
      rows: [
        {
          id: 'tappable',
          title: 'Tappable Toast',
          subtitle: 'onPress handler attached',
          glyph: '◉',
          tint: colors.systemCyan,
          onPress: () => {
            toast.show({
              icon: 'hand.tap.fill',
              title: 'Tap me!',
              message: 'This toast has an onPress handler',
              duration: 5000,
              onPress: () => {
                Alert.alert('Toast Pressed', 'You tapped the toast!');
              },
            });
          },
        },
        {
          id: 'persistent',
          title: 'Persistent',
          subtitle: 'Swipe up to dismiss',
          glyph: '↑',
          tint: colors.systemIndigo,
          onPress: () => {
            toast.show({
              icon: 'arrow.up.circle.fill',
              title: 'Uploading...',
              message: 'Swipe up to dismiss',
              duration: 0,
              autoDismiss: false,
            });
          },
        },
      ],
    },
    {
      title: 'Content Variations',
      footer: 'The island adapts its size to the content length.',
      rows: [
        {
          id: 'longlong',
          title: 'Long Title + Long Message',
          subtitle: 'Both fields overflow',
          glyph: '¶',
          tint: colors.systemPurple,
          onPress: () => {
            toast.show({
              icon: 'envelope.fill',
              title:
                'You have a new message from John Appleseed regarding the project',
              message:
                'Hey, I wanted to follow up on the discussion we had earlier about the new feature implementation timeline and resource allocation',
              duration: 5000,
            });
          },
        },
        {
          id: 'longshort',
          title: 'Long Title + Short Message',
          subtitle: 'Title wraps, body compact',
          glyph: '↓',
          tint: colors.systemTeal,
          onPress: () => {
            toast.show({
              icon: 'arrow.down.circle.fill',
              title:
                'Downloading "My_Vacation_Photos_2024_Summer_Collection.zip"',
              message: '3.2 GB remaining',
              duration: 4000,
            });
          },
        },
        {
          id: 'shortlong',
          title: 'Short Title + Long Message',
          subtitle: 'Compact header, body wraps',
          glyph: '♥',
          tint: colors.systemPink,
          onPress: () => {
            toast.show({
              icon: 'heart.fill',
              title: 'Liked!',
              message:
                'Your like has been saved and the author will be notified about your appreciation',
              duration: 4000,
            });
          },
        },
        {
          id: 'titleonly',
          title: 'Title Only',
          subtitle: 'No message body',
          glyph: 'A',
          tint: colors.systemMint,
          onPress: () => {
            toast.show({
              icon: 'wifi',
              title: 'Connected',
              message: '',
              duration: 2000,
            });
          },
        },
      ],
    },
    {
      title: 'Imperative API',
      footer:
        'Triggered from module-level functions — no hook, no component context.',
      rows: [
        {
          id: 'imperative-api-call',
          title: 'Simulate API Call',
          subtitle: 'Fires from an async function',
          glyph: '↻',
          tint: colors.systemBlue,
          onPress: () => {
            simulateApiCall();
          },
        },
        {
          id: 'imperative-error',
          title: 'Report Error',
          subtitle: 'Fires from a plain module helper',
          glyph: '!',
          tint: colors.systemRed,
          onPress: () => {
            reportErrorFromModule(new Error('Network request failed'));
          },
        },
      ],
    },
    {
      title: 'Queue',
      footer: 'Multiple calls are shown in sequence.',
      rows: [
        {
          id: 'rapid',
          title: 'Fire 3 Rapidly',
          subtitle: 'Queued display',
          glyph: '≡',
          tint: colors.systemOrange,
          onPress: () => {
            toast.show({
              icon: 'checkmark.seal.fill',
              title: 'Toast 1',
              message: 'First in queue',
              duration: 2000,
            });
            toast.show({
              icon: 'xmark.seal.fill',
              title: 'Toast 2',
              message: 'Second in queue',
              duration: 2000,
            });
            toast.show({
              icon: 'info.circle.fill',
              title: 'Toast 3',
              message: 'Third in queue',
              duration: 2000,
            });
          },
        },
        {
          id: 'dismiss',
          title: 'Dismiss All',
          subtitle: 'Clear active and queued',
          glyph: '×',
          tint: colors.systemGray,
          onPress: () => toast.dismissAll(),
        },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View style={styles.logoWrap}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>
        <Text style={styles.largeTitle}>React Native Pretty Toast</Text>
        <Text style={styles.subtitle}>
          Dynamic Island and top-slide toast notifications.
        </Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>iOS 15.1+</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Fabric</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>v{version}</Text>
          </View>
        </View>
        <View style={styles.themeToggleRow}>
          <Text style={styles.themeToggleLabel}>
            {isDark ? 'Dark' : 'Light'} theme
          </Text>
          <Switch
            value={inverted}
            onValueChange={setInverted}
            ios_backgroundColor={colors.badgeBackground}
          />
        </View>
      </View>

      {sections.map((section) => (
        <SectionBlock key={section.title} section={section} styles={styles} />
      ))}

      <Text style={styles.colophon}>react-native-pretty-toast</Text>
    </ScrollView>
  );
}

export default function App() {
  return (
    <ToastProvider
      useDynamicIsland={true}
      defaultConfig={{ duration: 3000, autoDismiss: true }}
      maxQueue={5}
    >
      <HomeScreen />
    </ToastProvider>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: c.systemGroupedBackground,
    },
    container: {
      paddingBottom: 56,
    },

    header: {
      paddingHorizontal: 20,
      paddingTop: 72,
      paddingBottom: 28,
    },
    logoWrap: {
      width: 100,
      height: 100,
      borderRadius: 26,
      overflow: 'hidden',
      marginBottom: 18,
      alignSelf: 'center',
      backgroundColor: '#FFFFFF',
    },
    logo: {
      width: '100%',
      height: '100%',
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 1.6,
      color: c.secondaryLabel,
      marginBottom: 10,
    },
    largeTitle: {
      fontSize: 23,
      fontWeight: '700',
      letterSpacing: 0.37,
      color: c.label,
      marginBottom: 6,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 20,
      color: c.secondaryLabel,
      textAlign: 'center',
    },
    badgeRow: {
      alignSelf: 'center',
      flexDirection: 'row',
      gap: 6,
      marginTop: 14,
    },
    badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
      backgroundColor: c.badgeBackground,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: c.secondaryLabel,
      letterSpacing: -0.08,
    },
    themeToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'center',
      gap: 10,
      marginTop: 18,
    },
    themeToggleLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: c.secondaryLabel,
      letterSpacing: -0.08,
    },

    section: {
      marginBottom: 28,
    },
    sectionHeader: {
      fontSize: 13,
      fontWeight: '400',
      textTransform: 'uppercase',
      letterSpacing: -0.08,
      color: c.secondaryLabel,
      paddingHorizontal: 32,
      marginBottom: 8,
    },
    sectionBody: {
      marginHorizontal: 20,
      backgroundColor: c.secondaryGroupedBackground,
      borderRadius: 14,
      overflow: 'hidden',
    },
    sectionFooter: {
      fontSize: 13,
      lineHeight: 18,
      color: c.secondaryLabel,
      paddingHorizontal: 32,
      paddingTop: 8,
    },

    cell: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 58,
      paddingLeft: 16,
    },
    cellPressed: {
      backgroundColor: c.cellHighlight,
    },
    cellContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingRight: 16,
    },
    cellText: {
      flex: 1,
    },
    cellTitle: {
      fontSize: 17,
      letterSpacing: -0.4,
      color: c.label,
      fontWeight: '400',
    },
    cellSubtitle: {
      fontSize: 13,
      letterSpacing: -0.08,
      color: c.secondaryLabel,
      marginTop: 2,
    },
    chevron: {
      fontSize: 20,
      fontWeight: '500',
      color: c.chevron,
      marginLeft: 8,
      lineHeight: 22,
    },
    separator: {
      position: 'absolute',
      bottom: 0,
      left: 58,
      right: 0,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.separator,
    },

    glyphTile: {
      width: 30,
      height: 30,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    glyph: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '700',
      textAlign: 'center',
      includeFontPadding: false,
    },
    glyphSerifItalic: {
      fontFamily: Platform.select({
        ios: 'Georgia',
        default: 'serif',
      }),
      fontStyle: 'italic',
      fontWeight: '400',
      fontSize: 19,
    },

    colophon: {
      textAlign: 'center',
      fontSize: 12,
      color: c.tertiaryLabel,
      marginTop: 4,
      letterSpacing: -0.08,
    },
  });
}
