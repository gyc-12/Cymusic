import Foundation

private struct FixtureFailure: Error {}

private func expect(_ condition: @autoclosure () -> Bool) throws {
  if !condition() { throw FixtureFailure() }
}

private func requireToken(_ value: String?) throws -> String {
  guard let value else { throw FixtureFailure() }
  return value
}

private func now() -> Double { Date().timeIntervalSince1970 * 1000 }
private func runLoop(_ seconds: Double) { RunLoop.main.run(until: Date().addingTimeInterval(seconds)) }

private final class NativeTaskFixture {
  var expirations: [() -> Void] = []
  var ended: [Int] = []
  var denied = false
  var sameIdentifier = false
  var beforeReturn: (() -> Void)?

  func registry() -> CyMusicRequestTaskRegistry<Int> {
    CyMusicRequestTaskRegistry<Int>(begin: { expiration in
      self.expirations.append(expiration)
      self.beforeReturn?()
      return self.denied ? nil : (self.sameIdentifier ? 1 : self.expirations.count)
    }, end: { self.ended.append($0) })
  }
}

@main
struct NativeServicesProbe {
  static func main() {
    var passed = 0
    var failed = 0
    func check(_ label: String, _ run: () throws -> Void) {
      do {
        try run()
        passed += 1
        print("PASS \(label)")
      } catch {
        failed += 1
        print("FAIL \(label): \(error)")
      }
    }

    check("real Foundation timer delivers its generation and wall-clock deadline once") {
      var events: [(String, Double, Double)] = []
      let timer = CyMusicDeadlineTimer { events.append(($0, $1, now())) }
      let deadline = now() + 20
      try timer.schedule(generation: "first", deadline: deadline)
      runLoop(0.08)
      try expect(events.count == 1)
      try expect(events[0].0 == "first" && events[0].1 == deadline && events[0].2 >= deadline)
      timer.checkDeadline()
      try expect(events.count == 1)
    }

    check("cancellation prevents a scheduled native callback") {
      var calls = 0
      let timer = CyMusicDeadlineTimer { _, _ in calls += 1 }
      try timer.schedule(generation: "cancelled", deadline: now() + 20)
      timer.cancel()
      runLoop(0.06)
      try expect(calls == 0)
    }

    check("replacement cancels the old native deadline") {
      var events: [String] = []
      let timer = CyMusicDeadlineTimer { generation, _ in events.append(generation) }
      try timer.schedule(generation: "old", deadline: now() + 20)
      try timer.schedule(generation: "new", deadline: now() + 60)
      runLoop(0.10)
      try expect(events == ["new"])
    }

    check("overdue foreground checks and timer delivery settle once") {
      var events: [String] = []
      let timer = CyMusicDeadlineTimer { generation, _ in events.append(generation) }
      try timer.schedule(generation: "overdue", deadline: now() - 10)
      timer.checkDeadline()
      timer.checkDeadline()
      runLoop(0.02)
      try expect(events == ["overdue"])
    }

    check("invalid deadlines reject without discarding an existing schedule") {
      var events: [String] = []
      let timer = CyMusicDeadlineTimer { generation, _ in events.append(generation) }
      try timer.schedule(generation: "retained", deadline: now() + 20)
      var rejected = false
      do { try timer.schedule(generation: "invalid", deadline: .nan) }
      catch { rejected = true }
      runLoop(0.06)
      try expect(rejected && events == ["retained"])
    }

    check("timer deallocation invalidates pending callbacks") {
      var calls = 0
      var timer: CyMusicDeadlineTimer? = CyMusicDeadlineTimer { _, _ in calls += 1 }
      try timer?.schedule(generation: "destroyed", deadline: now() + 20)
      timer = nil
      runLoop(0.06)
      try expect(calls == 0)
    }

    check("expiry cleanup does not erase a schedule created by its callback") {
      var events: [String] = []
      var timer: CyMusicDeadlineTimer?
      timer = CyMusicDeadlineTimer { generation, _ in
        events.append(generation)
        if generation == "first" { try? timer?.schedule(generation: "second", deadline: now() + 20) }
      }
      try timer?.schedule(generation: "first", deadline: now() + 20)
      runLoop(0.10)
      try expect(events == ["first", "second"])
      timer?.cancel()
      timer = nil
    }

    check("task completion is idempotent") {
      let native = NativeTaskFixture()
      let tasks = native.registry()
      let token = try requireToken(tasks.begin())
      tasks.end(token)
      tasks.end(token)
      try expect(native.ended == [1])
    }

    check("OS expiry and later JS completion end a native task once") {
      let native = NativeTaskFixture()
      let tasks = native.registry()
      let token = try requireToken(tasks.begin())
      native.expirations[0]()
      tasks.end(token)
      native.expirations[0]()
      try expect(native.ended == [1])
    }

    check("teardown releases all live tasks and prevents new ones") {
      let native = NativeTaskFixture()
      let tasks = native.registry()
      let first = try requireToken(tasks.begin())
      let second = try requireToken(tasks.begin())
      try expect(first != second)
      tasks.invalidate()
      tasks.invalidate()
      tasks.end(first)
      try expect(tasks.begin() == nil)
      try expect(native.ended.sorted() == [1, 2] && native.expirations.count == 2)
    }

    check("OS denial creates no task to end") {
      let native = NativeTaskFixture()
      native.denied = true
      let tasks = native.registry()
      try expect(tasks.begin() == nil)
      tasks.invalidate()
      try expect(native.ended.isEmpty)
    }

    check("expiry before begin returns cannot leave a live task") {
      let native = NativeTaskFixture()
      native.beforeReturn = { native.expirations.last?() }
      let tasks = native.registry()
      try expect(tasks.begin() == nil)
      tasks.invalidate()
      try expect(native.ended == [1])
    }

    check("teardown during begin releases a subsequently returned identifier") {
      let native = NativeTaskFixture()
      let tasks = native.registry()
      native.beforeReturn = { tasks.invalidate() }
      try expect(tasks.begin() == nil)
      try expect(native.ended == [1])
    }

    check("a stale expiry cannot end a new task reusing the same UIKit identifier") {
      let native = NativeTaskFixture()
      native.sameIdentifier = true
      let tasks = native.registry()
      let first = try requireToken(tasks.begin())
      tasks.end(first)
      let second = try requireToken(tasks.begin())
      try expect(first != second)
      native.expirations[0]()
      try expect(native.ended == [1])
      tasks.end(second)
      try expect(native.ended == [1, 1])
    }

    print("\(passed) passed, \(failed) failed; actual Foundation timer and task-registry owners")
    if failed > 0 { exit(1) }
  }
}
