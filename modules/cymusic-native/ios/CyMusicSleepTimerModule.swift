import ExpoModulesCore

public final class CyMusicSleepTimerModule: Module {
  private var timer: CyMusicDeadlineTimer?
  private var destroyed = false

  public func definition() -> ModuleDefinition {
    Name("CyMusicSleepTimer")
    Events("deadline")

    Function("schedule") { (deadline: Double) -> String in
      guard deadline.isFinite else {
        throw NSError(domain: "CyMusicSleepTimer", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "Sleep deadline must be finite"
        ])
      }
      let generation = UUID().uuidString
      DispatchQueue.main.async {
        guard !self.destroyed else { return }
        // The synchronous boundary already validated this value.
        try? self.getTimer().schedule(generation: generation, deadline: deadline)
      }
      return generation
    }

    Function("cancel") {
      DispatchQueue.main.async {
        self.timer?.cancel()
      }
    }

    OnAppBecomesActive {
      DispatchQueue.main.async {
        self.timer?.checkDeadline()
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.destroyed = true
        self.timer?.cancel()
        self.timer = nil
      }
    }
  }

  private func getTimer() -> CyMusicDeadlineTimer {
    if let timer { return timer }
    let timer = CyMusicDeadlineTimer { [weak self] generation, deadline in
      self?.emit(event: "deadline", payload: [
        "generation": generation,
        "deadline": deadline
      ] as [String: Any])
    }
    self.timer = timer
    return timer
  }
}
