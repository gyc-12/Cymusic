import Foundation

// These stand-ins record calls at the unavailable iOS player/system boundary.
// TrackPlayer's handlers, routing functions and event models are compiled from
// the installed package by check-rntp-remote-native.mjs.
enum MPRemoteCommandHandlerStatus { case success, commandFailed }

final class RemoteProbeTrace {
  var entries: [String] = []
  var events: [EmitEvent] = []
}

final class RemoteProbePlayer {
  var state: PlayerState
  var currentTime: TimeInterval = 12
  var playResult: PlayerState = .playing
  var pauseResult: PlayerState = .paused
  let trace: RemoteProbeTrace

  init(state: PlayerState, trace: RemoteProbeTrace) {
    self.state = state
    self.trace = trace
  }

  func play() { trace.entries.append("play"); state = playResult }
  func pause() { trace.entries.append("pause"); state = pauseResult }
  func stop() { trace.entries.append("stop"); state = .idle; currentTime = 0 }
  func next() { trace.entries.append("next") }
  func previous() { trace.entries.append("previous") }
  func seek(to position: TimeInterval) {
    trace.entries.append("seek:\(position)")
    currentTime = position
  }
}

final class TrackPlayer {
  var remoteControlHandling: RemoteControlHandling
  var perCommandHandling: [String: RemoteControlHandling]
  let trace = RemoteProbeTrace()
  let player: RemoteProbePlayer

  init(handling: RemoteControlHandling, override: RemoteControlHandling? = nil, state: PlayerState = .playing) {
    remoteControlHandling = handling
    perCommandHandling = Dictionary(uniqueKeysWithValues: PlayerCommand.allCases.compactMap { command in
      override.map { (command.rawValue, $0) }
    })
    player = RemoteProbePlayer(state: state, trace: trace)
  }

  func emitEvent(event: EmitEvent) {
    trace.events.append(event)
    trace.entries.append(event.eventType.rawValue)
  }
}

private struct RoutingCase {
  let name: String
  let handling: RemoteControlHandling
  let override: RemoteControlHandling?
  let executes: Bool
  let transportEvent: Bool
  let navigationEvent: Bool
  let seekEvent: Bool
  let skipEvent: Bool
}

@main
struct RNTPRemoteProbe {
  static var assertions = 0
  static var failures = 0
  static var scenarios = 0

  static func check(_ value: Bool, _ description: String) {
    assertions += 1
    if !value {
      failures += 1
      if failures <= 12 { print("FAIL \(description)") }
    }
  }

  static func verify(
    _ subject: TrackPlayer, _ status: MPRemoteCommandHandlerStatus,
    context: String, action: String?, event: EmitEventType?, body: [String: Any] = [:]
  ) {
    scenarios += 1
    let expectedOrder = [action, event?.rawValue].compactMap { $0 }
    check(status == .success, "\(context): accepted")
    check(subject.trace.entries == expectedOrder,
          "\(context): expected \(expectedOrder), received \(subject.trace.entries)")
    check(subject.trace.events.count == (event == nil ? 0 : 1), "\(context): event count")
    if let observed = subject.trace.events.first {
      check(observed.eventType == event, "\(context): event type")
      check(NSDictionary(dictionary: observed.body).isEqual(to: body), "\(context): event payload")
    }
  }

  static func main() {
    // Explicit expectations protect each supported ownership configuration.
    // Pure native/js ownership deliberately ignores per-command overrides.
    let routes: [RoutingCase] = [
      .init(name: "native/default", handling: .native, override: nil, executes: true,
            transportEvent: false, navigationEvent: false, seekEvent: false, skipEvent: false),
      .init(name: "native/native override", handling: .native, override: .native, executes: true,
            transportEvent: false, navigationEvent: false, seekEvent: false, skipEvent: false),
      .init(name: "native/js override", handling: .native, override: .js, executes: true,
            transportEvent: false, navigationEvent: false, seekEvent: false, skipEvent: false),
      .init(name: "js/default", handling: .js, override: nil, executes: false,
            transportEvent: true, navigationEvent: true, seekEvent: true, skipEvent: true),
      .init(name: "js/native override", handling: .js, override: .native, executes: false,
            transportEvent: true, navigationEvent: true, seekEvent: true, skipEvent: true),
      .init(name: "js/js override", handling: .js, override: .js, executes: false,
            transportEvent: true, navigationEvent: true, seekEvent: true, skipEvent: true),
      .init(name: "hybrid/default", handling: .hybrid, override: nil, executes: true,
            transportEvent: true, navigationEvent: false, seekEvent: true, skipEvent: false),
      .init(name: "hybrid/native override", handling: .hybrid, override: .native, executes: true,
            transportEvent: true, navigationEvent: false, seekEvent: true, skipEvent: false),
      .init(name: "hybrid/js override", handling: .hybrid, override: .js, executes: false,
            transportEvent: true, navigationEvent: true, seekEvent: true, skipEvent: true),
    ]
    let states: [(String, PlayerState, String, EmitEventType)] = [
      ("playing", .playing, "pause", .RemotePause),
      ("paused", .paused, "play", .RemotePlay),
      ("buffering", .buffering, "play", .RemotePlay),
      ("idle", .idle, "play", .RemotePlay),
    ]

    for route in routes {
      let before = failures
      for (stateName, state, toggleAction, toggleEvent) in states {
        let inputs: [(String, String, EmitEventType, (RemoteCommandHandlers) -> MPRemoteCommandHandlerStatus)] = [
          ("explicit play", "play", .RemotePlay, { $0.play() }),
          ("explicit pause", "pause", .RemotePause, { $0.pause() }),
          ("stop", "stop", .RemoteStop, { $0.stop() }),
          ("toggle", toggleAction, toggleEvent, { $0.togglePlayPause() }),
        ]
        for (name, action, event, invoke) in inputs {
          let subject = TrackPlayer(handling: route.handling, override: route.override, state: state)
          let status = invoke(subject.probeHandlers())
          verify(subject, status, context: "\(route.name), \(name) while \(stateName)",
                 action: route.executes ? action : nil, event: route.transportEvent ? event : nil)
          if !route.executes { check(subject.player.state == state, "JS ownership leaves native state alone") }
        }
      }

      for (name, event, invoke) in [
        ("next", EmitEventType.RemoteNext, { (handlers: RemoteCommandHandlers) in handlers.next() }),
        ("previous", EmitEventType.RemotePrevious, { (handlers: RemoteCommandHandlers) in handlers.previous() }),
      ] {
        let subject = TrackPlayer(handling: route.handling, override: route.override)
        verify(subject, invoke(subject.probeHandlers()), context: "\(route.name), \(name)",
               action: route.executes ? name : nil, event: route.navigationEvent ? event : nil)
      }

      let seek = TrackPlayer(handling: route.handling, override: route.override)
      verify(seek, seek.probeHandlers().changePosition(24.25), context: "\(route.name), seek once",
             action: route.executes ? "seek:24.25" : nil, event: route.seekEvent ? .RemoteSeek : nil,
             body: ["position": 24.25])
      check(seek.player.currentTime == (route.executes ? 24.25 : 12), "Seek position preserves ownership")

      let forward = TrackPlayer(handling: route.handling, override: route.override)
      verify(forward, forward.probeHandlers().skipForward(7.5), context: "\(route.name), skip forward",
             action: route.executes ? "seek:19.5" : nil, event: route.skipEvent ? .RemoteSkipForward : nil,
             body: ["interval": 7.5])
      let backward = TrackPlayer(handling: route.handling, override: route.override)
      verify(backward, backward.probeHandlers().skipBackward(20), context: "\(route.name), skip backward clamp",
             action: route.executes ? "seek:0.0" : nil, event: route.skipEvent ? .RemoteSkipBackward : nil,
             body: ["interval": 20.0])
      if failures == before { print("PASS \(route.name): transport, navigation, seek and skip routing") }
    }

    // Exercise the app's mixed ownership, not just uniform command overrides.
    let app = TrackPlayer(handling: .hybrid, state: .paused)
    app.perCommandHandling = [PlayerCommand.Next.rawValue: .js, PlayerCommand.Previous.rawValue: .js]
    let appHandlers = app.probeHandlers()
    _ = appHandlers.play()
    _ = appHandlers.next()
    _ = appHandlers.previous()
    _ = appHandlers.pause()
    _ = appHandlers.changePosition(37.5)
    _ = appHandlers.stop()
    check(app.trace.entries == [
      "play", EmitEventType.RemotePlay.rawValue,
      EmitEventType.RemoteNext.rawValue, EmitEventType.RemotePrevious.rawValue,
      "pause", EmitEventType.RemotePause.rawValue,
      "seek:37.5", EmitEventType.RemoteSeek.rawValue,
      "stop", EmitEventType.RemoteStop.rawValue,
    ], "App hybrid configuration observes transport once and delegates only next/previous")
    scenarios += 1

    // Mutations must not change the selected event, even before audio settles.
    let sequence = TrackPlayer(handling: .hybrid, state: .playing)
    let handlers = sequence.probeHandlers()
    _ = handlers.togglePlayPause()
    _ = handlers.togglePlayPause()
    sequence.player.state = .buffering
    sequence.player.pauseResult = .buffering
    _ = handlers.pause()
    sequence.player.playResult = .buffering
    _ = handlers.play()
    _ = handlers.stop()
    check(sequence.trace.entries == [
      "pause", EmitEventType.RemotePause.rawValue,
      "play", EmitEventType.RemotePlay.rawValue,
      "pause", EmitEventType.RemotePause.rawValue,
      "play", EmitEventType.RemotePlay.rawValue,
      "stop", EmitEventType.RemoteStop.rawValue,
    ], "Toggle selects per invocation; explicit transport events do not depend on post-action/buffering state")
    scenarios += 1

    // Registered weak closures must not retain or act on a retired native owner.
    let retired: RemoteCommandHandlers = {
      let subject = TrackPlayer(handling: .hybrid)
      return subject.probeHandlers()
    }()
    for status in [retired.play(), retired.pause(), retired.stop(), retired.togglePlayPause(),
                   retired.next(), retired.previous(), retired.changePosition(1),
                   retired.skipForward(1), retired.skipBackward(1)] {
      check(status == .commandFailed, "Retired owner rejects remote commands")
    }
    scenarios += 1

    print("\(scenarios) native routing scenarios, \(assertions) assertions, \(failures) failed")
    print("Actual package Swift handlers/events; iOS audio and remote-command delivery remain separate runtime checks")
    if failures > 0 { exit(1) }
  }
}
