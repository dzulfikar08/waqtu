import Foundation

/// Shared container id used to exchange prayer data between the app, widgets and watch.
/// iOS/watchOS use a registered `group.` App Group. On macOS a team-prefixed group id needs no
/// provisioned App Group, so the Developer ID and Mac App Store builds use that form
/// (entitlement `$(TeamIdentifierPrefix)com.waqtu.shared`, team F6Q6UFUK69).
enum AppGroup {
    #if os(macOS)
    static let id = "F6Q6UFUK69.com.waqtu.shared"
    #else
    static let id = "group.com.waqtu.shared"
    #endif
}
