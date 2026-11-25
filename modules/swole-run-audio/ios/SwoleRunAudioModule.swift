import ExpoModulesCore
import AVFoundation
import UIKit
import Darwin

public final class SwoleRunAudioModule: Module {
  // All AVFoundation access is on the main queue, including headless task calls.
  private lazy var audio = RunAudioController()
  private lazy var circuitNotifications = CircuitNotifications()
  private let circuitClockOrigin = mach_continuous_time()
  public func definition() -> ModuleDefinition {
    Name("SwoleRunAudio")
    // Relative to this module's initialization event. Raw device uptime is never
    // exposed to JavaScript or included in synchronized workout metadata.
    Function("circuitClockMs") { () -> Double in
      var timebase = mach_timebase_info_data_t()
      mach_timebase_info(&timebase)
      return Double(mach_continuous_time() - self.circuitClockOrigin) * Double(timebase.numer) / Double(timebase.denom) / 1000000
    }
    AsyncFunction("prepareAsync") { () throws in try self.audio.prepare() }.runOnQueue(.main)
    AsyncFunction("playAsync") { (kind: String, text: String, promise: Promise) in
      self.audio.play(kind: kind, text: text, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("stopAsync") { self.audio.cancel() }.runOnQueue(.main)
    AsyncFunction("requestCircuitNotificationsAsync") { (promise: Promise) in self.circuitNotifications.request(promise) }.runOnQueue(.main)
    AsyncFunction("scheduleCircuitNotificationsAsync") { (session: String, delays: [Double], promise: Promise) in
      self.circuitNotifications.schedule(session, delays: delays, promise: promise)
    }.runOnQueue(.main)
    AsyncFunction("cancelCircuitNotificationsAsync") { (promise: Promise) in self.circuitNotifications.cancel(promise) }.runOnQueue(.main)
    OnDestroy { DispatchQueue.main.async { self.audio.close() } }
  }
}

private final class RunAudioController: NSObject, AVAudioPlayerDelegate, AVSpeechSynthesizerDelegate {
  private let session = AVAudioSession.sharedInstance()
  private var speech = AVSpeechSynthesizer()
  private var player: AVAudioPlayer?
  private var utterance: AVSpeechUtterance?
  private var result: Promise?
  private var watchdog: DispatchWorkItem?
  private var speechStartWatchdog: DispatchWorkItem?
  private var interrupted = false
  private var blockedUntil = Date.distantPast
  private var job: UUID?
  private var sound: Data?
  private var observers: [NSObjectProtocol] = []
  private var previous: (AVAudioSession.Category, AVAudioSession.Mode, AVAudioSession.CategoryOptions)?
  private var ownsSession = false
  private var backgroundTask: UIBackgroundTaskIdentifier = .invalid

  override init() {
    super.init()
    speech.delegate = self
    observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification, object: session, queue: .main) { [weak self] note in
      let began = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt) == AVAudioSession.InterruptionType.began.rawValue
      self?.interrupted = began
      if began { self?.cancel() }
    })
    observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.routeChangeNotification, object: session, queue: .main) { [weak self] note in
      let reason = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt
      if reason == AVAudioSession.RouteChangeReason.oldDeviceUnavailable.rawValue || reason == AVAudioSession.RouteChangeReason.noSuitableRouteForCategory.rawValue {
        self?.blockedUntil = Date().addingTimeInterval(3); self?.cancel()
      }
    })
    observers.append(NotificationCenter.default.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: session, queue: .main) { [weak self] _ in
      guard let self = self else { return }
      self.cancel(); self.speech = AVSpeechSynthesizer(); self.speech.delegate = self
    })
  }
  func prepare() throws {
    if sound != nil { return }
    guard let bundleURL = Bundle(for: SwoleRunAudioModule.self).url(forResource: "SwoleRunAudio", withExtension: "bundle")
      ?? Bundle.main.url(forResource: "SwoleRunAudio", withExtension: "bundle"),
      let bundle = Bundle(url: bundleURL), let url = bundle.url(forResource: "run-ding", withExtension: "wav") else {
      throw NSError(domain: "SwoleRunAudio", code: 1, userInfo: [NSLocalizedDescriptionKey: "The bundled run sound is missing."])
    }
    sound = try Data(contentsOf: url)
  }
  func play(kind: String, text: String, promise: Promise) {
    // No native playback queue: JS coalesces milestones, and stop cancels all work.
    guard result == nil else { promise.reject("ERR_RUN_AUDIO_BUSY", "An announcement is already playing."); return }
    guard !interrupted && Date() >= blockedUntil else { promise.reject("ERR_RUN_AUDIO_INTERRUPTED", "Audio was interrupted. The next milestone will try again."); return }
    guard kind == "sound" || kind == "update", text.count <= 600 else { promise.reject("ERR_RUN_AUDIO_INPUT", "Invalid run announcement."); return }
    let id = UUID(); job = id; result = promise
    do {
      try prepare()
      if ownsSession, releaseSession() != nil { finish(error: "The prior audio session is still being released."); return }
      // A new milestone may arrive before an earlier cleanup retry executes.
      // End that task before replacing its identifier so it cannot be orphaned.
      endBackgroundTask()
      previous = (session.category, session.mode, session.categoryOptions)
      backgroundTask = UIApplication.shared.beginBackgroundTask(withName: "Run milestone") { [weak self] in
        guard let self = self, self.job == id else { return }
        self.cancel(); self.endBackgroundTask()
      }
      ownsSession = true
      try session.setCategory(.playback, mode: .voicePrompt, options: [.mixWithOthers, .duckOthers])
      try session.setActive(true)
      let timeout = DispatchWorkItem { [weak self] in
        guard self?.job == id else { return }
        self?.finish(error: "The announcement was interrupted or timed out.")
      }
      watchdog = timeout; DispatchQueue.main.asyncAfter(deadline: .now() + 25, execute: timeout)
      if kind == "sound" {
        let next = try AVAudioPlayer(data: sound!)
        next.delegate = self; next.volume = 0.7; next.prepareToPlay(); player = next
        if !next.play() { finish(error: "The run sound could not start.") }
      } else {
        // Use an installed system voice. Do not fetch speech or audio over a network.
        guard let voice = AVSpeechSynthesisVoice.speechVoices().first(where: { $0.language == "en-US" })
          ?? AVSpeechSynthesisVoice.speechVoices().first(where: { $0.language.hasPrefix("en-") }) else {
          finish(error: "An installed English voice is needed for spoken run updates."); return
        }
        let next = AVSpeechUtterance(string: text)
        next.voice = voice; next.rate = AVSpeechUtteranceDefaultSpeechRate; next.volume = 1
        utterance = next; speech.usesApplicationAudioSession = true; speech.speak(next)
        let startTimeout = DispatchWorkItem { [weak self] in
          guard self?.job == id else { return }
          self?.finish(error: "Speech could not start. Check the installed voice and audio output.")
        }
        speechStartWatchdog = startTimeout
        DispatchQueue.main.asyncAfter(deadline: .now() + 3, execute: startTimeout)
      }
    } catch { finish(error: "Run audio could not start. Check your audio output and try the next milestone.") }
  }
  private func finish(error: String? = nil) {
    guard let promise = result else { return }
    result = nil; job = nil; watchdog?.cancel(); watchdog = nil
    speechStartWatchdog?.cancel(); speechStartWatchdog = nil
    let oldPlayer = player; player = nil; utterance = nil
    oldPlayer?.stop(); speech.stopSpeaking(at: .immediate)
    let cleanupFailure = releaseSession()
    let failure = error ?? cleanupFailure
    // Busy/speech interruption can briefly delay deactivation. Retry without a new sound.
    if ownsSession { retryRelease(remaining: 3) } else { endBackgroundTask() }
    if let message = failure { promise.reject("ERR_RUN_AUDIO", message) } else { promise.resolve(nil) }
  }
  private func releaseSession() -> String? {
    guard ownsSession else { return nil }
    do { try session.setActive(false, options: .notifyOthersOnDeactivation); ownsSession = false }
    catch { return "The audio session could not be released. Pause the run to retry cleanup." }
    var failure: String?
    if let old = previous {
      do { try session.setCategory(old.0, mode: old.1, options: old.2) }
      catch { failure = failure ?? "The prior audio session configuration could not be restored." }
    }
    previous = nil
    return failure
  }
  private func retryRelease(remaining: Int) {
    guard remaining > 0 else { endBackgroundTask(); return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
      guard self.result == nil, self.ownsSession else { return }
      _ = self.releaseSession()
      if self.ownsSession { self.retryRelease(remaining: remaining - 1) } else { self.endBackgroundTask() }
    }
  }
  func cancel() {
    if result != nil { finish() }
    else {
      player?.stop(); player = nil; utterance = nil; speech.stopSpeaking(at: .immediate)
      _ = releaseSession(); if ownsSession { retryRelease(remaining: 3) } else { endBackgroundTask() }
    }
  }
  private func endBackgroundTask() {
    if backgroundTask != .invalid { UIApplication.shared.endBackgroundTask(backgroundTask); backgroundTask = .invalid }
  }
  func close() { cancel(); observers.forEach { NotificationCenter.default.removeObserver($0) }; observers.removeAll() }
  func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
    DispatchQueue.main.async { [weak self] in if player === self?.player { self?.finish(error: flag ? nil : "Run sound playback failed.") } }
  }
  func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
    DispatchQueue.main.async { [weak self] in if player === self?.player { self?.finish(error: "Run sound decoding failed.") } }
  }
  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
    DispatchQueue.main.async { [weak self] in if utterance === self?.utterance { self?.finish() } }
  }
  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didStart utterance: AVSpeechUtterance) {
    DispatchQueue.main.async { [weak self] in
      if utterance === self?.utterance { self?.speechStartWatchdog?.cancel(); self?.speechStartWatchdog = nil }
    }
  }
  func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
    DispatchQueue.main.async { [weak self] in if utterance === self?.utterance { self?.finish() } }
  }
}
