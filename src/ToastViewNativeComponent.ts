import { codegenNativeComponent } from 'react-native';
import type { ColorValue, ViewProps } from 'react-native';
import type {
  BubblingEventHandler,
  Int32,
} from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  visible: boolean;
  /** SF Symbol name. See https://developer.apple.com/sf-symbols/ */
  icon?: string;
  /** URI for a custom icon image (resolved from ImageSourcePropType). */
  iconUri?: string;
  title?: string;
  message?: string;
  duration?: Int32;
  autoDismiss?: boolean;
  enableSwipeDismiss?: boolean;
  useDynamicIsland?: boolean;
  accentColor?: ColorValue;
  strokeColor?: ColorValue;
  disableBackdropSampling?: boolean;
  actionLabel?: string;
  onToastDismiss?: BubblingEventHandler<null>;
  onToastShow?: BubblingEventHandler<null>;
  onToastPress?: BubblingEventHandler<null>;
  onToastActionPress?: BubblingEventHandler<null>;
}

export default codegenNativeComponent<NativeProps>('ToastView');
