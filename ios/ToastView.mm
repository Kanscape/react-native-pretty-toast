#import "ToastView.h"

#import <React/RCTConversions.h>

#import <react/renderer/components/ToastViewSpec/ComponentDescriptors.h>
#import <react/renderer/components/ToastViewSpec/EventEmitters.h>
#import <react/renderer/components/ToastViewSpec/Props.h>
#import <react/renderer/components/ToastViewSpec/RCTComponentViewHelpers.h>

#import "RCTFabricComponentsPlugins.h"

#if __has_include("react_native_dynamic_toast-Swift.h")
#import "react_native_dynamic_toast-Swift.h"
#elif __has_include("Toast-Swift.h")
#import "Toast-Swift.h"
#endif

using namespace facebook::react;

@implementation ToastView {
    BOOL _visible;
    int _duration;
    BOOL _autoDismiss;
    BOOL _enableSwipeDismiss;
    BOOL _useDynamicIsland;
    NSString *_icon;
    NSString *_title;
    NSString *_message;
    ToastManager *_manager;
    BOOL _isCurrentlyShowing;
}

+ (ComponentDescriptorProvider)componentDescriptorProvider
{
    return concreteComponentDescriptorProvider<ToastViewComponentDescriptor>();
}

- (instancetype)initWithFrame:(CGRect)frame
{
    if (self = [super initWithFrame:frame]) {
        static const auto defaultProps = std::make_shared<const ToastViewProps>();
        _props = defaultProps;

        _visible = NO;
        _duration = 3000;
        _autoDismiss = YES;
        _enableSwipeDismiss = YES;
        _useDynamicIsland = YES;
        _icon = @"";
        _title = @"";
        _message = @"";
        _isCurrentlyShowing = NO;

        _manager = [[ToastManager alloc] init];

        __weak ToastView *weakSelf = self;
        _manager.onDismiss = ^{
            __strong ToastView *strongSelf = weakSelf;
            if (strongSelf) {
                strongSelf->_isCurrentlyShowing = NO;
                [strongSelf emitDismissEvent];
            }
        };

        _manager.onPress = ^{
            __strong ToastView *strongSelf = weakSelf;
            if (strongSelf) {
                [strongSelf emitPressEvent];
            }
        };

        self.hidden = YES;
    }
    return self;
}

- (void)updateProps:(Props::Shared const &)props oldProps:(Props::Shared const &)oldProps
{
    const auto &oldViewProps = *std::static_pointer_cast<ToastViewProps const>(_props);
    const auto &newViewProps = *std::static_pointer_cast<ToastViewProps const>(props);

    _visible = newViewProps.visible;
    _duration = newViewProps.duration;
    _autoDismiss = newViewProps.autoDismiss;
    _enableSwipeDismiss = newViewProps.enableSwipeDismiss;
    _useDynamicIsland = newViewProps.useDynamicIsland;
    _icon = [NSString stringWithUTF8String:newViewProps.icon.c_str()];
    _title = [NSString stringWithUTF8String:newViewProps.title.c_str()];
    _message = [NSString stringWithUTF8String:newViewProps.message.c_str()];

    [super updateProps:props oldProps:oldProps];

    if (oldViewProps.visible != newViewProps.visible) {
        if (_visible) {
            [self showToast];
        } else {
            [self dismissToast];
        }
    }
}

- (void)showToast
{
    if (_isCurrentlyShowing) return;
    _isCurrentlyShowing = YES;

    [_manager showWithIcon:_icon
                     title:_title
                   message:_message
                  duration:_duration
               autoDismiss:_autoDismiss
        enableSwipeDismiss:_enableSwipeDismiss
          useDynamicIsland:_useDynamicIsland];
}

- (void)dismissToast
{
    if (!_isCurrentlyShowing) return;
    _isCurrentlyShowing = NO;
    [_manager dismiss];
}

- (void)emitDismissEvent
{
    if (_eventEmitter) {
        auto viewEventEmitter = std::static_pointer_cast<ToastViewEventEmitter const>(_eventEmitter);
        viewEventEmitter->onToastDismiss({});
    }
}

- (void)emitPressEvent
{
    if (_eventEmitter) {
        auto viewEventEmitter = std::static_pointer_cast<ToastViewEventEmitter const>(_eventEmitter);
        viewEventEmitter->onToastPress({});
    }
}

- (void)prepareForRecycle
{
    if (_isCurrentlyShowing) {
        [_manager dismiss];
    }
    _isCurrentlyShowing = NO;
    [super prepareForRecycle];
}

@end
