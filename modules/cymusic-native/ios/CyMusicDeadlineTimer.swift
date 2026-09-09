import Foundation

final class CyMusicDeadlineTimer {
  private struct Deadline {
    let generation: String
    let milliseconds: Double
  }

  private var current: Deadline?
  private var timer: Timer?
  private let onDeadline: (String, Double) -> Void

  init(onDeadline: @escaping (String, Double) -> Void) {
    self.onDeadline = onDeadline
  }

  deinit {
    timer?.invalidate()
  }

  func schedule(generation: String, deadline: Double) throws {
    precondition(Thread.isMainThread)
    guard deadline.isFinite else {
      throw NSError(domain: "CyMusicSleepTimer", code: 1, userInfo: [
        NSLocalizedDescriptionKey: "Sleep deadline must be finite"
      ])
    }
    cancel()
    current = Deadline(generation: generation, milliseconds: deadline)
    armTimer()
  }

  func cancel() {
    precondition(Thread.isMainThread)
    timer?.invalidate()
    timer = nil
    current = nil
  }

  func checkDeadline() {
    precondition(Thread.isMainThread)
    guard let current else { return }
    if Date().timeIntervalSince1970 * 1000 < current.milliseconds {
      if timer == nil { armTimer() }
      return
    }
    cancel()
    onDeadline(current.generation, current.milliseconds)
  }

  private func armTimer() {
    guard let current else { return }
    timer?.invalidate()
    let timer = Timer(
      fire: Date(timeIntervalSince1970: current.milliseconds / 1000),
      interval: 0,
      repeats: false
    ) { [weak self] _ in
      guard let self, self.current?.generation == current.generation else { return }
      self.timer = nil
      self.checkDeadline()
    }
    self.timer = timer
    RunLoop.main.add(timer, forMode: .common)
  }
}
