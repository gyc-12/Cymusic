import Darwin
import Foundation

enum CyMusicFileSystemPaths {
  // Preserve the raw Foundation strings used by the existing databases and media roots.
  static let documentDirectoryPath = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true)[0]
  static let libraryDirectoryPath = NSSearchPathForDirectoriesInDomains(.libraryDirectory, .userDomainMask, true)[0]
  static let cachesDirectoryPath = NSSearchPathForDirectoriesInDomains(.cachesDirectory, .userDomainMask, true)[0]

  private static func attributes(_ path: String) throws -> Darwin.stat {
    guard path.hasPrefix("/"), !path.utf8.contains(0) else {
      throw NSError(domain: NSPOSIXErrorDomain, code: Int(EINVAL), userInfo: [NSFilePathErrorKey: path])
    }
    var info = Darwin.stat()
    guard Darwin.lstat(path, &info) == 0 else {
      throw NSError(domain: NSPOSIXErrorDomain, code: Int(errno), userInfo: [NSFilePathErrorKey: path])
    }
    return info
  }

  static func exists(_ path: String) throws -> Bool {
    do {
      _ = try attributes(path)
      return true
    } catch let error as NSError where error.domain == NSPOSIXErrorDomain &&
      (error.code == Int(ENOENT) || error.code == Int(ENOTDIR)) {
      return false
    }
  }

  static func fileType(_ path: String) throws -> String {
    let info = try attributes(path)
    switch info.st_mode & mode_t(S_IFMT) {
    case mode_t(S_IFREG): return "file"
    case mode_t(S_IFDIR): return "directory"
    case mode_t(S_IFLNK): return "symlink"
    default: return "other"
    }
  }
}
