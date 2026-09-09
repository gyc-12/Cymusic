#import "CyMusicUserApiRuntime.h"

#import <CommonCrypto/CommonCryptor.h>
#import <CommonCrypto/CommonDigest.h>
#import <JavaScriptCore/JavaScriptCore.h>
#import <Security/Security.h>
#import <math.h>

@interface CyMusicUserApiRuntime ()
@property(nonatomic, strong) JSContext *context;
@property(nonatomic, strong) dispatch_queue_t jsQueue;
@property(nonatomic, copy) NSString *runtimeKey;
@property(nonatomic, copy) NSString *generation;
@property(nonatomic, assign) BOOL inited;
@property(nonatomic, assign) BOOL hasListeners;
@property(nonatomic, strong) NSMutableArray<NSDictionary *> *pendingEvents;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, dispatch_source_t> *timers;
@property(nonatomic, copy) NSURL *preloadURL;
@property(nonatomic, copy) void (^eventHandler)(NSDictionary<NSString *, id> *);
@end

@implementation CyMusicUserApiRuntime

- (instancetype)initWithPreloadURL:(NSURL *)preloadURL
                     eventHandler:(void (^)(NSDictionary<NSString *, id> *))eventHandler {
  self = [super init];
  if (self) {
    _jsQueue = dispatch_queue_create("com.music.player.gyc.userapi", DISPATCH_QUEUE_SERIAL);
    _preloadURL = [preloadURL copy];
    _eventHandler = [eventHandler copy];
    _pendingEvents = [NSMutableArray array];
    _timers = [NSMutableDictionary dictionary];
  }
  return self;
}

- (void)dealloc {
  for (dispatch_source_t timer in _timers.allValues) dispatch_source_cancel(timer);
  _context.exceptionHandler = nil;
}

- (void)startObserving {
  dispatch_async(self.jsQueue, ^{
    self.hasListeners = YES;
    NSArray<NSDictionary *> *events = [self.pendingEvents copy];
    [self.pendingEvents removeAllObjects];
    for (NSDictionary *event in events) {
      if ([event[@"generation"] isEqualToString:self.generation] && self.eventHandler) {
        self.eventHandler(event);
      }
    }
  });
}

- (void)stopObserving {
  dispatch_async(self.jsQueue, ^{
    self.hasListeners = NO;
  });
}

- (NSString *)loadScript:(NSDictionary<NSString *, NSString *> *)data {
  NSString *generation = NSUUID.UUID.UUIDString;
  NSDictionary *scriptInfo = [data copy];
  dispatch_async(self.jsQueue, ^{
    [self destroyRuntimeLocked];
    self.generation = generation;
    NSString *error = [self createRuntimeAndLoadScriptLocked:scriptInfo];
    if (error.length > 0) [self sendInitFailedLocked:error];
  });
  return generation;
}

- (void)sendAction:(NSString *)action info:(NSString *)info generation:(NSString *)generation {
  dispatch_async(self.jsQueue, ^{
    if (!self.context || ![self.generation isEqualToString:generation]) return;
    [self callJSLockedWithAction:action data:info ?: (id)kCFNull];
  });
}

- (NSString *)destroy {
  NSString *generation = NSUUID.UUID.UUIDString;
  dispatch_async(self.jsQueue, ^{
    [self destroyRuntimeLocked];
    self.generation = generation;
  });
  return generation;
}

- (void)invalidate {
  NSString *generation = NSUUID.UUID.UUIDString;
  dispatch_async(self.jsQueue, ^{
    [self destroyRuntimeLocked];
    self.generation = generation;
    self.hasListeners = NO;
    self.eventHandler = nil;
  });
}

#pragma mark - Runtime

- (NSString *)createRuntimeAndLoadScriptLocked:(NSDictionary *)scriptInfo {
  self.context = [[JSContext alloc] init];
  self.runtimeKey = self.generation;
  self.inited = NO;

  [self installExceptionHandlerLocked];
  [self installConsoleLocked];
  [self installNativeBridgesLocked];

  NSString *preload = [self loadPreloadScript];
  if (!preload.length) return @"Load preload script failed";

  [self.context evaluateScript:preload];
  if (self.context.exception) {
    NSString *message = [self stringFromJSException:self.context.exception defaultMessage:@"Evaluate preload failed"];
    self.context.exception = nil;
    return message;
  }

  JSValue *setup = self.context[@"lx_setup"];
  if (!setup || setup.isUndefined) {
    return @"Missing lx_setup in preload script";
  }

  NSString *scriptId = [self safeString:scriptInfo[@"id"] defaultValue:@""];
  NSString *name = [self safeString:scriptInfo[@"name"] defaultValue:@"Unknown"];
  NSString *desc = [self safeString:scriptInfo[@"description"] defaultValue:@""];
  NSString *version = [self safeString:scriptInfo[@"version"] defaultValue:@""];
  NSString *author = [self safeString:scriptInfo[@"author"] defaultValue:@""];
  NSString *homepage = [self safeString:scriptInfo[@"homepage"] defaultValue:@""];
  NSString *rawScript = [self safeString:scriptInfo[@"script"] defaultValue:@""];

  [setup callWithArguments:@[ self.runtimeKey ?: @"", scriptId, name, desc, version, author, homepage, rawScript ]];
  if (self.context.exception) {
    NSString *message = [self stringFromJSException:self.context.exception defaultMessage:@"Call lx_setup failed"];
    self.context.exception = nil;
    return message;
  }

  [self.context evaluateScript:rawScript];
  if (self.context.exception) {
    NSString *message = [self stringFromJSException:self.context.exception defaultMessage:@"Load script failed"];
    self.context.exception = nil;

    [self callJSLockedWithAction:@"__run_error__" data:(id)kCFNull];
    if (!self.inited) return message;
  }

  return @"";
}

- (void)destroyRuntimeLocked {
  for (dispatch_source_t timer in self.timers.allValues) dispatch_source_cancel(timer);
  [self.timers removeAllObjects];
  [self.pendingEvents removeAllObjects];
  self.context.exceptionHandler = nil;
  self.context = nil;
  self.runtimeKey = nil;
  self.inited = NO;
}

- (void)installExceptionHandlerLocked {
  __weak typeof(self) weakSelf = self;
  self.context.exceptionHandler = ^(JSContext *ctx, JSValue *exception) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;

    NSString *message = [strongSelf stringFromJSException:exception defaultMessage:@"JavaScript exception"];
    [strongSelf sendLogEvent:@"error" message:[NSString stringWithFormat:@"Call script error: %@", message]];

    if (!strongSelf.inited) {
      [strongSelf sendInitFailedLocked:message];
      strongSelf.inited = YES;
    }

    ctx.exception = nil;
  };
}

- (void)installConsoleLocked {
  __weak typeof(self) weakSelf = self;

  JSValue *console = [JSValue valueWithNewObjectInContext:self.context];
  console[@"log"] = ^{
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;
    [strongSelf sendLogEvent:@"log" message:[strongSelf joinedCurrentArguments]];
  };
  console[@"info"] = ^{
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;
    [strongSelf sendLogEvent:@"info" message:[strongSelf joinedCurrentArguments]];
  };
  console[@"warn"] = ^{
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;
    [strongSelf sendLogEvent:@"warn" message:[strongSelf joinedCurrentArguments]];
  };
  console[@"error"] = ^{
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;
    [strongSelf sendLogEvent:@"error" message:[strongSelf joinedCurrentArguments]];
  };

  self.context[@"console"] = console;
}

- (void)installNativeBridgesLocked {
  __weak typeof(self) weakSelf = self;

  self.context[@"__lx_native_call__"] = ^(NSString *key, NSString *action, NSString *data) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;
    [strongSelf handleScriptCallLockedWithKey:key action:action data:data];
  };

  self.context[@"__lx_native_call__set_timeout"] = ^(NSNumber *callbackId, NSNumber *timeoutMs) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf || !strongSelf.context) return;
    [strongSelf scheduleTimeoutLocked:callbackId milliseconds:timeoutMs];
  };

  self.context[@"__lx_native_call__clear_timeout"] = ^(NSNumber *callbackId) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return;
    dispatch_source_t timer = strongSelf.timers[callbackId];
    if (!timer) return;
    dispatch_source_cancel(timer);
    [strongSelf.timers removeObjectForKey:callbackId];
  };

  self.context[@"__lx_native_call__utils_str2b64"] = ^NSString *(NSString *input) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return @"";
    NSData *data = [[strongSelf safeString:input defaultValue:@""] dataUsingEncoding:NSUTF8StringEncoding];
    return [data base64EncodedStringWithOptions:0] ?: @"";
  };

  self.context[@"__lx_native_call__utils_b642buf"] = ^NSString *(NSString *base64Input) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return @"[]";

    NSData *decoded = [[NSData alloc] initWithBase64EncodedString:[strongSelf safeString:base64Input defaultValue:@""] options:0];
    if (!decoded.length) return @"[]";

    const int8_t *bytes = decoded.bytes;
    NSMutableString *json = [NSMutableString stringWithString:@"["];
    for (NSUInteger i = 0; i < decoded.length; i++) {
      [json appendFormat:@"%d", bytes[i]];
      if (i + 1 < decoded.length) [json appendString:@","];
    }
    [json appendString:@"]"];
    return json;
  };

  self.context[@"__lx_native_call__utils_str2md5"] = ^NSString *(NSString *input) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return @"";

    NSString *raw = [strongSelf safeString:input defaultValue:@""];
    NSString *decoded = raw.stringByRemovingPercentEncoding ?: raw;
    NSData *data = [decoded dataUsingEncoding:NSUTF8StringEncoding];

    unsigned char digest[CC_MD5_DIGEST_LENGTH];
    CC_MD5(data.bytes, (CC_LONG)data.length, digest);

    NSMutableString *output = [NSMutableString stringWithCapacity:CC_MD5_DIGEST_LENGTH * 2];
    for (int i = 0; i < CC_MD5_DIGEST_LENGTH; i++) {
      [output appendFormat:@"%02x", digest[i]];
    }
    return output;
  };

  self.context[@"__lx_native_call__utils_aes_encrypt"] = ^NSString *(NSString *dataB64, NSString *keyB64, NSString *ivB64, NSString *mode) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return @"";

    NSData *plain = [[NSData alloc] initWithBase64EncodedString:[strongSelf safeString:dataB64 defaultValue:@""] options:0];
    NSData *key = [[NSData alloc] initWithBase64EncodedString:[strongSelf safeString:keyB64 defaultValue:@""] options:0];
    NSData *iv = [[NSData alloc] initWithBase64EncodedString:[strongSelf safeString:ivB64 defaultValue:@""] options:0];

    if (!plain.length || !key.length) return @"";

    CCOptions options = 0;
    const void *ivBytes = NULL;

    NSString *safeMode = [strongSelf safeString:mode defaultValue:@""];
    if ([safeMode isEqualToString:@"AES/CBC/PKCS7Padding"]) {
      options = kCCOptionPKCS7Padding;
      ivBytes = iv.length ? iv.bytes : NULL;
    } else if ([safeMode isEqualToString:@"AES"]) {
      options = kCCOptionECBMode;
      ivBytes = NULL;
    } else {
      return @"";
    }

    size_t outLength = 0;
    NSMutableData *cipher = [NSMutableData dataWithLength:plain.length + kCCBlockSizeAES128];

    CCCryptorStatus status = CCCrypt(kCCEncrypt,
                                     kCCAlgorithmAES,
                                     options,
                                     key.bytes,
                                     key.length,
                                     ivBytes,
                                     plain.bytes,
                                     plain.length,
                                     cipher.mutableBytes,
                                     cipher.length,
                                     &outLength);

    if (status != kCCSuccess) return @"";

    cipher.length = outLength;
    return [cipher base64EncodedStringWithOptions:0] ?: @"";
  };

  self.context[@"__lx_native_call__utils_rsa_encrypt"] = ^NSString *(NSString *dataB64, NSString *keyBody, NSString *padding) {
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf) return @"";

    NSData *plain = [[NSData alloc] initWithBase64EncodedString:[strongSelf safeString:dataB64 defaultValue:@""] options:0];
    NSData *keyData = [[NSData alloc] initWithBase64EncodedString:[strongSelf safeString:keyBody defaultValue:@""] options:0];

    if (!plain.length || !keyData.length) return @"";

    NSDictionary *attrs = @{
      (__bridge id)kSecAttrKeyType: (__bridge id)kSecAttrKeyTypeRSA,
      (__bridge id)kSecAttrKeyClass: (__bridge id)kSecAttrKeyClassPublic,
      (__bridge id)kSecAttrKeySizeInBits: @(keyData.length * 8),
    };

    CFErrorRef error = NULL;
    SecKeyRef publicKey = SecKeyCreateWithData((__bridge CFDataRef)keyData,
                                               (__bridge CFDictionaryRef)attrs,
                                               &error);
    if (!publicKey) {
      if (error) CFRelease(error);
      return @"";
    }

    NSString *safePadding = [strongSelf safeString:padding defaultValue:@""];
    SecKeyAlgorithm algorithm = kSecKeyAlgorithmRSAEncryptionRaw;
    if ([safePadding isEqualToString:@"RSA/ECB/OAEPWithSHA1AndMGF1Padding"]) {
      algorithm = kSecKeyAlgorithmRSAEncryptionOAEPSHA1;
    }

    if (!SecKeyIsAlgorithmSupported(publicKey, kSecKeyOperationTypeEncrypt, algorithm)) {
      CFRelease(publicKey);
      return @"";
    }

    CFDataRef encryptedData = SecKeyCreateEncryptedData(publicKey,
                                                        algorithm,
                                                        (__bridge CFDataRef)plain,
                                                        &error);
    CFRelease(publicKey);

    if (!encryptedData) {
      if (error) CFRelease(error);
      return @"";
    }

    NSData *result = CFBridgingRelease(encryptedData);
    if (error) CFRelease(error);
    return [result base64EncodedStringWithOptions:0] ?: @"";
  };
}

#pragma mark - Timers

- (void)scheduleTimeoutLocked:(NSNumber *)callbackId milliseconds:(NSNumber *)timeoutMs {
  if (!callbackId) return;
  dispatch_source_t previous = self.timers[callbackId];
  if (previous) dispatch_source_cancel(previous);

  NSString *generation = self.generation;
  dispatch_source_t timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, self.jsQueue);
  self.timers[callbackId] = timer;
  __weak typeof(self) weakSelf = self;
  __weak dispatch_source_t weakTimer = timer;
  dispatch_source_set_event_handler(timer, ^{
    __strong typeof(weakSelf) strongSelf = weakSelf;
    if (!strongSelf || ![strongSelf.generation isEqualToString:generation]) return;
    dispatch_source_t currentTimer = strongSelf.timers[callbackId];
    if (!currentTimer || currentTimer != weakTimer) return;
    [strongSelf.timers removeObjectForKey:callbackId];
    dispatch_source_cancel(currentTimer);
    [strongSelf callJSLockedWithAction:@"__set_timeout__" data:callbackId];
  });
  // The preload converts delay to an integer; bound it before converting to nanoseconds.
  double milliseconds = timeoutMs.doubleValue;
  milliseconds = isfinite(milliseconds)
    ? MAX(0, MIN(milliseconds, (double)INT64_MAX / NSEC_PER_MSEC - 1))
    : 0;
  dispatch_source_set_timer(timer,
                            dispatch_time(DISPATCH_TIME_NOW, (int64_t)(milliseconds * NSEC_PER_MSEC)),
                            DISPATCH_TIME_FOREVER,
                            0);
  dispatch_resume(timer);
}

#pragma mark - Bridge Callbacks

- (void)handleScriptCallLockedWithKey:(NSString *)key action:(NSString *)action data:(NSString *)data {
  if (!self.context) return;
  if (![self.runtimeKey isEqualToString:[self safeString:key defaultValue:@""]]) return;

  if ([action isEqualToString:@"init"]) {
    if (self.inited) return;
    self.inited = YES;
  }

  NSMutableDictionary *payload = [NSMutableDictionary dictionaryWithObject:[self safeString:action defaultValue:@""] forKey:@"action"];
  if (data != nil) payload[@"data"] = data;

  [self sendApiEvent:payload];
}

- (void)callJSLockedWithAction:(NSString *)action data:(id)data {
  if (!self.context) return;

  JSValue *native = self.context[@"__lx_native__"];
  if (!native || native.isUndefined) return;

  id payload = data ?: (id)kCFNull;
  [native callWithArguments:@[ self.runtimeKey ?: @"", action ?: @"", payload ]];

  if (self.context.exception) {
    NSString *message = [self stringFromJSException:self.context.exception defaultMessage:@"Call script error"];
    self.context.exception = nil;
    [self sendLogEvent:@"error" message:[NSString stringWithFormat:@"Call script error: %@", message]];

    if (!self.inited) {
      [self sendInitFailedLocked:message];
      self.inited = YES;
    }
  }
}

#pragma mark - Events

- (void)sendInitFailedLocked:(NSString *)errorMessage {
  NSDictionary *data = @{
    @"info": [NSNull null],
    @"status": @NO,
    @"errorMessage": [self safeString:errorMessage defaultValue:@"Create JavaScript Env failed"],
  };
  NSMutableDictionary *payload = [NSMutableDictionary dictionaryWithObject:@"init" forKey:@"action"];
  NSString *json = [self jsonStringFromObject:data];
  if (json.length) payload[@"data"] = json;
  [self sendApiEvent:payload];

  [self sendLogEvent:@"error" message:[self safeString:errorMessage defaultValue:@"Create JavaScript Env failed"]];
}

- (void)sendLogEvent:(NSString *)type message:(NSString *)message {
  NSMutableDictionary *payload = [NSMutableDictionary dictionaryWithObject:@"log" forKey:@"action"];
  payload[@"type"] = [self safeString:type defaultValue:@"log"];
  payload[@"log"] = [self safeString:message defaultValue:@""];
  [self sendApiEvent:payload];
}

- (void)sendApiEvent:(NSDictionary *)payload {
  if (!self.generation) return;
  NSMutableDictionary *event = [payload mutableCopy];
  event[@"generation"] = self.generation;
  if (self.hasListeners && self.eventHandler) {
    self.eventHandler([event copy]);
  } else {
    [self.pendingEvents addObject:[event copy]];
  }
}

#pragma mark - Utils

- (NSString *)safeString:(id)value defaultValue:(NSString *)defaultValue {
  if ([value isKindOfClass:NSString.class]) return value;
  if ([value respondsToSelector:@selector(stringValue)]) return [value stringValue];
  return defaultValue;
}

- (NSString *)loadPreloadScript {
  NSString *path = self.preloadURL.path;
  if (!path.length) return nil;

  NSError *error = nil;
  NSString *content = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:&error];
  if (error) {
    NSLog(@"[CyMusicUserApiRuntime] Failed to read preload script: %@", error.localizedDescription);
  }
  return content;
}

- (NSString *)jsonStringFromObject:(id)obj {
  if (!obj) return nil;
  if (![NSJSONSerialization isValidJSONObject:obj]) return nil;

  NSError *error = nil;
  NSData *data = [NSJSONSerialization dataWithJSONObject:obj options:0 error:&error];
  if (error || !data) return nil;
  return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}

- (NSString *)joinedCurrentArguments {
  NSArray<JSValue *> *args = [JSContext currentArguments] ?: @[];
  NSMutableArray<NSString *> *parts = [NSMutableArray arrayWithCapacity:args.count];

  for (JSValue *value in args) {
    NSString *str = [[value toObject] description] ?: @"";
    [parts addObject:str];
  }

  NSString *joined = [parts componentsJoinedByString:@" "];
  if (joined.length > 1024) {
    joined = [[joined substringToIndex:1024] stringByAppendingString:@"..."];
  }
  return joined;
}

- (NSString *)stringFromJSException:(JSValue *)exception defaultMessage:(NSString *)defaultMessage {
  if (!exception || exception.isUndefined || exception.isNull) return defaultMessage;

  NSString *message = [[exception toObject] description] ?: defaultMessage;
  if (message.length > 1024) {
    message = [[message substringToIndex:1024] stringByAppendingString:@"..."];
  }
  return message;
}

@end
