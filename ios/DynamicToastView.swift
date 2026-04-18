import SwiftUI

/// The SwiftUI toast view — ported from Kavsoft's DynamicIslandToast.
/// Uses ObservableObject/Published for broad iOS compatibility.
struct DynamicToastView: View {
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
                toastBackground
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
                    .offset(y: haveDynamicIsland ? topOffset : 0)
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
                    Image(systemName: toast.symbol)
                        .font(toast.symbolFont)
                        .foregroundStyle(toast.symbolForegroundStyle.0, toast.symbolForegroundStyle.1)
                        .modifier(WiggleModifier(isExpanded: isExpanded))
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

    @ViewBuilder
    var toastBackground: some View {
        if #available(iOS 26, *) {
            ConcentricRectangle(corners: .concentric(minimum: .fixed(30)), isUniform: true)
                .fill(.black)
        } else {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .fill(.black)
        }
    }

    var isExpanded: Bool {
        window.isPresented
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
