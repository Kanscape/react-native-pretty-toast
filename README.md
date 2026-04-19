<p align="center">
  <img src="./assets/logo.png" alt="react-native-pretty-toast" width="160" />
</p>

# react-native-pretty-toast

Dynamic Island toast notifications for React Native. On devices with a Dynamic Island, the toast animates from the island with a smooth scale effect. On older devices, it slides in from the top.

## Installation

```sh
npm install react-native-pretty-toast
```

### iOS Setup

#### Required: Info.plist

Add or update this key in your app's `Info.plist`:

```xml
<key>UIViewControllerBasedStatusBarAppearance</key>
<true/>
```

This is required for the toast to properly hide the status bar when displayed. Without it, the status bar will render on top of the toast.

**Expo users:** Add this to your `app.json`:

```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIViewControllerBasedStatusBarAppearance": true
      }
    }
  }
}
```

#### Requirements

- iOS 15.1+ (Dynamic Island features require iPhone 14 Pro or later; older devices get a slide-in toast)
- React Native 0.76+ (New Architecture / Fabric)

## Usage

Wrap your app with `ToastProvider` once at the root:

```tsx
import { ToastProvider } from 'react-native-pretty-toast';

export default function App() {
  return (
    <ToastProvider>
      <HomeScreen />
    </ToastProvider>
  );
}
```

You can then trigger toasts two ways — pick whichever fits the call site.

### 1. Imperative API (call from anywhere)

Import `toast` directly. Works in non-component code: API error handlers, redux middleware, utility modules, etc.

```tsx
import { toast } from 'react-native-pretty-toast';

toast.show({
  icon: 'checkmark.seal.fill',
  title: 'Transaction Success!',
  message: 'Your payment has been processed',
});
```

### 2. `useToast` hook (inside components)

```tsx
import { useToast } from 'react-native-pretty-toast';

function HomeScreen() {
  const toast = useToast();

  return (
    <Button
      title="Show Toast"
      onPress={() =>
        toast.show({
          icon: 'checkmark.seal.fill',
          title: 'Transaction Success!',
          message: 'Your payment has been processed',
          duration: 3000,
        })
      }
    />
  );
}
```

Both share the same queue and state — calls from either entry point behave identically.

## API

### `toast.show(config)`

Shows a toast notification. Returns a toast `id` string.

```ts
interface ToastConfig {
  id?: string;               // Auto-generated if omitted
  icon?: SFSymbolName;       // SF Symbol name (e.g. 'checkmark.seal.fill')
  title?: string;            // Bold title text
  message?: string;          // Subtitle text
  duration?: number;         // Auto-dismiss delay in ms (default: 3000, 0 = no auto-dismiss)
  autoDismiss?: boolean;     // Enable auto-dismiss (default: true)
  enableSwipeDismiss?: boolean; // Enable swipe-up to dismiss (default: true)
}
```

### `toast.dismiss(id?)`

Dismisses the current toast, or a specific queued toast by `id`.

### `toast.dismissAll()`

Dismisses the current toast and clears the queue.

### Queue behavior

Multiple `toast.show()` calls are queued. Each toast is displayed after the previous one is dismissed.

## SF Symbol Icons

The `icon` prop accepts any [SF Symbol](https://developer.apple.com/sf-symbols/) name. Browse the full catalog in Apple's SF Symbols app or online at **[sfsymbols.com](https://sfsymbols.com)**. Icon tint color is automatically determined:

| Symbol contains | Color |
|----------------|-------|
| `checkmark` | Green |
| `xmark` | Red |
| `exclamation` | Orange |
| `info` | Blue |
| `heart` | Pink |
| `arrow` | Blue |
| Other | Gray |

## Examples

```tsx
// Success
toast.show({
  icon: 'checkmark.seal.fill',
  title: 'Success!',
  message: 'File uploaded',
});

// Error
toast.show({
  icon: 'xmark.seal.fill',
  title: 'Failed',
  message: 'Network error',
  duration: 5000,
});

// Persistent (swipe to dismiss)
toast.show({
  icon: 'arrow.up.circle.fill',
  title: 'Uploading...',
  message: 'Swipe up to cancel',
  duration: 0,
  autoDismiss: false,
});
```

## License

MIT
