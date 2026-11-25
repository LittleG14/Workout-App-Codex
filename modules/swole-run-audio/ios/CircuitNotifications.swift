import ExpoModulesCore
import UserNotifications

// Finite system notifications, not a background JS/audio keepalive. The existing
// AVAudioSession remains the sole owner of foreground workout playback.
final class CircuitNotifications {
  private let center = UNUserNotificationCenter.current()
  private let prefix = "swole-circuit:"
  private var generation = 0

  func request(_ promise: Promise) {
    center.requestAuthorization(options: [.alert, .sound]) { [weak self] granted, error in
      if error != nil { promise.reject("ERR_CIRCUIT_PERMISSION", "Notification permission could not be requested."); return }
      guard granted, let self = self else { promise.resolve(false); return }
      self.center.getNotificationSettings { settings in
        promise.resolve(settings.soundSetting == .enabled)
      }
    }
  }
  func cancel(_ promise: Promise? = nil) {
    generation += 1
    let captured = generation
    center.getPendingNotificationRequests { requests in
      DispatchQueue.main.async {
        // Cancel only this feature's identifiers, never other application alerts.
        if self.generation == captured {
          self.center.removePendingNotificationRequests(withIdentifiers: requests.filter { $0.identifier.hasPrefix(self.prefix) }.map { $0.identifier })
        }
        promise?.resolve(nil)
      }
    }
  }
  func schedule(_ session: String, delays: [Double], promise: Promise) {
    guard !session.isEmpty, session.count < 100, delays.count <= 60,
      delays.allSatisfy({ $0.isFinite && $0 > 0 && $0 <= 86400000 }) else {
      promise.reject("ERR_CIRCUIT_SCHEDULE", "Invalid finite circuit schedule."); return
    }
    generation += 1
    let captured = generation, started = Date()
    center.getNotificationSettings { settings in
      DispatchQueue.main.async {
        guard self.generation == captured else { promise.reject("ERR_CIRCUIT_CANCELED", "The circuit schedule changed."); return }
        guard settings.authorizationStatus == .authorized && settings.soundSetting == .enabled else {
          promise.reject("ERR_CIRCUIT_PERMISSION", "Enable notification sounds in Settings for locked-screen chimes."); return
        }
        self.center.getPendingNotificationRequests { requests in
          DispatchQueue.main.async {
            guard self.generation == captured else { promise.reject("ERR_CIRCUIT_CANCELED", "The circuit schedule changed."); return }
            self.center.removePendingNotificationRequests(withIdentifiers: requests.filter { $0.identifier.hasPrefix(self.prefix) }.map { $0.identifier })
            // Leave room under iOS's pending-notification limit for unrelated alerts.
            let available = max(0, min(60, 64 - requests.filter { !$0.identifier.hasPrefix(self.prefix) }.count))
            if available == 0 && !delays.isEmpty {
              promise.reject("ERR_CIRCUIT_CAPACITY", "The notification queue is full. Keep the app open for interval chimes."); return
            }
            let selected = Array(delays.prefix(available))
            let group = DispatchGroup()
            var failure = false
            var ids: [String] = []
            for (index, delay) in selected.enumerated() {
              let content = UNMutableNotificationContent()
              content.title = "EMOM interval complete"
              content.body = "Continue your prescribed workout, or open Swole House to pause or stop."
              content.sound = UNNotificationSound(named: UNNotificationSoundName(rawValue: "run-ding.wav"))
              let id = self.prefix + session + ":" + String(captured) + ":" + String(index)
              ids.append(id)
              let remaining = max(0.1, delay / 1000 - Date().timeIntervalSince(started))
              let request = UNNotificationRequest(identifier: id, content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: remaining, repeats: false))
              group.enter()
              self.center.add(request) { error in
                DispatchQueue.main.async {
                  if error != nil { failure = true }
                  if self.generation != captured { self.center.removePendingNotificationRequests(withIdentifiers: [id]) }
                  group.leave()
                }
              }
            }
            group.notify(queue: .main) {
              if failure || self.generation != captured {
                self.center.removePendingNotificationRequests(withIdentifiers: ids)
                promise.reject("ERR_CIRCUIT_SCHEDULE", "Locked-screen chimes could not be scheduled. Keep the app open and retry.")
              } else { promise.resolve(selected.count) }
            }
          }
        }
      }
    }
  }
}
