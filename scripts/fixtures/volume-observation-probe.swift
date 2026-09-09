import Foundation

// Expo and UIKit stand-ins expose the real module's closures; Foundation supplies actual KVO.
public struct ProbeDefinition {
  func runOnQueue(_ queue: DispatchQueue) -> ProbeDefinition { self }
}

@resultBuilder
public enum ProbeDefinitionBuilder {
  public static func buildBlock(_ definitions: ProbeDefinition...) -> ProbeDefinition {
    ProbeDefinition()
  }
}

public typealias ModuleDefinition = ProbeDefinition
public protocol ProbeModule {
  @ProbeDefinitionBuilder func definition() -> ModuleDefinition
}

public class ProbeModuleBase {
  var events: [[String: Double]] = []

  func emit(event: String, payload: [String: Double]) {
    if event == "volumeChanged" { events.append(payload) }
  }
}

public typealias Module = ProbeModuleBase & ProbeModule

enum ProbeClosures {
  static var read: (() throws -> Double)?
  static var start: (() -> Void)?
}

func Name(_ name: String) -> ProbeDefinition { ProbeDefinition() }
func Events(_ name: String) -> ProbeDefinition { ProbeDefinition() }

func AsyncFunction(_ name: String, _ body: @escaping () throws -> Double) -> ProbeDefinition {
  if name == "getVolume" { ProbeClosures.read = body }
  return ProbeDefinition()
}

func AsyncFunction(_ name: String, _ body: @escaping (Double) throws -> Void) -> ProbeDefinition {
  ProbeDefinition()
}

func OnStartObserving(_ event: String, _ body: @escaping () -> Void) -> ProbeDefinition {
  ProbeClosures.start = body
  return ProbeDefinition()
}

func OnStopObserving(_ event: String, _ body: @escaping () -> Void) -> ProbeDefinition {
  ProbeDefinition()
}

func OnDestroy(_ body: @escaping () -> Void) -> ProbeDefinition { ProbeDefinition() }

final class AVAudioSession: NSObject {
  static let shared = AVAudioSession()
  @objc dynamic var outputVolume: Float = 0.2
  static func sharedInstance() -> AVAudioSession { shared }
}

final class MPVolumeView {
  let subviews: [NSObject] = [UISlider()]
  init(frame: CGRect) {}
}

enum SliderEvent { case touchUpInside }
final class UISlider: NSObject {
  func setValue(_ value: Float, animated: Bool) {}
  func sendActions(for event: SliderEvent) {}
}

@main
struct VolumeObservationProbe {
  static func main() throws {
    let module = CyMusicVolumeModule()
    _ = module.definition()
    let read = try ProbeClosures.read?()
    guard let read, abs(read - 0.2) < 0.0001 else {
      print("FAIL initial read did not establish the startup interleaving")
      exit(1)
    }
    AVAudioSession.shared.outputVolume = 0.8
    ProbeClosures.start?()
    RunLoop.main.run(until: Date().addingTimeInterval(0.05))
    guard let delivered = module.events.last?["volume"], abs(delivered - 0.8) < 0.0001 else {
      print("FAIL read-before-observation lost the changed system-volume snapshot")
      exit(1)
    }
    print("PASS read-before-observation receives the latest initial KVO snapshot")
    print("1 passed, 0 failed; Foundation KVO with native module body and API stand-ins")
  }
}
