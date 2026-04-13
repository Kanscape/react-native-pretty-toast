import { useState } from 'react';
import {
  Alert,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { ToastProvider, useToast } from 'react-native-toast';

function HomeScreen() {
  const toast = useToast();
  const [count, setCount] = useState(0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>Dynamic Island Toast</Text>

      <TouchableOpacity
        style={[styles.button, styles.successButton]}
        onPress={() => {
          setCount((c) => c + 1);
          toast.show({
            icon: 'checkmark.seal.fill',
            title: 'Transaction Success!',
            message: `Payment #${count + 1} completed`,
            duration: 3000,
          });
        }}
      >
        <Text style={styles.buttonText}>Success</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.errorButton]}
        onPress={() => {
          toast.show({
            icon: 'xmark.seal.fill',
            title: 'Transaction Failed!',
            message: 'Please try again later',
            duration: 4000,
          });
        }}
      >
        <Text style={styles.buttonText}>Error</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.infoButton]}
        onPress={() => {
          toast.show({
            icon: 'info.circle.fill',
            title: 'Info',
            message: 'Tap the button to continue',
            duration: 3000,
          });
        }}
      >
        <Text style={styles.buttonText}>Info</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.warningButton]}
        onPress={() => {
          toast.show({
            icon: 'exclamationmark.triangle.fill',
            title: 'Warning',
            message: 'Low battery',
            duration: 3000,
          });
        }}
      >
        <Text style={styles.buttonText}>Warning</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#0ea5e9' }]}
        onPress={() => {
          toast.show({
            icon: 'hand.tap.fill',
            title: 'Tap me!',
            message: 'This toast has an onPress handler',
            duration: 5000,
            onPress: () => {
              Alert.alert('Toast Pressed', 'You tapped the toast!');
            },
          });
        }}
      >
        <Text style={styles.buttonText}>Tappable Toast</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#8b5cf6' }]}
        onPress={() => {
          toast.show({
            icon: 'envelope.fill',
            title:
              'You have a new message from John Appleseed regarding the project',
            message:
              'Hey, I wanted to follow up on the discussion we had earlier about the new feature implementation timeline and resource allocation',
            duration: 5000,
          });
        }}
      >
        <Text style={styles.buttonText}>Long Title + Long Message</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#06b6d4' }]}
        onPress={() => {
          toast.show({
            icon: 'arrow.down.circle.fill',
            title:
              'Downloading "My_Vacation_Photos_2024_Summer_Collection.zip"',
            message: '3.2 GB remaining',
            duration: 4000,
          });
        }}
      >
        <Text style={styles.buttonText}>Long Title + Short Message</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#ec4899' }]}
        onPress={() => {
          toast.show({
            icon: 'heart.fill',
            title: 'Liked!',
            message:
              'Your like has been saved and the author will be notified about your appreciation',
            duration: 4000,
          });
        }}
      >
        <Text style={styles.buttonText}>Short Title + Long Message</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#14b8a6' }]}
        onPress={() => {
          toast.show({
            icon: 'wifi',
            title: 'Connected',
            message: '',
            duration: 2000,
          });
        }}
      >
        <Text style={styles.buttonText}>Title Only (No Message)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.persistentButton]}
        onPress={() => {
          toast.show({
            icon: 'arrow.up.circle.fill',
            title: 'Uploading...',
            message: 'Swipe up to dismiss',
            duration: 0,
            autoDismiss: false,
          });
        }}
      >
        <Text style={styles.buttonText}>Persistent (Swipe to dismiss)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#f97316' }]}
        onPress={() => {
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
        }}
      >
        <Text style={styles.buttonText}>Queue (3 toasts rapid-fire)</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, styles.dismissButton]}
        onPress={() => toast.dismissAll()}
      >
        <Text style={styles.buttonText}>Dismiss All</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default function App() {
  return (
    <ToastProvider useDynamicIsland={true}>
      <HomeScreen />
    </ToastProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 60,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    color: '#111',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#22c55e',
  },
  errorButton: {
    backgroundColor: '#ef4444',
  },
  infoButton: {
    backgroundColor: '#3b82f6',
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
  persistentButton: {
    backgroundColor: '#6366f1',
  },
  dismissButton: {
    backgroundColor: '#6b7280',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
