import ExpoModulesCore

public final class CyMusicFileSystemModule: Module {
  public func definition() -> ModuleDefinition {
    Name("CyMusicFileSystem")

    Constant("documentDirectoryPath") { CyMusicFileSystemPaths.documentDirectoryPath }
    Constant("libraryDirectoryPath") { CyMusicFileSystemPaths.libraryDirectoryPath }
    Constant("cachesDirectoryPath") { CyMusicFileSystemPaths.cachesDirectoryPath }

    AsyncFunction("exists") { (path: String) -> Bool in
      try CyMusicFileSystemPaths.exists(path)
    }

    AsyncFunction("stat") { (path: String) -> String in
      try CyMusicFileSystemPaths.fileType(path)
    }
  }
}
