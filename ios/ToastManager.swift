import SwiftUI
import Combine
import UIKit

/// Bridge between the Fabric component (ObjC++) and the SwiftUI toast views.
@objc public class ToastManager: NSObject {
    private var overlayWindow: PassThroughWindow?
    private var hostingController: CustomHostingView?
    private var autoDismissTimer: Timer?
    private var dismissCancellable: AnyCancellable?
    private var tapCancellable: AnyCancellable?
    private var actionCancellable: AnyCancellable?
    /// Prevents double-firing onDismiss when programmatic dismiss
    /// also triggers the Combine subscription.
    private var isDismissing = false
    /// Pending status-bar restore. Fires after the collapse animation so the
    /// bar doesn't reappear mid-animation. Cancelled by a follow-up show() so
    /// queued toasts don't flash the status bar between them.
    private var statusBarRestoreWorkItem: DispatchWorkItem?
    /// Image loads triggered while a URI prop is set. Kept so rapid updates
    /// can cancel prior in-flight fetches.
    private var imageLoadTask: URLSessionDataTask?

    @objc public var onDismiss: (() -> Void)?
    @objc public var onPress: (() -> Void)?
    @objc public var onActionPress: (() -> Void)?

    @objc public func show(
        icon: String,
        iconUri: String,
        title: String,
        message: String,
        duration: Int,
        autoDismiss: Bool,
        enableSwipeDismiss: Bool,
        useDynamicIsland: Bool,
        accentColor: UIColor?,
        strokeColor: UIColor?,
        disableBackdropSampling: Bool,
        actionLabel: String
    ) {
        let isFirstShow = overlayWindow == nil
        ensureOverlayWindow()

        guard let overlayWindow else { return }

        let (primary, secondary) = iconColors(for: icon)
        let accent = accentColor.map { Color($0) }
        let stroke = strokeColor.map { Color($0) }

        let toast = Toast(
            symbol: icon,
            symbolFont: .system(size: 35),
            symbolForegroundStyle: (primary, accent ?? secondary),
            title: title,
            message: message,
            customIcon: nil,
            accentOverride: accent,
            strokeOverride: stroke,
            disableBackdropSampling: disableBackdropSampling,
            actionLabel: actionLabel.isEmpty ? nil : actionLabel
        )

        overlayWindow.toast = toast
        overlayWindow.useDynamicIsland = useDynamicIsland
        overlayWindow.wasTapped = false
        overlayWindow.actionTapped = false
        isDismissing = false

        loadCustomIconIfNeeded(uri: iconUri)

        let present = { [weak self] in
            guard let self, let overlayWindow = self.overlayWindow else { return }
            overlayWindow.isPresented = true
            if !disableBackdropSampling {
                overlayWindow.startBackdropSampling()
            }
            self.cancelStatusBarRestore()
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

    /// Mutates the currently presented toast in place. Triggers a SwiftUI
    /// re-render via `@Published var toast` without re-running the expand
    /// animation. Resets the auto-dismiss timer so the updated content gets
    /// its full duration from this moment.
    @objc public func update(
        icon: String,
        iconUri: String,
        title: String,
        message: String,
        duration: Int,
        autoDismiss: Bool,
        accentColor: UIColor?,
        strokeColor: UIColor?,
        disableBackdropSampling: Bool,
        actionLabel: String
    ) {
        guard let overlayWindow, overlayWindow.isPresented else { return }

        let (primary, secondary) = iconColors(for: icon)
        let accent = accentColor.map { Color($0) }
        let stroke = strokeColor.map { Color($0) }

        // Preserve the previously resolved customIcon unless the URI changed
        // (loadCustomIconIfNeeded handles the swap below).
        let previous = overlayWindow.toast
        overlayWindow.toast = Toast(
            symbol: icon,
            symbolFont: .system(size: 35),
            symbolForegroundStyle: (primary, accent ?? secondary),
            title: title,
            message: message,
            customIcon: previous?.customIcon,
            accentOverride: accent,
            strokeOverride: stroke,
            disableBackdropSampling: disableBackdropSampling,
            actionLabel: actionLabel.isEmpty ? nil : actionLabel
        )

        loadCustomIconIfNeeded(uri: iconUri)

        if disableBackdropSampling {
            overlayWindow.stopBackdropSampling()
        } else if overlayWindow.isPresented {
            overlayWindow.startBackdropSampling()
        }

        cancelTimer()
        if autoDismiss && duration > 0 {
            let interval = TimeInterval(duration) / 1000.0
            autoDismissTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: false) { [weak self] _ in
                DispatchQueue.main.async {
                    self?.dismiss()
                }
            }
        }
    }

    @objc public func dismiss() {
        cancelTimer()

        guard let overlayWindow, overlayWindow.isPresented, !isDismissing else { return }
        isDismissing = true

        overlayWindow.isPresented = false
        overlayWindow.stopBackdropSampling()
        imageLoadTask?.cancel()
        imageLoadTask = nil
        scheduleStatusBarRestore()
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
                rootView: PrettyToastView(window: window)
            )
            hosting.view.backgroundColor = .clear
            window.rootViewController = hosting

            overlayWindow = window
            hostingController = hosting
        }

        observeDismiss()
        observeTap()
        observeAction()
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
                self.overlayWindow?.stopBackdropSampling()
                self.scheduleStatusBarRestore()
                self.restoreKeyWindow()

                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in
                    self?.onDismiss?()
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

    private func observeAction() {
        guard let overlayWindow else { return }

        actionCancellable = overlayWindow.$actionTapped
            .dropFirst()
            .filter { $0 }
            .sink { [weak self] _ in
                guard let self else { return }
                self.overlayWindow?.actionTapped = false
                self.onActionPress?()
            }
    }

    // MARK: - Helpers

    private func loadCustomIconIfNeeded(uri: String) {
        imageLoadTask?.cancel()
        imageLoadTask = nil

        if uri.isEmpty {
            overlayWindow?.toast?.customIcon = nil
            return
        }

        // data:, file:, and bundled asset URIs load synchronously.
        if let url = URL(string: uri),
           url.isFileURL,
           let image = UIImage(contentsOfFile: url.path) {
            overlayWindow?.toast?.customIcon = image
            // Reassign to trigger @Published.
            if var t = overlayWindow?.toast {
                t.customIcon = image
                overlayWindow?.toast = t
            }
            return
        }

        guard let url = URL(string: uri) else { return }

        imageLoadTask = URLSession.shared.dataTask(with: url) { [weak self] data, _, _ in
            guard let self, let data, let image = UIImage(data: data) else { return }
            DispatchQueue.main.async {
                if var t = self.overlayWindow?.toast {
                    t.customIcon = image
                    self.overlayWindow?.toast = t
                }
            }
        }
        imageLoadTask?.resume()
    }

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

    /// Collapse animation is ~0.35s. Add grace so a queued toast arriving via
    /// the JS round-trip can cancel the restore and keep the status bar hidden.
    private func scheduleStatusBarRestore() {
        statusBarRestoreWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in
            self?.hostingController?.isStatusBarHidden = false
        }
        statusBarRestoreWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5, execute: work)
    }

    private func cancelStatusBarRestore() {
        statusBarRestoreWorkItem?.cancel()
        statusBarRestoreWorkItem = nil
    }

    deinit {
        // deinit may run on any thread; Timer.invalidate() must run on the
        // runloop the timer was scheduled on (main), and UIWindow mutation is
        // main-thread-only. Break the retain cycle asynchronously on main.
        let window = overlayWindow
        let dismissCancel = dismissCancellable
        let tapCancel = tapCancellable
        let actionCancel = actionCancellable
        let timer = autoDismissTimer
        let workItem = statusBarRestoreWorkItem
        let loadTask = imageLoadTask
        DispatchQueue.main.async {
            timer?.invalidate()
            workItem?.cancel()
            dismissCancel?.cancel()
            tapCancel?.cancel()
            actionCancel?.cancel()
            loadTask?.cancel()
            window?.stopBackdropSampling()
            // Break PassThroughWindow → rootViewController → PrettyToastView →
            // @ObservedObject window so the window can actually deallocate.
            window?.rootViewController = nil
            window?.isHidden = true
        }
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
