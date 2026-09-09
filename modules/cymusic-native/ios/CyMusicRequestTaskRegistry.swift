import Foundation

final class CyMusicRequestTaskRegistry<Identifier> {
  private let beginNative: (@escaping () -> Void) -> Identifier?
  private let endNative: (Identifier) -> Void
  private var pending = Set<String>()
  private var tasks: [String: Identifier] = [:]
  private var destroyed = false

  init(
    begin: @escaping (@escaping () -> Void) -> Identifier?,
    end: @escaping (Identifier) -> Void
  ) {
    beginNative = begin
    endNative = end
  }

  func begin() -> String? {
    precondition(Thread.isMainThread)
    guard !destroyed else { return nil }
    let token = UUID().uuidString
    pending.insert(token)
    let identifier = beginNative { [weak self] in self?.end(token) }
    guard let identifier else {
      pending.remove(token)
      return nil
    }
    guard pending.remove(token) != nil, !destroyed else {
      endNative(identifier)
      return nil
    }
    tasks[token] = identifier
    return token
  }

  func end(_ token: String) {
    precondition(Thread.isMainThread)
    pending.remove(token)
    if let identifier = tasks.removeValue(forKey: token) {
      endNative(identifier)
    }
  }

  func invalidate() {
    precondition(Thread.isMainThread)
    destroyed = true
    pending.removeAll()
    let identifiers = Array(tasks.values)
    tasks.removeAll()
    identifiers.forEach(endNative)
  }
}
