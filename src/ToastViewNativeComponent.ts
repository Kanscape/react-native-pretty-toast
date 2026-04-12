import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type { ViewProps } from 'react-native';
import type {
  BubblingEventHandler,
  Int32,
} from 'react-native/Libraries/Types/CodegenTypes';

export interface NativeProps extends ViewProps {
  visible: boolean;
  icon?: string;
  title?: string;
  message?: string;
  duration?: Int32;
  autoDismiss?: boolean;
  enableSwipeDismiss?: boolean;
  onToastDismiss?: BubblingEventHandler<null>;
  onToastShow?: BubblingEventHandler<null>;
  onToastPress?: BubblingEventHandler<null>;
}

export default codegenNativeComponent<NativeProps>('ToastView');
