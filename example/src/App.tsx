import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Alert,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  View,
  Image,
  Platform,
} from 'react-native';
import { ToastProvider, useToast } from 'react-native-dynamic-toast';

const COLORS = {
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

function Cell({ row, showSeparator }: { row: Row; showSeparator: boolean }) {
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

function SectionBlock({ section }: { section: Section }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionHeader}>{section.title}</Text>
      <View style={styles.sectionBody}>
        {section.rows.map((row, idx) => (
          <Cell
            key={row.id}
            row={row}
            showSeparator={idx < section.rows.length - 1}
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
  const [count, setCount] = useState(0);

  const sections: Section[] = [
    {
      title: 'Feedback',
      footer: 'Status toasts with semantic color tinting.',
      rows: [
        {
          id: 'success',
          title: 'Success',
          subtitle: 'Transaction completed',
          glyph: '✓',
          tint: COLORS.systemGreen,
          onPress: () => {
            setCount((c) => c + 1);
            toast.show({
              icon: 'checkmark.seal.fill',
              title: 'Transaction Success!',
              message: `Payment #${count + 1} completed`,
              duration: 3000,
            });
          },
        },
        {
          id: 'error',
          title: 'Error',
          subtitle: 'Something went wrong',
          glyph: '✕',
          tint: COLORS.systemRed,
          onPress: () => {
            toast.show({
              icon: 'xmark.seal.fill',
              title: 'Transaction Failed!',
              message: 'Please try again later',
              duration: 4000,
            });
          },
        },
        {
          id: 'info',
          title: 'Info',
          subtitle: 'Neutral information',
          glyph: 'i',
          glyphStyle: 'serifItalic',
          tint: COLORS.systemBlue,
          onPress: () => {
            toast.show({
              icon: 'info.circle.fill',
              title: 'Info',
              message: 'Tap the button to continue',
              duration: 3000,
            });
          },
        },
        {
          id: 'warning',
          title: 'Warning',
          subtitle: 'Attention required',
          glyph: '!',
          tint: COLORS.systemOrange,
          onPress: () => {
            toast.show({
              icon: 'exclamationmark.triangle.fill',
              title: 'Warning',
              message: 'Low battery',
              duration: 3000,
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
          tint: COLORS.systemCyan,
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
          tint: COLORS.systemIndigo,
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
          tint: COLORS.systemPurple,
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
          tint: COLORS.systemTeal,
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
          tint: COLORS.systemPink,
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
          tint: COLORS.systemMint,
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
      title: 'Queue',
      footer: 'Multiple calls are shown in sequence.',
      rows: [
        {
          id: 'rapid',
          title: 'Fire 3 Rapidly',
          subtitle: 'Queued display',
          glyph: '≡',
          tint: COLORS.systemOrange,
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
          tint: COLORS.systemGray,
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
        <Text style={styles.largeTitle}>React Native Dynamic Toast</Text>
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
            <Text style={styles.badgeText}>v0.1.0</Text>
          </View>
        </View>
      </View>

      {sections.map((section) => (
        <SectionBlock key={section.title} section={section} />
      ))}

      <Text style={styles.colophon}>react-native-dynamic-toast</Text>
    </ScrollView>
  );
}

export default function App() {
  return (
    <>
      <ToastProvider useDynamicIsland={true}>
        <HomeScreen />
      </ToastProvider>
      <StatusBar style="dark" />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: COLORS.systemGroupedBackground,
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
    color: COLORS.secondaryLabel,
    marginBottom: 10,
  },
  largeTitle: {
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: 0.37,
    color: COLORS.label,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.secondaryLabel,
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
    backgroundColor: COLORS.badgeBackground,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.secondaryLabel,
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
    color: COLORS.secondaryLabel,
    paddingHorizontal: 32,
    marginBottom: 8,
  },
  sectionBody: {
    marginHorizontal: 20,
    backgroundColor: COLORS.secondaryGroupedBackground,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sectionFooter: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.secondaryLabel,
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
    backgroundColor: COLORS.cellHighlight,
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
    color: COLORS.label,
    fontWeight: '400',
  },
  cellSubtitle: {
    fontSize: 13,
    letterSpacing: -0.08,
    color: COLORS.secondaryLabel,
    marginTop: 2,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '500',
    color: COLORS.chevron,
    marginLeft: 8,
    lineHeight: 22,
  },
  separator: {
    position: 'absolute',
    bottom: 0,
    left: 58,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.separator,
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
    color: COLORS.tertiaryLabel,
    marginTop: 4,
    letterSpacing: -0.08,
  },
});
