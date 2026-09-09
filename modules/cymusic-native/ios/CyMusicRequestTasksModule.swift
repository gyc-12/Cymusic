import ExpoModulesCore
import UIKit

public final class CyMusicRequestTasksModule: Module {
  private var tasks: CyMusicRequestTaskRegistry<UIBackgroundTaskIdentifier>?
  private var destroyed = false

  public func definition() -> ModuleDefinition {
    Name("CyMusicRequestTasks")

    AsyncFunction("beginTask") { () -> String? in
      guard !self.destroyed else { return nil }
      return self.getTasks().begin()
    }
    .runOnQueue(.main)

    AsyncFunction("endTask") { (identifier: String) in
      self.tasks?.end(identifier)
    }
    .runOnQueue(.main)

    OnDestroy {
      DispatchQueue.main.async {
        self.destroyed = true
        self.tasks?.invalidate()
        self.tasks = nil
      }
    }
  }

  private func getTasks() -> CyMusicRequestTaskRegistry<UIBackgroundTaskIdentifier> {
    if let tasks { return tasks }
    let tasks = CyMusicRequestTaskRegistry<UIBackgroundTaskIdentifier>(
      begin: { expiration in
        let identifier = UIApplication.shared.beginBackgroundTask(withName: "CyMusic request") {
          if Thread.isMainThread {
            expiration()
          } else {
            DispatchQueue.main.async(execute: expiration)
          }
        }
        return identifier == .invalid ? nil : identifier
      },
      end: { identifier in
        UIApplication.shared.endBackgroundTask(identifier)
      }
    )
    self.tasks = tasks
    return tasks
  }
}
