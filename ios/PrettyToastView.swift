import SwiftUI

/// The SwiftUI toast view — ported from Kavsoft's DynamicIslandToast.
/// Uses ObservableObject/Published for broad iOS compatibility.
struct PrettyToastView: View {
    @ObservedObject var window: PassThroughWindow
    /// Measured height of the toast content (icon + text block)
    @State private var measuredContentHeight: CGFloat = 0

    var body: some View {
        GeometryReader {
            let safeArea = $0.safeAreaInsets
            let size = $0.size

            let haveDynamicIsland: Bool = safeArea.top >= 59 && window.useDynamicIsland
            let dynamicIslandWidth: CGFloat = 120
            let dynamicIslandHeight: CGFloat = 36
            let topOffset: CGFloat = 11 + max((safeArea.top - 59), 0)
            // Nudge the expanded pill up slightly so the centered stroke at the
            // pill's top edge clears the DI's top line instead of sitting
            // half-behind it. The collapsed frame still morphs from `topOffset`
            // so the DI shape alignment is preserved.
            let expandedTopOffset: CGFloat = topOffset - 0.5

            let expandedWidth = size.width - 20
            // Base height from original. Add extra if content overflows.
            let baseHeight: CGFloat = haveDynamicIsland ? 90 : 70
            // Content area = baseHeight minus top DI space minus bottom padding
            let baseContentArea: CGFloat = haveDynamicIsland ? (baseHeight - dynamicIslandHeight - 12) : (baseHeight - 20)
            let overflow = max(0, measuredContentHeight - baseContentArea)
            let expandedHeight: CGFloat = baseHeight + overflow

            let scaleX: CGFloat = isExpanded ? 1 : (dynamicIslandWidth / expandedWidth)
            let scaleY: CGFloat = isExpanded ? 1 : (dynamicIslandHeight / expandedHeight)

            ZStack {
                toastBackground()
                    .overlay {
                        ToastContent(haveDynamicIsland, expandedWidth: expandedWidth)
                            .frame(width: expandedWidth, height: expandedHeight)
                            .scaleEffect(x: scaleX, y: scaleY)
                    }
                    .frame(
                        width: isExpanded ? expandedWidth : dynamicIslandWidth,
                        height: isExpanded ? expandedHeight : dynamicIslandHeight
                    )
                    .opacity(haveDynamicIsland ? 1 : (isExpanded ? 1 : 0))
                    .modifier(CapsuleOpacityModifier(
                        haveDynamicIsland: haveDynamicIsland,
                        isExpanded: isExpanded
                    ))
                    .modifier(GeometryGroupModifier())
                    .contentShape(Rectangle())
                    .onTapGesture {
                        window.wasTapped = true
                    }
                    .gesture(
                        DragGesture(minimumDistance: 2).onEnded { value in
                            if value.translation.height < -8 || value.predictedEndTranslation.height < -40 {
                                window.isPresented = false
                            }
                        }
                    )
                    // Use offset AFTER gestures — for DI it's fine since the offset
                    // is small and the pill is near the top. For non-DI, we use padding
                    // on the ZStack instead so the layout position matches.
                    .offset(y: haveDynamicIsland ? (isExpanded ? expandedTopOffset : topOffset) : 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
            .padding(.top, haveDynamicIsland ? 0 : (isExpanded ? safeArea.top + 10 : 0))
            .ignoresSafeArea()
            .animation(.bouncy(duration: 0.3, extraBounce: 0), value: isExpanded)
        }
    }

    @ViewBuilder
    func ToastContent(_ haveDynamicIsland: Bool, expandedWidth: CGFloat) -> some View {
        if let toast = window.toast {
            VStack(spacing: 0) {
                if haveDynamicIsland && !toast.message.isEmpty {
                    Spacer(minLength: 0)
                }

                HStack(spacing: 10) {
                    ToastIconView(toast: toast, isExpanded: isExpanded)
                        .frame(width: 50)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(toast.title)
                            .font(.callout)
                            .fontWeight(.semibold)
                            .foregroundStyle(.white)

                        if !toast.message.isEmpty {
                            Text(toast.message)
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    if let label = toast.actionLabel, !label.isEmpty {
                        Button(action: { window.actionTapped = true }) {
                            Text(label)
                                .font(.footnote)
                                .fontWeight(.semibold)
                                .foregroundStyle(toast.accentColor)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(
                                    Capsule().fill(Color.white.opacity(0.12))
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.bottom, haveDynamicIsland && !toast.message.isEmpty ? 12 : 0)
            .compositingGroup()
            .blur(radius: isExpanded ? 0 : 5)
            .opacity(isExpanded ? 1 : 0)

            // Hidden measurer: same content without Spacer/padding that affect layout,
            // constrained to the available text width, to get the natural content height.
            HStack(spacing: 10) {
                Color.clear.frame(width: 50, height: 1)

                VStack(alignment: .leading, spacing: 4) {
                    Text(toast.title)
                        .font(.callout)
                        .fontWeight(.semibold)

                    if !toast.message.isEmpty {
                        Text(toast.message)
                            .font(.caption)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 20)
            .fixedSize(horizontal: false, vertical: true)
            .background(
                GeometryReader { geo in
                    Color.clear.preference(
                        key: ContentHeightKey.self,
                        value: geo.size.height
                    )
                }
            )
            .hidden()
            .onPreferenceChange(ContentHeightKey.self) { height in
                measuredContentHeight = height
            }
        }
    }

    // MARK: - Pill background
    //
    // Pure black capsule with a dim outline. Mirrors Apple's DI: below
    // ~#0E luminance the outline takes the toast's accent colour; above
    // that point a very faint neutral outline stays visible on any
    // backdrop. `window.backdropTint` is driven by `PassThroughWindow`'s
    // luminance sampler. Two stroke layers crossfade independently so the
    // colour swap is a soft transition, not a pop.

    private func toastBackground() -> some View {
        let accent = window.toast?.accentColor ?? .white
        let strokeOverride = window.toast?.strokeOverride
        let disableSampling = window.toast?.disableBackdropSampling ?? false
        // If sampling is disabled, freeze the tint to gray so the static
        // neutral stroke layer is the one rendered.
        let tint: BackdropTint = disableSampling ? .gray : window.backdropTint
        return Group {
            if #available(iOS 26, *) {
                makeStrokeBackground(
                    shape: ConcentricRectangle(
                        corners: .concentric(minimum: .fixed(30)),
                        isUniform: true
                    ),
                    accent: accent,
                    strokeOverride: strokeOverride,
                    tint: tint
                )
            } else {
                makeStrokeBackground(
                    shape: RoundedRectangle(cornerRadius: 30, style: .continuous),
                    accent: accent,
                    strokeOverride: strokeOverride,
                    tint: tint
                )
            }
        }
    }

    private func makeStrokeBackground<S: Shape>(
        shape: S,
        accent: Color,
        strokeOverride: Color?,
        tint: BackdropTint
    ) -> some View {
        // Two stacked stroke layers, each with its own scoped opacity
        // animation. Using the iOS 17 closure overload scopes the easeInOut
        // to just the opacity transform; frame changes fall through to the
        // ambient bouncy animation so the stroke never drifts away from the
        // pill geometry during expand/collapse.
        shape
            .fill(.black)
            .overlay {
                ZStack {
                    if let override = strokeOverride {
                        // Explicit stroke override — paint a single fixed
                        // layer at full alpha. No crossfade; the caller owns
                        // the color, including its alpha channel.
                        strokeLayer(shape: shape, color: override, alpha: 1.0, visible: isExpanded)
                    } else {
                        // Accent layer ~20% alpha reads well on very dark
                        // backdrops. The neutral gray layer is pinned much
                        // lower (~6%) so it just barely separates the pill
                        // from a near-black backdrop and fades into nothing on
                        // lighter ones — matching Apple's restrained DI look.
                        strokeLayer(shape: shape, color: accent, alpha: 0.2, visible: isExpanded && tint == .colored)
                        strokeLayer(shape: shape, color: .white, alpha: 0.06, visible: isExpanded && tint == .gray)
                    }
                }
            }
    }

    @ViewBuilder
    private func strokeLayer<S: Shape>(shape: S, color: Color, alpha: Double, visible: Bool) -> some View {
        let stroke = shape.stroke(color.opacity(alpha), lineWidth: 1.5)
        if #available(iOS 17, *) {
            stroke.animation(.easeInOut(duration: 0.3)) { view in
                view.opacity(visible ? 1 : 0)
            }
        } else {
            stroke
                .opacity(visible ? 1 : 0)
                .animation(.easeInOut(duration: 0.3), value: visible)
        }
    }

    var isExpanded: Bool {
        window.isPresented
    }
}

// MARK: - Icon view
//
// Renders either the resolved custom UIImage (when a consumer passed an
// `iconSource`) or the SF Symbol fallback. The symbol path keeps the wiggle
// effect on expand; the custom image path uses plain content-fit scaling.

struct ToastIconView: View {
    let toast: Toast
    let isExpanded: Bool

    var body: some View {
        if let image = toast.customIcon {
            Image(uiImage: image)
                .resizable()
                .renderingMode(.original)
                .aspectRatio(contentMode: .fit)
                .frame(width: 35, height: 35)
        } else {
            Image(systemName: toast.symbol)
                .font(toast.symbolFont)
                .foregroundStyle(toast.symbolForegroundStyle.0, toast.symbolForegroundStyle.1)
                .modifier(WiggleModifier(isExpanded: isExpanded))
        }
    }
}

// MARK: - Preference key

private struct ContentHeightKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

// MARK: - Wiggle effect (iOS 18+)

private struct WiggleModifier: ViewModifier {
    let isExpanded: Bool

    func body(content: Content) -> some View {
        if #available(iOS 18, *) {
            content.symbolEffect(.wiggle, value: isExpanded)
        } else {
            content
        }
    }
}

// MARK: - Compatibility modifiers

private struct CapsuleOpacityModifier: ViewModifier {
    let haveDynamicIsland: Bool
    let isExpanded: Bool

    func body(content: Content) -> some View {
        if #available(iOS 17, *) {
            content
                .animation(.linear(duration: 0.02).delay(isExpanded ? 0 : 0.28)) { inner in
                    inner.opacity(haveDynamicIsland ? (isExpanded ? 1 : 0) : 1)
                }
        } else {
            content
                .opacity(haveDynamicIsland ? (isExpanded ? 1 : 0) : 1)
                .animation(.linear(duration: 0.02).delay(isExpanded ? 0 : 0.28), value: isExpanded)
        }
    }
}

private struct GeometryGroupModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 17, *) {
            content.geometryGroup()
        } else {
            content
        }
    }
}
