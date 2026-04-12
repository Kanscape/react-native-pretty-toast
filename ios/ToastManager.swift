import SwiftUI
import Combine

/// Bridge between the Fabric component (ObjC++) and the SwiftUI toast views.
@objc public class ToastManager: NSObject {
    private var overlayWindow: PassThroughWindow?
    private var hostingController: CustomHostingView?
    private var autoDismissTimer: Timer?
    private var dismissCancellable: AnyCancellable?
    private var tapCancellable: AnyCancellable?
    /// Prevents double-firing onDismiss when programmatic dismiss
    /// also triggers the Combine subscription.
    private var isDismissing = false

    @objc public var onDismiss: (() -> Void)?
    @objc public var onPress: (() -> Void)?

    @objc public func show(
        icon: String,
        title: String,
        message: String,
        duration: Int,
        autoDismiss: Bool,
        enableSwipeDismiss: Bool
    ) {
        let isFirstShow = overlayWindow == nil
        ensureOverlayWindow()

        guard let overlayWindow else { return }

        let (primary, secondary) = iconColors(for: icon)

        let toast = Toast(
            symbol: icon,
            symbolFont: .system(size: 35),
            symbolForegroundStyle: (primary, secondary),
            title: title,
            message: message
        )

        overlayWindow.toast = toast
        overlayWindow.wasTapped = false
        isDismissing = false

        let present = { [weak self] in
            guard let self, let overlayWindow = self.overlayWindow else { return }
            overlayWindow.isPresented = true
            self.hostingController?.isStatusBarHidden = true
            overlayWindow.makeKey()

            self.cancelTimer()
            if autoDismiss && duration > 0 {
                let interval = TimeInterval(duration) / 1000.0
                self.autoDismissTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
                    DispatchQueue.main.async {
                        self?.dismiss()
                    }
                }
            }
        }

        if isFirstShow {
            DispatchQueue.main.async(execute: present)
        } else {
            present()
        }
    }

    @objc public func dismiss() {
        cancelTimer()

        guard let overlayWindow, overlayWindow.isPresented, !isDismissing else { return }
        isDismissing = true

        overlayWindow.isPresented = false
        hostingController?.isStatusBarHidden = false
        restoreKeyWindow()

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
            self?.onDismiss?()
        }
    }

    // MARK: - Overlay Window

    private func ensureOverlayWindow() {
        guard let windowScene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene })
            .first(where: { $0.activationState == .foregroundActive }) else { return }

        if let existing = windowScene.windows.first(where: { $0.tag == 1009 }) as? PassThroughWindow {
            overlayWindow = existing
            hostingController = existing.rootViewController as? CustomHostingView
        } else {
            let window = PassThroughWindow(windowScene: windowScene)
            window.backgroundColor = .clear
            window.isHidden = false
            window.isUserInteractionEnabled = true
            window.tag = 1009

            let hosting = CustomHostingView(
                rootView: DynamicToastView(window: window)
            )
            hosting.view.backgroundColor = .clear
            window.rootViewController = hosting

            overlayWindow = window
            hostingController = hosting
        }

        observeDismiss()
        observeTap()
    }

    /// Observe isPresented going false from swipe gesture (not from our dismiss() call).
    private func observeDismiss() {
        guard let overlayWindow else { return }

        dismissCancellable = overlayWindow.$isPresented
            .dropFirst()
            .filter { !$0 }
            .sink { [weak self] _ in
                guard let self, !self.isDismissing else { return }
                // Dismissed by swipe gesture — not by our dismiss() method
                self.isDismissing = true
                self.cancelTimer()
                self.hostingController?.isStatusBarHidden = false
                self.restoreKeyWindow()

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    self.onDismiss?()
                }
            }
    }

    /// Observe tap on the toast pill — just forward to JS, don't dismiss.
    private func observeTap() {
        guard let overlayWindow else { return }

        tapCancellable = overlayWindow.$wasTapped
            .dropFirst()
            .filter { $0 }
            .sink { [weak self] _ in
                guard let self else { return }
                self.overlayWindow?.wasTapped = false
                self.onPress?()
            }
    }

    // MARK: - Helpers

    private func restoreKeyWindow() {
        UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.tag != 1009 && !$0.isHidden }?
            .makeKey()
    }

    private func cancelTimer() {
        autoDismissTimer?.invalidate()
        autoDismissTimer = nil
    }

    private func iconColors(for symbol: String) -> (Color, Color) {
        if symbol.contains("checkmark") {
            return (.white, .green)
        } else if symbol.contains("xmark") {
            return (.white, .red)
        } else if symbol.contains("exclamation") {
            return (.white, .orange)
        } else if symbol.contains("info") {
            return (.white, .blue)
        } else if symbol.contains("heart") {
            return (.white, .pink)
        } else if symbol.contains("arrow") {
            return (.white, .blue)
        } else {
            return (.white, .gray)
        }
    }
}
