import AVFoundation
import ExpoModulesCore
import MediaPlayer
import UIKit

public final class CyMusicVolumeModule: Module {
  private var volumeView: MPVolumeView?
  private var observation: NSKeyValueObservation?
  private var observationGeneration: UUID?
  private var destroyed = false

  public func definition() -> ModuleDefinition {
    Name("CyMusicVolume")
    Events("volumeChanged")

    AsyncFunction("getVolume") { () -> Double in
      try self.requireActive()
      return Double(AVAudioSession.sharedInstance().outputVolume)
    }
    .runOnQueue(.main)

    AsyncFunction("setVolume") { (volume: Double) in
      try self.requireActive()
      guard volume.isFinite else {
        throw NSError(domain: "CyMusicVolume", code: 1, userInfo: [
          NSLocalizedDescriptionKey: "System volume must be finite"
        ])
      }

      if self.volumeView == nil {
        // Retain the system slider without mounting a view that suppresses the volume HUD.
        self.volumeView = MPVolumeView(frame: .zero)
      }
      guard let slider = self.volumeView?.subviews.compactMap({ $0 as? UISlider }).first else {
        throw NSError(domain: "CyMusicVolume", code: 2, userInfo: [
          NSLocalizedDescriptionKey: "System volume control is unavailable"
        ])
      }
      slider.setValue(Float(min(max(volume, 0), 1)), animated: false)
      slider.sendActions(for: .touchUpInside)
    }
    .runOnQueue(.main)

    OnStartObserving("volumeChanged") {
      DispatchQueue.main.async {
        self.startObservingVolume()
      }
    }

    OnStopObserving("volumeChanged") {
      DispatchQueue.main.async {
        self.stopObservingVolume()
      }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.destroyed = true
        self.stopObservingVolume()
        self.volumeView = nil
      }
    }
  }

  private func requireActive() throws {
    guard !destroyed else {
      throw NSError(domain: "CyMusicVolume", code: 3, userInfo: [
        NSLocalizedDescriptionKey: "System volume module has been destroyed"
      ])
    }
  }

  private func startObservingVolume() {
    guard !destroyed, observation == nil else { return }
    let generation = UUID()
    observationGeneration = generation
    observation = AVAudioSession.sharedInstance().observe(\.outputVolume, options: [.initial, .new]) {
      [weak self] session, change in
      let volume = Double(change.newValue ?? session.outputVolume)
      DispatchQueue.main.async {
        guard let self, self.observationGeneration == generation, !self.destroyed else { return }
        self.emit(event: "volumeChanged", payload: ["volume": volume])
      }
    }
  }

  private func stopObservingVolume() {
    observationGeneration = nil
    observation?.invalidate()
    observation = nil
  }
}
