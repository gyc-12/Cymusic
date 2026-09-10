// Original PCM capture harness. The runner injects the installed RNTP methods at
// the marked boundaries; this file contains no duplicate asset timing policy.
// macOS 15+ or iOS 18+ Simulator / Swift 6 compiler. Reads a private JSON config.
// No URL, credential or song data is embedded. Captures source PCM without
// changing buffers; independent full-reference matching is required.
import Foundation
import AVFoundation
import MediaToolbox
import AudioToolbox
import Synchronization

// These cache stand-ins are deliberately unreachable in content runs: CyMusic
// currently passes no RNTP cache. The separate policy suite covers actual proxy
// selection, registration, headers and both fallback methods with recorders.
final class AudioCache {
  func cacheKey(for url: URL) -> String { preconditionFailure("PCM probe must stay direct") }
}
final class CacheProxyServer {
  func proxyURL(for url: URL, headers: [String: String]?, cacheable: Bool, liveStream: Bool) -> URL {
    preconditionFailure("PCM probe must stay direct")
  }
}

final class RNTPAssetProbe {
  let avPlayer = AVPlayer()
  let cache: AudioCache? = nil
  let proxyServer: CacheProxyServer? = nil
  var currentCacheKey: String?
  var onItemInstalled: ((AVPlayerItem) -> Void)?

// @RNTP_SOURCE_CONTEXT@
// @RNTP_LOADING_METHODS@
// @RNTP_SEEK_METHOD@
// @RNTP_CANCEL_REFRESH@

  private func removeItemObservers() {}
  private func observeItem(_ item: AVPlayerItem, generation: Int) { onItemInstalled?(item) }
  private func prepareCachedMetadataReplay(for key: String) {
    preconditionFailure("PCM probe must stay direct")
  }
}

struct ProbeConfig: Decodable {
  let url: String
  let headers: [String: String]?
  let outputDirectory: String
  let preciseTiming: Bool?
  let isLive: Bool?
  let startAtSeconds: Double?
  let seekToSeconds: Double?
  let seekAfterPlayingSeconds: Double?
  let captureAfterSeekSeconds: Double?
  let controlPlaybackSeconds: Double?
  let maxWallSeconds: Double?
  let muted: Bool?
}

struct BufferRecord: Codable {
  var hostSeconds: Double = 0
  var assetStartSeconds: Double? = nil
  var assetDurationSeconds: Double? = nil
  var frameOffset: Int = 0
  var frameCount: Int = 0
  var sampleRate: Double = 0
  var channels: UInt32 = 0
  var sourceFlags: UInt32 = 0
}

func finite(_ value: Double) -> Double? { value.isFinite ? value : nil }
func hostTime() -> Double { ProcessInfo.processInfo.systemUptime }

// One tap's processing calls are serialized by the audio system. Memory is
// allocated before opening the asset. The realtime callback only copies/mixes
// PCM into bounded memory and stores scalar metadata; no disk I/O, logging,
// dispatched work, locks, or allocations happen in its capture loop.
final class PCMRecorder {
  let enabled = Atomic<Bool>(true)
  let callbacks = Atomic<Int>(0)
  let capacity = 8_000_000
  let rowCapacity = 16_384
  let pcm: UnsafeMutablePointer<Float>
  let rows: UnsafeMutablePointer<BufferRecord>
  var frameCount = 0
  var rowCount = 0
  var droppedFrames = 0
  var sourceErrors = 0
  var unsupportedFormats = 0
  var prepares = 0
  var format = AudioStreamBasicDescription()

  init() {
    pcm = .allocate(capacity: capacity)
    pcm.initialize(repeating: 0, count: capacity)
    rows = .allocate(capacity: rowCapacity)
    rows.initialize(repeating: BufferRecord(), count: rowCapacity)
  }

  deinit {
    pcm.deinitialize(count: capacity)
    pcm.deallocate()
    rows.deinitialize(count: rowCapacity)
    rows.deallocate()
  }

  func prepare(_ asbd: AudioStreamBasicDescription) {
    _ = callbacks.wrappingAdd(1, ordering: .acquiringAndReleasing)
    defer { _ = callbacks.wrappingSubtract(1, ordering: .acquiringAndReleasing) }
    guard enabled.load(ordering: .acquiring) else { return }
    format = asbd
    prepares += 1
  }

  func capture(_ list: UnsafeMutablePointer<AudioBufferList>, frames: Int,
               range: CMTimeRange, flags: UInt32, status: OSStatus) {
    _ = callbacks.wrappingAdd(1, ordering: .acquiringAndReleasing)
    defer { _ = callbacks.wrappingSubtract(1, ordering: .acquiringAndReleasing) }
    guard enabled.load(ordering: .acquiring) else { return }
    guard status == noErr else { sourceErrors += 1; return }
    guard frames > 0 else { return }
    guard format.mFormatID == kAudioFormatLinearPCM,
          format.mFormatFlags & kAudioFormatFlagIsFloat != 0,
          format.mFormatFlags & kAudioFormatFlagIsBigEndian == 0,
          format.mBitsPerChannel == 32 else {
      unsupportedFormats += 1
      return
    }
    guard frames <= capacity - frameCount, rowCount < rowCapacity else {
      droppedFrames += frames
      return
    }
    let buffers = UnsafeMutableAudioBufferListPointer(list)
    var channelCount: UInt32 = 0
    for buffer in buffers {
      guard buffer.mData != nil,
            Int(buffer.mDataByteSize) >= frames * Int(buffer.mNumberChannels) * 4 else {
        unsupportedFormats += 1
        return
      }
      channelCount += buffer.mNumberChannels
    }
    guard channelCount > 0 else { unsupportedFormats += 1; return }
    let callbackTime = hostTime()
    for frame in 0..<frames {
      var value: Float = 0
      for buffer in buffers {
        let channels = Int(buffer.mNumberChannels)
        let input = buffer.mData!.assumingMemoryBound(to: Float.self)
        for channel in 0..<channels { value += input[frame * channels + channel] }
      }
      pcm[frameCount + frame] = value / Float(channelCount)
    }
    rows[rowCount] = BufferRecord(
      hostSeconds: callbackTime,
      assetStartSeconds: finite(range.start.seconds),
      assetDurationSeconds: finite(range.duration.seconds),
      frameOffset: frameCount, frameCount: frames,
      sampleRate: format.mSampleRate, channels: channelCount, sourceFlags: flags
    )
    frameCount += frames
    rowCount += 1
  }
}

func recorder(_ tap: MTAudioProcessingTap) -> PCMRecorder {
  Unmanaged<PCMRecorder>.fromOpaque(MTAudioProcessingTapGetStorage(tap)).takeUnretainedValue()
}

final class Probe {
  let config: ProbeConfig
  let pcm = PCMRecorder()
  let engine = RNTPAssetProbe()
  var player: AVPlayer { engine.avPlayer }
  let started = hostTime()
  var asset: AVURLAsset?
  var item: AVPlayerItem?
  var tap: MTAudioProcessingTap?
  var timer: Timer?
  var events: [[String: Any]] = []
  var polls: [[String: Any]] = []
  var firstPlaying: Double?
  var previousTick: Double?
  var playingSeconds = 0.0
  var afterSeekPlayingSeconds = 0.0
  var seekSent = false
  var seekCompletedAt: Double?
  var stopReason: String?
  var done = false
  var exitCode: Int32 = 1
  var pollCounter = 0

  init(_ config: ProbeConfig) { self.config = config }

  func event(_ name: String, _ details: [String: Any] = [:]) {
    var row = details
    row["event"] = name
    row["hostSeconds"] = hostTime()
    row["playerSeconds"] = finite(player.currentTime().seconds) as Any? ?? NSNull()
    events.append(row)
  }

  func start() throws {
    #if os(iOS)
    // A standalone Simulator process has no App setup owner. Activate its own
    // playback session explicitly; this is diagnosis, not a product patch.
    let session = AVAudioSession.sharedInstance()
    try session.setCategory(.playback, mode: .default, options: [])
    try session.setActive(true)
    event("audio-session-active")
    #endif
    let url: URL?
    if config.url.hasPrefix("/") { url = URL(fileURLWithPath: config.url) }
    else { url = URL(string: config.url) }
    guard let url, ["http", "https", "file"].contains(url.scheme?.lowercased() ?? "") else {
      throw NSError(domain: "PCMProbe.InvalidSource", code: 1)
    }
    player.isMuted = config.muted ?? true
    engine.onItemInstalled = { [weak self] item in
      guard let self, let asset = item.asset as? AVURLAsset else { return }
      self.item = item
      self.asset = asset
      self.event("asset-created", ["sourceKind": url.isFileURL ? "local" : "remote"])
      // The normal RNTP item already exists. Loading track descriptions here is
      // only the observation seam needed to attach a pre-effects PCM tap.
      asset.loadValuesAsynchronously(forKeys: ["tracks"]) { [weak self] in
        DispatchQueue.main.async { self?.installAfterTrackLoad() }
      }
    }
    timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in self?.tick() }
    event("load-requested")
    engine.load(url: url, headers: config.headers, isLive: config.isLive ?? false,
                prefersPreciseTiming: config.preciseTiming ?? false)
  }

  func installAfterTrackLoad() {
    guard stopReason == nil, let asset, let item else { return }
    var error: NSError?
    guard asset.statusOfValue(forKey: "tracks", error: &error) == .loaded,
          let track = asset.tracks(withMediaType: .audio).first else {
      event("track-load-failed", ["errorDomain": error?.domain ?? "NoAudioTrack", "errorCode": error?.code ?? 0])
      finish("track-load-failed")
      return
    }
    var callbacks = MTAudioProcessingTapCallbacks(
      version: kMTAudioProcessingTapCallbacksVersion_0,
      clientInfo: Unmanaged.passUnretained(pcm).toOpaque(),
      init: { _, info, storage in storage.pointee = info },
      finalize: nil,
      prepare: { tap, _, format in recorder(tap).prepare(format.pointee) },
      unprepare: nil,
      process: { tap, requested, _, buffers, supplied, flags in
        var range = CMTimeRange(start: .invalid, duration: .invalid)
        let status = MTAudioProcessingTapGetSourceAudio(tap, requested, buffers, flags, &range, supplied)
        recorder(tap).capture(buffers, frames: supplied.pointee, range: range, flags: flags.pointee, status: status)
      }
    )
    var createdTap: MTAudioProcessingTap?
    let status = MTAudioProcessingTapCreate(kCFAllocatorDefault, &callbacks,
                                          kMTAudioProcessingTapCreationFlag_PreEffects, &createdTap)
    guard status == noErr, let createdTap else {
      event("tap-create-failed", ["status": status])
      finish("tap-create-failed")
      return
    }
    tap = createdTap
    let input = AVMutableAudioMixInputParameters(track: track)
    input.audioTapProcessor = tap
    let mix = AVMutableAudioMix()
    mix.inputParameters = [input]
    item.audioMix = mix
    if let initial = config.startAtSeconds {
      event("initial-seek-requested", ["targetSeconds": initial])
      engine.seek(to: initial) { [weak self] finished in
        guard let self, self.stopReason == nil else { return }
        self.event("initial-seek-completed", ["finished": finished])
        guard finished else { self.finish("initial-seek-interrupted"); return }
        self.beginPlayback()
      }
    } else {
      beginPlayback()
    }
  }

  func beginPlayback() {
    event("play-requested")
    player.play()
  }

  func tick() {
    guard stopReason == nil else { return }
    let now = hostTime()
    let delta = previousTick.map { max(0, now - $0) } ?? 0
    previousTick = now
    if item?.status == .failed {
      let error = item?.error as NSError?
      event("item-failed", ["errorDomain": error?.domain ?? "Unknown", "errorCode": error?.code ?? 0])
      finish("item-failed")
      return
    }
    if player.timeControlStatus == .playing {
      if firstPlaying == nil { firstPlaying = now; event("first-playing") }
      playingSeconds += delta
      if let seekCompletedAt {
        // A seek may hold the main run loop while the asset is prepared. Do
        // not count that pre-completion gap as captured post-seek playback.
        afterSeekPlayingSeconds += min(delta, max(0, now - seekCompletedAt))
      }
    }
    pollCounter += 1
    if pollCounter % 2 == 0 {
      let ranges = item?.loadedTimeRanges.map { value -> [Double?] in
        let range = value.timeRangeValue
        return [finite(range.start.seconds), finite(range.end.seconds)]
      } ?? []
      polls.append([
        "hostSeconds": now,
        "playerSeconds": finite(player.currentTime().seconds) as Any? ?? NSNull(),
        "durationSeconds": finite(item?.duration.seconds ?? .nan) as Any? ?? NSNull(),
        "timeControlStatus": player.timeControlStatus.rawValue,
        "itemStatus": item?.status.rawValue as Any? ?? NSNull(),
        "waitingReason": player.reasonForWaitingToPlay?.rawValue as Any? ?? NSNull(),
        "loadedRanges": ranges.map { $0.map { $0 as Any? ?? NSNull() } }
      ])
    }
    if let target = config.seekToSeconds, !seekSent,
       firstPlaying != nil, playingSeconds >= (config.seekAfterPlayingSeconds ?? 0.35) {
      seekSent = true
      event("seek-requested", ["targetSeconds": target])
      engine.seek(to: target) { [weak self] finished in
        guard let self, self.stopReason == nil else { return }
        self.seekCompletedAt = hostTime()
        self.event("seek-completed", ["finished": finished])
        if !finished { self.finish("seek-interrupted") }
      }
    }
    if config.seekToSeconds != nil {
      if afterSeekPlayingSeconds >= (config.captureAfterSeekSeconds ?? 6) { finish("captured") }
    } else if playingSeconds >= (config.controlPlaybackSeconds ?? 8) { finish("captured") }
    if now - started >= (config.maxWallSeconds ?? 45) { finish("wall-timeout") }
  }

  func finish(_ reason: String) {
    guard stopReason == nil else { return }
    stopReason = reason
    event("stopping", ["reason": reason])
    timer?.invalidate()
    timer = nil
    pcm.enabled.store(false, ordering: .releasing)
    player.pause()
    item?.audioMix = nil
    player.replaceCurrentItem(with: nil)
    #if os(iOS)
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    #endif
    completeWhenTapIdle()
  }

  func completeWhenTapIdle() {
    guard pcm.callbacks.load(ordering: .acquiring) == 0 else {
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.01) { [self] in completeWhenTapIdle() }
      return
    }
    do {
      let directory = URL(fileURLWithPath: config.outputDirectory, isDirectory: true)
      try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
      try Data(bytes: pcm.pcm, count: pcm.frameCount * MemoryLayout<Float>.size)
        .write(to: directory.appendingPathComponent("decoded.f32"))
      let rows = Array(UnsafeBufferPointer(start: pcm.rows, count: pcm.rowCount))
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
      try encoder.encode(rows).write(to: directory.appendingPathComponent("buffers.json"))
      let valid = stopReason == "captured" && pcm.frameCount > 0 && pcm.sourceErrors == 0
        && pcm.unsupportedFormats == 0 && pcm.droppedFrames == 0
      let summary: [String: Any] = [
        "status": stopReason ?? "unknown", "measurementValid": valid,
        "platform": ProcessInfo.processInfo.operatingSystemVersionString,
        "preciseTimingRequested": config.preciseTiming ?? false,
        "isLive": config.isLive ?? false,
        "startAtSeconds": config.startAtSeconds as Any? ?? NSNull(),
        "nativeBoundary": "installed @rntp/player 5.9.2 load/loadSource/loadDirect/installItem/seek",
        "automaticallyLoadedAssetKeys": NSNull(),
        "automaticallyWaitsToMinimizeStalling": NSNull(),
        "outputPCM": "float32 little-endian mono (channel mean), pre-effects",
        "capturedFrames": pcm.frameCount, "bufferCount": pcm.rowCount,
        "prepares": pcm.prepares, "sourceErrors": pcm.sourceErrors,
        "unsupportedFormats": pcm.unsupportedFormats, "droppedFrames": pcm.droppedFrames,
        "events": events, "polls": polls,
        "limitations": [
          "Actual RNTP asset/seek methods with observation seams; not rebuilt-App or physical-device acceptance.",
          "The production-created item is installed before the tap waits for tracks; the probe never downloads or scans the reference.",
          "Tap PCM/timeRange is decoded content before output; content matching is required and hardware output latency is not measured.",
          "timeRange and currentTime labels alone do not prove the decoded source location."
        ]
      ]
      try JSONSerialization.data(withJSONObject: summary, options: [.prettyPrinted, .sortedKeys])
        .write(to: directory.appendingPathComponent("report.json"))
      print("status=\(stopReason ?? "unknown") valid=\(valid) frames=\(pcm.frameCount) buffers=\(pcm.rowCount)")
      exitCode = valid ? 0 : 2
    } catch {
      let ns = error as NSError
      print("probe-output-error domain=\(ns.domain) code=\(ns.code)")
      exitCode = 3
    }
    done = true
  }
}

@main
enum Main {
  static func main() {
    guard CommandLine.arguments.count == 2 else {
      print("Usage: rntp-precise-pcm-probe /absolute/path/to/private-config.json")
      exit(64)
    }
    do {
      let configData = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[1]))
      let config = try JSONDecoder().decode(ProbeConfig.self, from: configData)
      guard config.seekToSeconds.map({ $0.isFinite && $0 >= 0 }) ?? true,
            config.startAtSeconds.map({ $0.isFinite && $0 >= 0 }) ?? true else { exit(64) }
      let probe = Probe(config)
      try probe.start()
      while !probe.done { RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.05)) }
      exit(probe.exitCode)
    } catch {
      let ns = error as NSError
      print("probe-error domain=\(ns.domain) code=\(ns.code)")
      exit(1)
    }
  }
}
