#import <Foundation/Foundation.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import "CyMusicUserApiRuntime.h"
#import <unistd.h>

static void Require(BOOL condition, NSString *message) {
  if (!condition) @throw [NSException exceptionWithName:@"ContractFailure" reason:message userInfo:nil];
}

static BOOL WaitUntil(BOOL (^predicate)(void), NSTimeInterval limit) {
  NSTimeInterval deadline = NSDate.timeIntervalSinceReferenceDate + limit;
  while (!predicate()) {
    if (NSDate.timeIntervalSinceReferenceDate >= deadline) return NO;
    usleep(1000);
  }
  return YES;
}

@interface SourceProbe : NSObject
@property(nonatomic, strong) CyMusicUserApiRuntime *runtime;
@property(nonatomic, strong) NSMutableArray<NSDictionary *> *events;
- (instancetype)initWithPreloadURL:(NSURL *)url;
- (NSString *)load:(NSString *)script;
- (void)flush;
- (NSArray<NSDictionary *> *)matching:(NSString *)action;
- (NSDictionary *)log:(NSString *)message;
- (NSDictionary *)snapshot;
- (dispatch_source_t)timer;
- (void)request:(NSString *)key generation:(NSString *)generation;
@end

@implementation SourceProbe
- (instancetype)initWithPreloadURL:(NSURL *)url {
  self = [super init];
  if (self) {
    _events = [NSMutableArray array];
    __weak typeof(self) weakSelf = self;
    _runtime = [[CyMusicUserApiRuntime alloc] initWithPreloadURL:url eventHandler:^(NSDictionary *event) {
      SourceProbe *probe = weakSelf;
      if (!probe) return;
      NSMutableDictionary *entry = [event mutableCopy];
      entry[@"observedAt"] = @(NSDate.timeIntervalSinceReferenceDate);
      entry[@"onMainThread"] = @(NSThread.isMainThread);
      @synchronized(probe) { [probe.events addObject:entry]; }
    }];
  }
  return self;
}
- (NSString *)load:(NSString *)script {
  return [self.runtime loadScript:@{
    @"id": @"fixture-id", @"name": @"Fixture 音源", @"description": @"Description",
    @"version": @"1.2.3", @"author": @"CyMusic", @"homepage": @"https://example.test",
    @"script": script,
  }];
}
- (void)flush {
  dispatch_queue_t queue = [self.runtime valueForKey:@"jsQueue"];
  dispatch_sync(queue, ^{});
}
- (NSArray<NSDictionary *> *)matching:(NSString *)action {
  @synchronized(self) {
    return [self.events filteredArrayUsingPredicate:[NSPredicate predicateWithBlock:^BOOL(NSDictionary *event, NSDictionary *bindings) {
      return [event[@"action"] isEqual:action];
    }]];
  }
}
- (NSDictionary *)log:(NSString *)message {
  for (NSDictionary *event in [self matching:@"log"]) if ([event[@"log"] isEqual:message]) return event;
  return nil;
}
- (NSDictionary *)snapshot {
  __block NSDictionary *snapshot;
  dispatch_queue_t queue = [self.runtime valueForKey:@"jsQueue"];
  dispatch_sync(queue, ^{
    snapshot = @{
      @"timers": @([[self.runtime valueForKey:@"timers"] count]),
      @"pendingEvents": @([[self.runtime valueForKey:@"pendingEvents"] count]),
      @"context": @([self.runtime valueForKey:@"context"] != nil),
      @"eventHandler": @([self.runtime valueForKey:@"eventHandler"] != nil),
    };
  });
  return snapshot;
}
- (dispatch_source_t)timer {
  __block dispatch_source_t timer;
  dispatch_queue_t queue = [self.runtime valueForKey:@"jsQueue"];
  dispatch_sync(queue, ^{ timer = [[self.runtime valueForKey:@"timers"] allValues].firstObject; });
  return timer;
}
- (void)request:(NSString *)key generation:(NSString *)generation {
  NSDictionary *payload = @{
    @"requestKey": key, @"data": @{
      @"action": @"musicUrl", @"source": @"tx",
      @"info": @{ @"type": @"128k", @"musicInfo": @{} },
    },
  };
  NSData *json = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
  [self.runtime sendAction:@"request" info:[[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding] generation:generation];
  [self flush];
}
@end

static NSString *const InitScript = @"lx.send(lx.EVENT_NAMES.inited, {sources:{tx:{type:'music',actions:['musicUrl'],qualitys:['128k','320k']}}});";

int main(int argc, const char *argv[]) {
  @autoreleasepool {
    Require(argc == 3, @"Expected preload URL and vector JSON path");
    NSURL *preload = [NSURL fileURLWithPath:@(argv[1])];
    NSDictionary *vectors = [NSJSONSerialization JSONObjectWithData:[NSData dataWithContentsOfFile:@(argv[2])] options:0 error:nil];
    NSMutableArray *checks = [NSMutableArray array];
    NSMutableDictionary *observations = [NSMutableDictionary dictionary];
    void (^test)(NSString *, void (^)(void)) = ^(NSString *name, void (^body)(void)) {
      @try { body(); [checks addObject:@{ @"name": name, @"passed": @YES }]; }
      @catch (NSException *error) { [checks addObject:@{ @"name": name, @"passed": @NO, @"error": error.reason ?: error.name }]; }
    };

    test(@"real JSC init, source metadata, protocol and stale command guard", ^{
      SourceProbe *probe = [[SourceProbe alloc] initWithPreloadURL:preload];
      [probe.runtime startObserving];
      NSString *body = [InitScript stringByAppendingString:@"lx.on(lx.EVENT_NAMES.request, () => Promise.resolve('https://example.test/audio')); console.log('NORMAL');"];
      NSString *generation = [probe load:body];
      [probe flush];
      Require([probe matching:@"init"].count == 1, @"One successful init is required");
      NSDictionary *init = [probe matching:@"init"].firstObject;
      NSDictionary *initData = [NSJSONSerialization JSONObjectWithData:[init[@"data"] dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
      Require([initData[@"status"] boolValue], @"Init must succeed");
      Require([init[@"generation"] isEqual:generation], @"Event must keep native load identity");
      Require(![init[@"onMainThread"] boolValue], @"JSC work must stay on its own serial queue");
      __block NSDictionary *scriptInfo;
      dispatch_sync([probe.runtime valueForKey:@"jsQueue"], ^{
        JSContext *context = [probe.runtime valueForKey:@"context"];
        scriptInfo = [context[@"lx"][@"currentScriptInfo"] toDictionary];
      });
      Require([scriptInfo[@"name"] isEqual:@"Fixture 音源"] && [scriptInfo[@"version"] isEqual:@"1.2.3"], @"Script metadata changed");
      Require([scriptInfo[@"rawScript"] isEqual:body], @"The exact source script must be retained");
      [probe request:@"stale" generation:@"retired"];
      Require([probe matching:@"response"].count == 0, @"Stale native command entered current context");
      [probe request:@"current" generation:generation];
      Require([probe matching:@"response"].count == 1, @"Current request did not return");
      NSDictionary *response = [NSJSONSerialization JSONObjectWithData:[[probe matching:@"response"].firstObject[@"data"] dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
      Require([response[@"requestKey"] isEqual:@"current"], @"Response correlation changed");
      Require([response[@"result"][@"data"][@"url"] isEqual:@"https://example.test/audio"], @"Response URL changed");
      Require([probe log:@"NORMAL"][@"data"] == nil, @"Existing native log shape changed");
      [probe.runtime invalidate]; [probe flush];
    });

    test(@"A200ms to B1000ms callback0 never fires B early; old native timer is cancelled", ^{
      SourceProbe *probe = [[SourceProbe alloc] initWithPreloadURL:preload];
      [probe.runtime startObserving];
      NSString *a = [probe load:@"setTimeout(() => console.log('A_TIMEOUT'), 200);"];
      [probe flush];
      dispatch_source_t oldTimer = [probe timer];
      Require(oldTimer != nil, @"A must own a native timer");
      usleep(30000);
      NSTimeInterval startedB = NSDate.timeIntervalSinceReferenceDate;
      NSString *b = [probe load:@"setTimeout(() => console.log('B_TIMEOUT'), 1000);"];
      [probe flush];
      Require(![a isEqual:b], @"Every load needs a unique generation");
      Require(dispatch_source_testcancel(oldTimer) != 0, @"Reload must physically cancel A's dispatch source");
      usleep(250000);
      Require([probe log:@"B_TIMEOUT"] == nil, @"A callback0 executed B callback0 prematurely");
      Require([probe log:@"A_TIMEOUT"] == nil, @"A callback escaped its retired context");
      Require(WaitUntil(^BOOL { return [probe log:@"B_TIMEOUT"] != nil; }, 2), @"B's own timer did not execute");
      NSDictionary *event = [probe log:@"B_TIMEOUT"];
      NSTimeInterval elapsed = [event[@"observedAt"] doubleValue] - startedB;
      observations[@"B_timer_elapsed_ms"] = @(elapsed * 1000);
      observations[@"cancelled_A_timer"] = @(dispatch_source_testcancel(oldTimer) != 0);
      Require(elapsed >= 0.90, @"B timer executed before its deadline");
      Require([event[@"generation"] isEqual:b], @"Timer event lost its generation");
      Require([[probe snapshot][@"timers"] integerValue] == 0, @"One-shot timer handle was retained after firing");
      [probe.runtime invalidate]; [probe flush];
    });

    test(@"clearTimeout, destroy and invalidate physically release owned timer handles", ^{
      SourceProbe *probe = [[SourceProbe alloc] initWithPreloadURL:preload];
      [probe.runtime startObserving];
      NSString *generation = [probe load:@"const id = setTimeout(() => console.log('CLEARED'), 60000); lx.on(lx.EVENT_NAMES.request, () => {clearTimeout(id); return Promise.resolve('https://example.test/clear')});"];
      [probe flush];
      dispatch_source_t cleared = [probe timer];
      [probe request:@"clear" generation:generation];
      Require(dispatch_source_testcancel(cleared) != 0, @"clearTimeout only deleted the JS callback");
      Require([[probe snapshot][@"timers"] integerValue] == 0, @"clearTimeout retained native timer");
      NSString *next = [probe load:@"setTimeout(() => console.log('DESTROYED'), 60000);"];
      [probe flush];
      dispatch_source_t destroyed = [probe timer];
      NSString *destroyGeneration = [probe.runtime destroy];
      NSString *again = [probe.runtime destroy];
      [probe flush];
      Require(![next isEqual:destroyGeneration] && ![destroyGeneration isEqual:again], @"Destroy must also advance generation");
      Require(dispatch_source_testcancel(destroyed) != 0, @"Destroy retained scheduled native work");
      NSDictionary *snapshot = [probe snapshot];
      observations[@"after_destroy"] = snapshot;
      Require(![snapshot[@"context"] boolValue] && [snapshot[@"timers"] integerValue] == 0 && [snapshot[@"pendingEvents"] integerValue] == 0, @"Destroy did not empty native owners");
      [probe load:@"setTimeout(() => console.log('INVALIDATED'), 60000);"];
      [probe flush];
      dispatch_source_t invalidated = [probe timer];
      [probe.runtime invalidate]; [probe.runtime invalidate]; [probe flush];
      Require(dispatch_source_testcancel(invalidated) != 0, @"Module teardown did not cancel native work");
      Require(![[probe snapshot][@"eventHandler"] boolValue], @"Module teardown kept an event sink");
      observations[@"after_invalidate"] = [probe snapshot];
    });

    test(@"buffering is FIFO for the current generation and last-listener removal preserves JSC", ^{
      SourceProbe *probe = [[SourceProbe alloc] initWithPreloadURL:preload];
      [probe load:[InitScript stringByAppendingString:@"console.log('OLD');"]];
      [probe flush];
      Require([[probe snapshot][@"pendingEvents"] integerValue] > 0, @"Unobserved script must buffer events");
      NSString *current = [probe load:[InitScript stringByAppendingString:@"console.log('NEW1'); console.log('NEW2'); lx.on(lx.EVENT_NAMES.request, () => {console.log('OFFLINE_LISTENER'); return Promise.resolve('https://example.test/buffer')});"]];
      [probe flush];
      NSUInteger buffered = [[probe snapshot][@"pendingEvents"] unsignedIntegerValue];
      [probe.runtime startObserving]; [probe flush];
      Require(probe.events.count == buffered, @"First observer must flush exactly once");
      Require([probe log:@"OLD"] == nil, @"Reload flushed an old generation");
      for (NSDictionary *event in probe.events) Require([event[@"generation"] isEqual:current], @"Buffered event has wrong generation");
      NSArray *logs = [[probe matching:@"log"] valueForKey:@"log"];
      Require([logs indexOfObject:@"NEW1"] < [logs indexOfObject:@"NEW2"], @"Buffered ordering changed");
      [probe.runtime stopObserving]; [probe flush];
      NSUInteger before = probe.events.count;
      [probe request:@"buffered" generation:current];
      Require(probe.events.count == before, @"Removed observer received another event");
      Require([[probe snapshot][@"context"] boolValue], @"Last-listener removal destroyed the script");
      buffered = [[probe snapshot][@"pendingEvents"] unsignedIntegerValue];
      Require(buffered > 0, @"Current script stopped producing buffered events");
      [probe.runtime startObserving]; [probe.runtime startObserving]; [probe flush];
      Require(probe.events.count == before + buffered, @"Re-observe duplicated or lost buffered events");
      [probe.runtime invalidate]; [probe flush];
    });

    test(@"existing LX environment, Base64, MD5, AES and RSA match independent vectors", ^{
      SourceProbe *probe = [[SourceProbe alloc] initWithPreloadURL:preload];
      [probe.runtime startObserving];
      [probe load:vectors[@"script"]]; [probe flush];
      NSDictionary *actual = nil;
      for (NSDictionary *event in [probe matching:@"log"]) {
        NSString *message = event[@"log"];
        if (![message hasPrefix:@"CRYPTO:"]) continue;
        actual = [NSJSONSerialization JSONObjectWithData:[[message substringFromIndex:7] dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
      }
      Require(actual != nil, @"Crypto script did not return its result");
      Require([actual isEqual:vectors[@"expected"]], [NSString stringWithFormat:@"Crypto/environment mismatch: %@", actual]);
      [probe.runtime invalidate]; [probe flush];
    });

    test(@"script exceptions reject init and an invalidated core is not retained by long timers", ^{
      __weak CyMusicUserApiRuntime *weakRuntime;
      @autoreleasepool {
        SourceProbe *probe = [[SourceProbe alloc] initWithPreloadURL:preload];
        weakRuntime = probe.runtime;
        [probe.runtime startObserving];
        [probe load:@"throw new Error('fixture evaluation failed')"];
        [probe flush];
        NSArray *events = [probe matching:@"init"];
        Require(events.count == 1, @"Exception must emit one failed init");
        NSDictionary *data = [NSJSONSerialization JSONObjectWithData:[events.firstObject[@"data"] dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
        Require(![data[@"status"] boolValue] && [data[@"errorMessage"] isKindOfClass:NSString.class] && [data[@"errorMessage"] length] > 0, @"Expected the existing nonempty init error payload");
        [probe load:@"setTimeout(() => console.log('never'), 60000)"];
        [probe.runtime invalidate]; [probe flush];
      }
      Require(WaitUntil(^BOOL { return weakRuntime == nil; }, 1), @"Timer/event closures retain invalidated native runtime");
    });

    BOOL passed = YES;
    for (NSDictionary *check in checks) if (![check[@"passed"] boolValue]) passed = NO;
    NSData *json = [NSJSONSerialization dataWithJSONObject:@{ @"suite": @"source-native-macos-jsc", @"passed": @(passed), @"checks": checks, @"observations": observations } options:NSJSONWritingPrettyPrinted error:nil];
    puts([[NSString alloc] initWithData:json encoding:NSUTF8StringEncoding].UTF8String);
    return passed ? 0 : 1;
  }
}
