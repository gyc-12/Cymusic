// Original test seams and assertions. The runner injects unchanged installed
// RNTP methods at each marker. Asset constructors record options without I/O;
// production load, retry, metadata and fallback decisions are never mirrored.
import Foundation
import CoreFoundation
import AVFoundation

final class AVURLAsset {
  let url: URL
  let options: [String: Any]?
  init(url: URL, options: [String: Any]? = nil) { self.url = url; self.options = options }
}

final class AVPlayerItem {
  let asset: AVURLAsset
  init(asset: AVURLAsset) { self.asset = asset }
}

final class AVPlayer {
  var allowsExternalPlayback = false
  var currentItem: AVPlayerItem?
  var replacements = 0
  func replaceCurrentItem(with item: AVPlayerItem?) { currentItem = item; replacements += 1 }
}

final class AudioCache {
  func cacheKey(for url: URL) -> String { "key:" + url.absoluteString }
}

final class DownloadCoordinator {
  var onICYMetadata: ((String, StreamMetadata) -> Void)?
  var onDirectFallbackRequired: ((String) -> Void)?
  init(cache: AudioCache) {}
}

final class CacheProxyServer {
  struct Registration {
    let url: URL
    let headers: [String: String]?
    let cacheable: Bool
    let liveStream: Bool
  }
  var registrations: [Registration] = []
  let localURL = URL(string: "http://127.0.0.1:45678/opaque-proxy-resource")!
  init(coordinator: DownloadCoordinator, cache: AudioCache) throws {}
  func start() {}
  func proxyURL(for url: URL, headers: [String: String]?, cacheable: Bool, liveStream: Bool) -> URL {
    registrations.append(Registration(url: url, headers: headers, cacheable: cacheable, liveStream: liveStream))
    return localURL
  }
}

final class AVPlayerEngine: NSObject {
  let avPlayer = AVPlayer()
  private let cache: AudioCache?
  let proxyServer: CacheProxyServer?
  private let _downloadCoordinator: DownloadCoordinator?
  private let handleAudioBecomingNoisy: Bool
  private(set) var currentCacheKey: String?
  var onTimedMetadata: ((StreamMetadata) -> Void)?
  var onItemFailed: ((String, String) -> Void)?
  var onItemReady: (() -> Void)?
  var metadataReplayKeys: [String] = []
  var observedGenerations: [Int] = []
  var removedObservers = 0

// @RNTP_SOURCE_CONTEXT@
// @RNTP_ENGINE_INIT@
// @RNTP_LOADING_METHODS@
// @RNTP_REFRESH_METHODS@
// @RNTP_CANCEL_REFRESH@
// @RNTP_RESET_AND_FAILURE@

  private func observeTimeControlStatus() {}
  private func removeItemObservers() { removedObservers += 1 }
  private func observeItem(_ item: AVPlayerItem, generation: Int) { observedGenerations.append(generation) }
  private func prepareCachedMetadataReplay(for key: String) { metadataReplayKeys.append(key) }

  var generation: Int { loadGeneration }
  var sourcePrecision: Bool? { activeSource?.prefersPreciseTiming }
  var hasFallback: Bool { pendingDirectFallback != nil }
  var asset: AVURLAsset { avPlayer.currentItem!.asset }
  func fail(_ generation: Int) { handleItemFailure(generation: generation, code: "fixture", message: "fixture") }
  func ready(_ generation: Int) { handleItemReady(generation: generation) }
  func refresh(_ completion: @escaping (Bool) -> Void) { refreshLiveSource(completion: completion) }
  func coordinatorFallback(_ key: String) { _downloadCoordinator?.onDirectFallbackRequired?(key) }
}

// @RNTP_MEDIA_ITEM@

final class RecordingEngine: PlayerEngine {
  struct Load {
    let url: URL
    let headers: [String: String]?
    let isLive: Bool
    let precise: Bool
  }
  var loads: [Load] = []
  var currentTime = 0.0
  var duration = 0.0
  var bufferedPosition = 0.0
  var cachedPosition = 0.0
  var defaultRate: Float = 1
  var currentRate: Float = 1
  var volume: Float = 1
  var isPlaying = false
  var hasCurrentItem = false
  var onPlaybackStateChange: ((EnginePlaybackState) -> Void)?
  var onItemReady: (() -> Void)?
  var onItemFailed: ((String, String) -> Void)?
  var onItemPlayedToEnd: (() -> Void)?
  var onDurationChange: (() -> Void)?
  var onTimedMetadata: ((StreamMetadata) -> Void)?
  var onAssetMetadata: ((StreamMetadata) -> Void)?
  var onAudioBecomingNoisy: (() -> Void)?
  func play() { isPlaying = true }
  func pause() { isPlaying = false }
  func load(url: URL, headers: [String: String]?, isLive: Bool, prefersPreciseTiming: Bool) {
    loads.append(Load(url: url, headers: headers, isLive: isLive, precise: prefersPreciseTiming))
    hasCurrentItem = true
  }
  func seek(to seconds: TimeInterval, completion: @escaping (Bool) -> Void) { completion(true) }
  func seekToLiveEdge(completion: @escaping (Bool) -> Void) { completion(true) }
  func reset() { hasCurrentItem = false }
}

final class AudioPlayer {
  private let engine: PlayerEngine
  private let queue = QueueManager()
  var state: PlayerState = .idle
  var currentItem: AudioItem? { queue.current }
  var liveResumeBehavior: LiveResumeBehavior = .position
  private var playWhenReady = false
  private var lastEmittedMetadata: StreamMetadata?
  private var pendingItemMetadata: StreamMetadata?
  private var hasReceivedTimedMetadata = false
  var onCurrentItemChanged: ((AudioItem?, Int) -> Void)?
  init(engine: PlayerEngine) { self.engine = engine }

// @RNTP_PLAYER_TRANSPORT@
// @RNTP_PLAYER_LOAD_ITEM@
// @RNTP_PLAYER_LOAD_CURRENT@

  private func activateAudioSession() {}
  private func deactivateAudioSession() {}
  private func clearNowPlayingInfo() {}
  private func updateNowPlayingPlaybackInfo() {}
  private func resetNowPlaying(for item: AudioItem) {}
  private func triggerAutoPreloadIfNeeded() {}
  private func queueDidChange() {}
}

struct LegacyItem: AudioItem {
  let sourceUrl = "https://example.invalid/legacy"
  let sourceType: SourceType = .stream
  let headers: [String: String]? = nil
  let isLive = false
  let title: String? = nil
  let artist: String? = nil
  let albumTitle: String? = nil
}

var scenarios = 0
var assertions = 0
var failures = 0
var currentCase = ""

func check(_ value: @autoclosure () -> Bool, _ message: String) {
  assertions += 1
  if !value() { failures += 1; print("FAIL \(currentCase): \(message)") }
}

func scenario(_ name: String, _ body: () throws -> Void) rethrows {
  scenarios += 1
  currentCase = name
  try body()
}

func drainMainQueue() { RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.025)) }

let originA = URL(string: "https://example.invalid/opaque-a")!
let originB = URL(string: "https://example.invalid/opaque-b")!
let sourceHeaders = ["Authorization": "fixture-only", "User-Agent": "fixture-agent", "X-Source": "fixture"]

func item(_ precise: Bool, live: Bool = false, url: URL = originA) -> MediaItem {
  MediaItem(data: [
    "mediaId": "fixture-id", "url": ["uri": url.absoluteString, "headers": sourceHeaders],
    "title": "Before", "isLive": live,
    "extras": ["cymusic": ["id": "opaque", "platform": "fixture", "token": "t1", "placeholder": false],
               "cymusicPlayback": ["preciseSeeking": precise]]
  ])
}

func checkOptions(_ asset: AVURLAsset, precise: Bool, proxy: Bool, expectedHeaders: [String: String]? = nil) {
  let timing = asset.options?[AVURLAssetPreferPreciseDurationAndTimingKey]
  if precise {
    check((timing as? NSNumber)?.boolValue == true, "timing option must be true")
  } else {
    check(timing == nil, "disabled/live timing option must be absent")
  }
  let headers = asset.options?["AVURLAssetHTTPHeaderFieldsKey"] as? [String: String]
  check(headers == expectedHeaders, "only direct asset receives expected origin headers")
  check((asset.options?.count ?? 0) == (precise ? 1 : 0) + (proxy ? 0 : 1), "no unrelated asset options")
  if proxy && !precise { check(asset.options == nil, "disabled proxy preserves nil options") }
}

func decoderChecks() throws {
  let extrasCases: [(String, Bool)] = [
    ("null", false), ("false", false), ("1", false), ("[]", false), ("\"true\"", false),
    ("{}", false), ("{\"cymusicPlayback\":null}", false),
    ("{\"cymusicPlayback\":[]}", false), ("{\"cymusicPlayback\":1}", false),
    ("{\"cymusicPlayback\":true}", false), ("{\"cymusicPlayback\":\"true\"}", false),
    ("{\"cymusicPlayback\":{}}", false),
    ("{\"cymusicPlayback\":{\"preciseSeeking\":true}}", true),
    ("{\"cymusicPlayback\":{\"preciseSeeking\":false}}", false),
    ("{\"cymusicPlayback\":{\"preciseSeeking\":null}}", false),
    ("{\"cymusicPlayback\":{\"preciseSeeking\":1}}", false),
    ("{\"cymusicPlayback\":{\"preciseSeeking\":0}}", false),
    ("{\"cymusicPlayback\":{\"preciseSeeking\":1.0}}", false),
    ("{\"cymusicPlayback\":{\"preciseSeeking\":\"true\"}}", false),
    ("{\"cymusicPlayback\":{\"preciseSeeking\":[]}}", false),
    ("{\"cymusicPlayback\":{\"preciseSeeking\":{}}}", false)
  ]
  for (extras, expected) in extrasCases {
    try scenario("JSON extras \(extras)") {
      let data = Data("{\"url\":\"https://example.invalid/opaque\",\"extras\":\(extras)}".utf8)
      let input = try JSONSerialization.jsonObject(with: data) as! [String: Any]
      let parsed = MediaItem(data: input)
      check(parsed.prefersPreciseTiming == expected, "strict JSON Boolean decoding")
    }
  }
  scenario("missing extras / legacy conformer") {
    let parsed = MediaItem(data: ["url": originA.absoluteString])
    check(!parsed.prefersPreciseTiming, "missing extra defaults off")
    check(!LegacyItem().prefersPreciseTiming, "AudioItem default stays source compatible")
  }
  let bridged: [(Any, Bool)] = [(true, true), (false, false), (NSNumber(value: true), true),
                              (NSNumber(value: 1), false), (NSNumber(value: 0), false), ("true", false)]
  for (value, expected) in bridged {
    scenario("bridged \(type(of: value)) \(value)") {
      let parsed = MediaItem(data: ["url": originA.absoluteString,
                                   "extras": ["cymusicPlayback": ["preciseSeeking": value]]])
      check(parsed.prefersPreciseTiming == expected, "CFBoolean rejects numeric NSNumber")
    }
  }
  for precise in [false, true] {
    try scenario("metadata round trip \(precise)") {
      let original = item(precise)
      let updated = original.withMetadata(title: .some("After"), artist: .some(nil))
      check(updated.title == "After" && updated.artist == nil, "metadata update works")
      check(updated.prefersPreciseTiming == precise, "metadata retains policy")
      check(updated.headers == sourceHeaders, "metadata retains source headers")
      check(NSDictionary(dictionary: updated.extras!).isEqual(to: original.extras!), "all extras retained")
      let bytes = try JSONSerialization.data(withJSONObject: updated.toDictionary())
      let roundTrip = MediaItem(data: try JSONSerialization.jsonObject(with: bytes) as! [String: Any])
      check(roundTrip.prefersPreciseTiming == precise, "getter JSON preserves policy")
      check(roundTrip.mediaId == original.mediaId, "identity remains unchanged")
    }
  }
  print("PASS strict Boolean decoding, default conformer and metadata round trips")
}

func itemLifetimeChecks() {
  for precise in [false, true] {
    for url in [originA, URL(fileURLWithPath: "/tmp/fixture with spaces.flac")] {
      scenario("item snapshot \(precise) \(url.scheme!)") {
        let engine = RecordingEngine()
        let player = AudioPlayer(engine: engine)
        let original = item(precise, url: url)
        player.load(item: original)
        check(engine.loads.count == 1, "initial item loads once")
        check(engine.loads.last!.precise == precise, "initial forwarding")
        check(engine.loads.last!.url == url, "URL remains exact")
        check(engine.loads.last!.headers == sourceHeaders, "headers remain exact")
        // Constructing the user's later selection cannot change the retained item.
        let next = item(!precise, url: url)
        player.play()
        player.pause()
        player.play()
        check(engine.loads.count == 1, "Play/Pause do not reconstruct")
        player.retry()
        check(engine.loads.count == 1, "retry is a no-op outside failure")
        player.state = .failed
        player.retry()
        check(engine.loads.count == 2 && engine.loads.last!.precise == precise, "retry keeps snapshot")
        player.stop()
        check(!engine.hasCurrentItem, "Stop clears engine")
        player.play()
        check(engine.loads.count == 3 && engine.loads.last!.precise == precise, "Stop → Play keeps snapshot")
        check(player.currentItem?.prefersPreciseTiming == precise, "queue retained same item")
        player.load(item: next)
        check(engine.loads.count == 4 && engine.loads.last!.precise == !precise, "new item adopts new choice")
      }
    }
  }
  scenario("explicit live item forwarding") {
    let engine = RecordingEngine()
    let player = AudioPlayer(engine: engine)
    player.load(item: item(true, live: true))
    check(engine.loads.last!.isLive, "live contract forwarded independently")
    check(engine.loads.last!.precise, "engine receives item request before live normalization")
  }
  print("PASS actual AudioPlayer load/retry/Stop → Play item lifetime")
}

func assetChecks() {
  let customIcy = ["Authorization": "fixture-only", "iCy-MeTaDaTa": "0", "uSeR-aGeNt": "fixture-agent"]
  for precise in [false, true] {
    for live in [false, true] {
      for url in [originA, URL(fileURLWithPath: "/tmp/original.flac")] {
        for headers in [nil, sourceHeaders, customIcy] as [[String: String]?] {
          scenario("direct \(url.scheme!) precise=\(precise) live=\(live) headers=\(headers?.count ?? 0)") {
            let engine = AVPlayerEngine()
            engine.load(url: url, headers: headers, isLive: live, prefersPreciseTiming: precise)
            let expected = headers == customIcy ? customIcy : (headers ?? [:]).merging(["Icy-MetaData": "1"]) { old, _ in old }
            checkOptions(engine.asset, precise: precise && !live, proxy: false, expectedHeaders: expected)
            check(engine.asset.url == url, "direct URL preserved")
            check(engine.currentCacheKey == nil && !engine.hasFallback, "direct cannot arm fallback")
            check(engine.sourcePrecision == (precise && !live), "context contains normalized value")
            check(engine.generation == 1 && engine.observedGenerations == [1], "normal item installation retained")
          }
        }
      }
      scenario("proxy precise=\(precise) live=\(live)") {
        let engine = AVPlayerEngine(cache: AudioCache())
        engine.load(url: originA, headers: sourceHeaders, isLive: live, prefersPreciseTiming: precise)
        checkOptions(engine.asset, precise: precise && !live, proxy: true)
        let registration = engine.proxyServer!.registrations.last!
        check(registration.url == originA && registration.headers == sourceHeaders, "origin headers stay at proxy registration")
        check(registration.cacheable == !live && registration.liveStream == live, "live relay vs disk policy retained")
        check(engine.asset.url == engine.proxyServer!.localURL, "asset uses only localhost address")
        check(engine.hasFallback, "proxy arms fallback")
        check(engine.metadataReplayKeys == [engine.currentCacheKey!], "cached metadata still prepared")
      }
    }
  }
  scenario("local file remains direct with cache configured") {
    let engine = AVPlayerEngine(cache: AudioCache())
    let url = URL(fileURLWithPath: "/tmp/original.flac")
    engine.load(url: url, prefersPreciseTiming: true)
    check(engine.asset.url == url && engine.proxyServer!.registrations.isEmpty, "local bypass preserved")
    checkOptions(engine.asset, precise: true, proxy: false, expectedHeaders: ["Icy-MetaData": "1"])
  }
  print("PASS direct/file/proxy asset options, origin headers and live exclusion")
}

func fallbackChecks() {
  for coordinator in [false, true] {
    for precise in [false, true] {
      for live in [false, true] {
        scenario("\(coordinator ? "coordinator" : "item") fallback precise=\(precise) live=\(live)") {
          let engine = AVPlayerEngine(cache: AudioCache())
          var errors = 0
          engine.onItemFailed = { _, _ in errors += 1 }
          engine.load(url: originA, headers: sourceHeaders, isLive: live, prefersPreciseTiming: precise)
          let generation = engine.generation
          let key = engine.currentCacheKey!
          if coordinator { engine.coordinatorFallback(key); drainMainQueue() }
          else { engine.fail(generation) }
          checkOptions(engine.asset, precise: precise && !live, proxy: false,
                       expectedHeaders: sourceHeaders.merging(["Icy-MetaData": "1"]) { old, _ in old })
          check(engine.asset.url == originA, "fallback returns to original address")
          check(!engine.hasFallback && engine.currentCacheKey == nil, "fallback consumed once")
          check(engine.generation == generation + 1, "fallback installs a new generation")
          check(errors == 0, "first proxy failure does not surface")
          engine.coordinatorFallback(key)
          engine.fail(generation)
          drainMainQueue()
          check(engine.generation == generation + 1 && errors == 0, "stale duplicate callbacks ignored")
          engine.fail(engine.generation)
          check(errors == 1, "direct failure surfaces without another fallback")
        }
      }
    }
  }
  scenario("queued old-key fallback cannot affect replacement") {
    let engine = AVPlayerEngine(cache: AudioCache())
    engine.load(url: originA, prefersPreciseTiming: true)
    let oldGeneration = engine.generation
    engine.coordinatorFallback(engine.currentCacheKey!)
    engine.load(url: originB, prefersPreciseTiming: false)
    let replacement = engine.generation
    engine.fail(oldGeneration)
    drainMainQueue()
    check(engine.generation == replacement && engine.hasFallback, "key/generation guards keep new proxy")
    checkOptions(engine.asset, precise: false, proxy: true)
    engine.fail(replacement)
    check(engine.asset.url == originB, "current failure uses new source")
    checkOptions(engine.asset, precise: false, proxy: false, expectedHeaders: ["Icy-MetaData": "1"])
  }
  scenario("same-URL coordinator callback uses current context") {
    let engine = AVPlayerEngine(cache: AudioCache())
    engine.load(url: originA, prefersPreciseTiming: true)
    engine.coordinatorFallback(engine.currentCacheKey!)
    engine.load(url: originA, prefersPreciseTiming: false)
    drainMainQueue()
    // The existing coordinator API guards by cache key, not generation. Its
    // valid same-key callback may fall back, but must use the current snapshot.
    check(engine.asset.url == originA && !engine.hasFallback, "same-key callback consumes current fallback")
    checkOptions(engine.asset, precise: false, proxy: false, expectedHeaders: ["Icy-MetaData": "1"])
  }
  scenario("reset invalidates source, pending fallback and callbacks") {
    let engine = AVPlayerEngine(cache: AudioCache())
    var errors = 0
    engine.onItemFailed = { _, _ in errors += 1 }
    engine.load(url: originA, prefersPreciseTiming: true)
    let oldGeneration = engine.generation
    engine.coordinatorFallback(engine.currentCacheKey!)
    engine.reset()
    engine.fail(oldGeneration)
    drainMainQueue()
    check(engine.sourcePrecision == nil && !engine.hasFallback && engine.currentCacheKey == nil, "all contexts cleared")
    check(engine.avPlayer.currentItem == nil && errors == 0, "old callback cannot resurrect item")
    var result: Bool?
    engine.refresh { result = $0 }
    check(result == false, "reset source cannot refresh")
    engine.load(url: originB)
    checkOptions(engine.asset, precise: false, proxy: true)
  }
  print("PASS both one-shot fallbacks, current context, stale guards and reset")
}

func liveRefreshChecks() {
  for cached in [false, true] {
    scenario("live refresh precise exclusion cache=\(cached)") {
      let engine = AVPlayerEngine(cache: cached ? AudioCache() : nil)
      engine.load(url: originA, headers: sourceHeaders, isLive: true, prefersPreciseTiming: true)
      let initial = engine.generation
      var results: [Bool] = []
      engine.refresh { results.append($0) }
      engine.refresh { results.append($0) }
      check(engine.generation == initial + 1, "coalesced refresh loads once")
      check(engine.sourcePrecision == false, "live refresh keeps normalized source")
      checkOptions(engine.asset, precise: false, proxy: cached,
                   expectedHeaders: cached ? nil : sourceHeaders.merging(["Icy-MetaData": "1"]) { old, _ in old })
      engine.ready(initial)
      check(results.isEmpty, "old ready cannot finish refreshed item")
      engine.ready(engine.generation)
      check(results == [true, true], "current ready resolves both callbacks")
      engine.refresh { results.append($0) }
      let refreshed = engine.generation
      engine.load(url: originB, prefersPreciseTiming: true)
      check(results == [true, true, false], "replacement cancels pending live refresh")
      engine.ready(refreshed)
      check(results == [true, true, false], "stale ready stays ignored")
      checkOptions(engine.asset, precise: true, proxy: cached,
                   expectedHeaders: cached ? nil : ["Icy-MetaData": "1"])
    }
  }
  print("PASS live refresh normalization, coalescing and replacement")
}

@main
enum Main {
  static func main() throws {
    try decoderChecks()
    itemLifetimeChecks()
    assetChecks()
    fallbackChecks()
    liveRefreshChecks()
    print("\(scenarios) native precise-seeking scenarios, \(assertions) assertions, \(failures) failed")
    print("Actual installed decoder/transport/load/fallback methods; PCM content and rebuilt-App acceptance are separate checks.")
    if failures > 0 { exit(1) }
  }
}
