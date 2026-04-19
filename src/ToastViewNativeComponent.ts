import { codegenNativeComponent } from 'react-native';
import type { ViewProps } from 'react-native';
import type {
  BubblingEventHandler,
  Int32,
} from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  visible: boolean;
  /** SF Symbol name. See https://developer.apple.com/sf-symbols/ */
  icon?: string;
  title?: string;
  message?: string;
  duration?: Int32;
  autoDismiss?: boolean;
  enableSwipeDismiss?: boolean;
  useDynamicIsland?: boolean;
  onToastDismiss?: BubblingEventHandler<null>;
  onToastShow?: BubblingEventHandler<null>;
  onToastPress?: BubblingEventHandler<null>;
}

export default codegenNativeComponent<NativeProps>('ToastView');
