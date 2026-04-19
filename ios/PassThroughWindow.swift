import SwiftUI
import Combine

enum BackdropTint {
    case colored  // backdrop dark enough to warrant the full accent outline
    case gray     // everything lighter — a very faint neutral outline
}

class PassThroughWindow: UIWindow, ObservableObject {
    @Published var toast: Toast? = nil
    @Published var isPresented: Bool = false
    @Published var useDynamicIsland: Bool = true
    @Published var wasTapped: Bool = false
    @Published var actionTapped: Bool = false

    /// Mirrors Apple's DI: below ~#0E luminance the outline takes the
    /// accent colour; above that point a very faint neutral outline
    /// stays visible regardless of how much lighter the backdrop gets.
    /// Sampled on a timer while `isPresented` is true.
    @Published var backdropTint: BackdropTint = .gray

    private var backdropTimer: Timer?
    /// Debounce state for `backdropTint`. The luminance sample can cross the
    /// flip point briefly during scroll/transition animations; we only commit
    /// a new tint once the same value has been observed for ≥250ms so the
    /// stroke doesn't flicker on transient backdrop changes.
    private var pendingTint: BackdropTint?
    private var pendingTintSince: CFAbsoluteTime = 0

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let hitView = super.hitTest(point, with: event),
              let rootView = rootViewController?.view else {
            return nil
        }

        if #available(iOS 26, *) {
            if rootView.layer.hitTest(point)?.name == nil {
                return rootView
            }
            return nil
        } else {
            if #unavailable(iOS 18) {
                return hitView == rootView ? nil : hitView
            } else {
                for subview in rootView.subviews.reversed() {
                    let pointInSubView = subview.convert(point, from: rootView)
                    if subview.hitTest(pointInSubView, with: event) != nil {
                        return hitView
                    }
                }
                return nil
            }
        }
    }

    // MARK: - Backdrop sampling
    //
    // Renders a tiny bitmap of the pixels beneath the pill (top strip of the
    // app window, below our overlay) and averages their luminance. The
    // averaged luma then drives a three-state tint on `backdropTint`
    // (`colored` / `gray` / `none`) calibrated against Apple's own DI flip
    // points at #0E and #1D. Runs at ~8Hz while the toast is on-screen; the
    // bitmap is 32×8px so the cost per sample is negligible.

    func startBackdropSampling() {
        stopBackdropSampling()
        sampleBackdrop()
        // Schedule on `.common` so the timer keeps firing while the user is
        // dragging a ScrollView — `Timer.scheduledTimer` defaults to
        // `.default` mode, which is swapped out for `UITrackingRunLoopMode`
        // during scroll tracking, pausing the sampler and making the
        // outline appear to "stick" until the user lets go.
        let timer = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in
            self?.sampleBackdrop()
        }
        RunLoop.main.add(timer, forMode: .common)
        backdropTimer = timer
    }

    func stopBackdropSampling() {
        backdropTimer?.invalidate()
        backdropTimer = nil
        pendingTint = nil
    }

    deinit {
        stopBackdropSampling()
    }

    private func sampleBackdrop() {
        guard let scene = windowScene else { return }
        // Pick the backmost visible window — i.e. the app's main window,
        // not transient overlays (dev menu, keyboard, alerts…). `windows`
        // isn't guaranteed ordered, so we select explicitly by the lowest
        // `windowLevel`.
        let candidates = scene.windows.filter { $0 !== self && !$0.isHidden }
        guard let contentWindow = candidates.min(by: { $0.windowLevel < $1.windowLevel }) else { return }

        let bitmapWidth = 32
        let bitmapHeight = 8
        var pixels = [UInt8](repeating: 0, count: bitmapWidth * bitmapHeight * 4)

        guard let context = CGContext(
            data: &pixels,
            width: bitmapWidth,
            height: bitmapHeight,
            bitsPerComponent: 8,
            bytesPerRow: bitmapWidth * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
        ) else { return }

        // Sample the top strip where the pill sits. Wide enough to cover the
        // expanded pill, tall enough to span title + message. Kept as tight as
        // possible — `layer.render(in:)` cost scales with the source area.
        let sampleRect = CGRect(
            x: 0, y: 0,
            width: contentWindow.bounds.width,
            height: 80
        )

        // CALayer.render draws in UIKit coords (top-left origin) — flip the
        // CGContext y axis and scale so the sampleRect maps onto our bitmap.
        context.saveGState()
        context.translateBy(x: 0, y: CGFloat(bitmapHeight))
        context.scaleBy(x: 1, y: -1)
        let sx = CGFloat(bitmapWidth) / sampleRect.width
        let sy = CGFloat(bitmapHeight) / sampleRect.height
        context.scaleBy(x: sx, y: sy)
        context.translateBy(x: -sampleRect.origin.x, y: -sampleRect.origin.y)
        contentWindow.layer.render(in: context)
        context.restoreGState()

        var totalLuma: Double = 0
        let pixelCount = bitmapWidth * bitmapHeight
        for i in 0..<pixelCount {
            let r = Double(pixels[i * 4 + 0]) / 255.0
            let g = Double(pixels[i * 4 + 1]) / 255.0
            let b = Double(pixels[i * 4 + 2]) / 255.0
            totalLuma += 0.299 * r + 0.587 * g + 0.114 * b
        }
        let avgLuma = totalLuma / Double(pixelCount)

        // Single flip point at ~#0E (14/255 ≈ 0.055), matching Apple's DI:
        // below that the outline takes the accent colour, above it a very
        // faint neutral stroke stays visible on any lighter backdrop. The
        // ±0.005 hysteresis stops pixels right on the boundary flickering.
        let tint: BackdropTint
        switch backdropTint {
        case .colored:
            tint = avgLuma > 0.060 ? .gray : .colored
        default:
            tint = avgLuma < 0.050 ? .colored : .gray
        }

        if tint == backdropTint {
            pendingTint = nil
            return
        }

        let now = CFAbsoluteTimeGetCurrent()
        if pendingTint != tint {
            pendingTint = tint
            pendingTintSince = now
            return
        }

        if now - pendingTintSince >= 0.25 {
            backdropTint = tint
            pendingTint = nil
        }
    }
}
