// Compile together with CyMusicFileSystemPaths.swift; no Expo or application build is used.
import Darwin
import Foundation

@main
struct NativeFileSystemCheck {
  static func main() throws {
    let manager = FileManager.default
    let root = manager.temporaryDirectory.appendingPathComponent("cymusic-native-files-\(UUID().uuidString)")
    try manager.createDirectory(at: root, withIntermediateDirectories: true)
    defer { try? manager.removeItem(at: root) }
    var checks = 0
    func verify(_ condition: Bool, _ message: String) {
      precondition(condition, message)
      checks += 1
    }
    func expectError(_ path: String, code: Int32, existence: Bool = false) {
      do {
        if existence { _ = try CyMusicFileSystemPaths.exists(path) }
        else { _ = try CyMusicFileSystemPaths.fileType(path) }
        preconditionFailure("Expected a native error for \(path)")
      } catch let error as NSError {
        verify(error.domain == NSPOSIXErrorDomain && error.code == Int(code), "Native error must preserve errno")
      }
    }
    for (actual, directory) in [
      (CyMusicFileSystemPaths.documentDirectoryPath, FileManager.SearchPathDirectory.documentDirectory),
      (CyMusicFileSystemPaths.libraryDirectoryPath, .libraryDirectory),
      (CyMusicFileSystemPaths.cachesDirectoryPath, .cachesDirectory)
    ] {
      verify(actual == NSSearchPathForDirectoriesInDomains(directory, .userDomainMask, true).first, "Root must equal the original Foundation query")
      verify(actual.hasPrefix("/") && !actual.hasPrefix("file:"), "Root must be a raw path")
    }
    let file = root.appendingPathComponent("音频 #100%23?.mp3").path
    try Data("retained bytes".utf8).write(to: URL(fileURLWithPath: file))
    verify(try CyMusicFileSystemPaths.exists(file), "Raw Unicode/hash/percent filename must exist")
    verify(try CyMusicFileSystemPaths.fileType(file) == "file", "Regular file type")
    verify(try CyMusicFileSystemPaths.fileType(root.path) == "directory", "Directory type")
    let missing = root.appendingPathComponent("missing").path
    verify(try !CyMusicFileSystemPaths.exists(missing), "Missing path must return false")
    verify(try !CyMusicFileSystemPaths.exists(file + "/child"), "Non-directory ancestor is not an existing path")
    expectError(missing, code: ENOENT)
    for (name, target) in [("file-link", file), ("directory-link", root.path), ("dangling-link", missing)] {
      let link = root.appendingPathComponent(name).path
      try manager.createSymbolicLink(atPath: link, withDestinationPath: target)
      verify(try CyMusicFileSystemPaths.exists(link), "A link itself exists, including dangling links")
      verify(try CyMusicFileSystemPaths.fileType(link) == "symlink", "Probe must not follow a final symlink")
    }
    let fifo = root.appendingPathComponent("fifo").path
    precondition(mkfifo(fifo, 0o600) == 0)
    verify(try CyMusicFileSystemPaths.fileType(fifo) == "other", "FIFO must not be a regular file")
    let loop = root.appendingPathComponent("loop").path
    try manager.createSymbolicLink(atPath: loop, withDestinationPath: loop)
    expectError(loop + "/child", code: ELOOP, existence: true)
    expectError(loop + "/child", code: ELOOP)
    expectError("file://" + file, code: EINVAL, existence: true)
    expectError(file + "\0suffix", code: EINVAL)
    print("{\"check\":\"native-files-foundation\",\"passed\":\(checks),\"failed\":0,\"scope\":\"macOS Foundation/Darwin; iOS Expo registration remains a separate native gate\"}")
  }
}
