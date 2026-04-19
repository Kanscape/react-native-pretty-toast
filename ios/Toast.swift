import SwiftUI

struct Toast {
    private(set) var id: String = UUID().uuidString
    var symbol: String
    var symbolFont: Font
    var symbolForegroundStyle: (Color, Color)
    var title: String
    var message: String

    /// SF Symbol fill color — doubles as the pill's accent tint for the
    /// Apple-style stroke we draw around the expanded pill in dark mode.
    var accentColor: Color { symbolForegroundStyle.1 }
}
