import ExpoModulesCore

public final class CyMusicSourceModule: Module {
  private var runtime: CyMusicUserApiRuntime!

  public override func didCreate() {
    runtime = CyMusicUserApiRuntime(
      preload: Bundle.main.url(forResource: "user-api-preload", withExtension: "js")
    ) { [weak self] event in
      self?.emit(event: "api-action", payload: event)
    }
  }

  public override func willDestroy() {
    runtime?.invalidate()
  }

  public override func didStartListening(event: String) {
    if event == "api-action" { runtime.startObserving() }
  }

  public override func didStopListening(event: String) {
    if event == "api-action" { runtime.stopObserving() }
  }

  public func definition() -> ModuleDefinition {
    Name("UserApiModule")
    Events("api-action")

    Function("loadScript") { (data: [String: String]) -> String in
      self.runtime.loadScript(data)
    }

    Function("sendAction") { (action: String, info: String, generation: String) in
      self.runtime.sendAction(action, info: info, generation: generation)
    }

    Function("destroy") { () -> String in
      self.runtime.destroy()
    }
  }
}
