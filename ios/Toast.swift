import SwiftUI

struct Toast {
    private(set) var id: String = UUID().uuidString
    var symbol: String
    var symbolFont: Font
    var symbolForegroundStyle: (Color, Color)
    var title: String
    var message: String
}
