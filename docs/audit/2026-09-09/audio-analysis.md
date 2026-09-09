# Research: 音频依赖的架构、许可与功能替代评估

- Query: RNTP 4.1.2 是否真正实现 New Architecture；当前 RNTP v5、Expo Audio SDK57 与开源候选能否保留 CyMusic 全部音频功能？
- Scope: mixed（当前工程静态检查、官方 registry、精确发布源码、官方文档及许可证）
- Date: 2026-09-09
- Active task: `.trellis/tasks/09-05-rn-expo-new-architecture`
- 机器可读来源与必要摘录：[audio-sources.json](audio-sources.json)。所有“最新”均指本日获取的 registry 标签；源码结论绑定下列精确版本。

## Findings

### 建议

**本轮保留 `react-native-track-player@4.1.2` 作为过渡播放器，明确标记为旧原生模块经 interop 运行。** 保留的理由是已有应用功能与运行证据、Apache-2.0 许可，以及替代品尚未覆盖本应用的锁屏切歌和后台业务契约；不能把保留写成“RNTP 已升级为 TurboModule/Nitro”。

**暂不迁移 `expo-audio@57.0.4`。** 它确实是 Expo 官方、使用现代 Expo Modules API，也已经有真正的原生 `AudioPlaylist`。决定性的差距是：此版本的锁屏/媒体前台服务只接入单曲 `AudioPlayer`，没有接入 `AudioPlaylist`；公开远程控制也没有本应用需要的上一曲/下一曲事件。使用单曲播放器自行排队仍解决不了这些控制入口。补齐需要维护原生扩展或上游改动，工作量已经超出简单替换依赖。

**不引入 `@rntp/player@5.9.2` 的商业许可。** 它确有 TurboModule 实现，播放器功能与本应用最接近，但不符合任务现有“不新增商业许可”的边界。**`react-native-audio-api@0.13.3` 可作为后续开源实现候选**，其 TurboModule/JSI、`<Audio>`、锁屏 next/previous 事件均有源码依据；仍需要业务队列、后台 JS、状态适配和根级生命周期设计，当前没有证据支持直接替换。

### 版本与架构结论

| 方案 | 本日版本事实 | 源码验证的实现 | 许可与决定 |
| --- | --- | --- | --- |
| 当前 RNTP | 已安装与未加 scope 的 npm `latest` 均为 **4.1.2**，发布于 2025-08-12 | JS `NativeModules.TrackPlayerModule`；iOS `RCT_EXTERN_REMAP_MODULE` / `RCTEventEmitter`；Android `ReactContextBaseJavaModule` | **Apache-2.0**，允许商业使用，须履行其声明等条件；过渡保留 |
| 当前 RNTP v5 | 新包 **`@rntp/player@5.9.2`**，发布于 2026-08-26 | `Spec extends TurboModule`，iOS `getTurboModule → NativeTrackPlayerSpecJSI`，Android 生成 Spec；并非 Nitro | 精确发布包 `license.txt` 为商业/有限非商业许可；不纳入当前实施 |
| Expo Audio | 已装 Expo **57.0.20** 的映射是 `~57.0.4`；npm `latest`、SDK57 文档、`latest` 文档目前均指向 **57.0.4** | Swift/Kotlin Expo Module，JSI `SharedObject` / `SharedRef`；iOS `AVQueuePlayer`、Android Media3 `ExoPlayer` 真队列 | **MIT**；有价值，但目前锁屏/队列组合不满足需求 |
| Audio API | `react-native-audio-api` 稳定版 **0.13.3**，发布于 2026-08-17 | TurboModule 安装 JSI 音频引擎；系统通知和播放节点分别暴露 | 主项目 **MIT**；含 WebKit BSD、可用 FFmpeg LGPL 组件，不能只看主许可证；作为需要设计的候选 |

未加 scope 的 RNTP 包仍有旧 `5.0.0-alpha0-nightly-359af5a…` 标签，其 metadata 标记 Apache-2.0；它不是当前商业 v5 的稳定分发，也不能作为“免费升级到最新 v5”的依据。Expo Audio 另有 58 canary，未把它当 SDK57 的稳定升级建议。

### 当前 RNTP 4 的准确分类

以下均来自当前安装包，完整路径及 SHA256 已记入来源文件：

- `node_modules/react-native-track-player/src/TrackPlayerModule.ts:1` 从 `NativeModules` 取模块。
- `ios/RNTrackPlayer/RNTrackPlayerBridge.m:12` 使用 `RCT_EXTERN_REMAP_MODULE(TrackPlayerModule, RNTrackPlayer, NSObject)` 导出方法。
- `ios/RNTrackPlayer/RNTrackPlayer.swift:14` 继承 `RCTEventEmitter`；`:19` 持有 `QueuedAudioPlayer`。
- `android/src/main/java/com/doublesymmetry/trackplayer/module/MusicModule.kt:32` 继承 `ReactContextBaseJavaModule`。
- 包 manifest 没有 TurboModule codegen/Nitro 配置。项目安装了 `react-native-nitro-modules@0.35.9`，不会自动改变 RNTP 的实现。

因此，当前整体 RN0.86 New Architecture/bridgeless 能运行 RNTP4，说明旧模块走通了兼容路径，并不证明该依赖实现了新接口。Expo 官方 New Architecture 文档也明确区分 interop 与原生新实现。此分类沿用既有工程运行证据，不新增一次运行验收。

判断不能只搜索 `RCTEventEmitter`：RNTP5 仍使用事件发射器，但其 `ios/TrackPlayerBridge.h:17` 遵循 `NativeTrackPlayerSpec`，`TrackPlayerBridge.mm:89` 提供 `getTurboModule`，JS `src/NativeTrackPlayer.ts:10` 是生成 Spec。RNTP4 缺少这条实现链。Expo Modules 则是 JSI 上的 Swift/Kotlin 模块 API，不需要把每个 Expo 包都命名为 TurboModule 才算现代原生实现。[S2][S3][S6]

### 本应用需要保留的实际契约

| 当前文件 | 一行职责与关键调用 |
| --- | --- |
| `src/helpers/trackPlayerIndex.ts` | 播放 facade、切歌、repeat/shuffle、失败跳过、音源解析、缓存协调；`:473` 原生队列只有 `[当前曲目, 假下一曲]` |
| `src/store/playList.ts:33` | 真正业务队列及 `music.play-list` 持久化，和用户歌单 `music.playLists` 分离 |
| `src/constants/playbackService.ts:4` | remote play/pause/stop/next/previous/seek；next/previous 进入业务 facade |
| `src/app/_layout.tsx:25` | 在模块作用域注册 playback service，不由播放器页面的挂载决定寿命 |
| `src/hooks/useSetupTrackPlayer.tsx:5` | 单次初始化；声明锁屏 capabilities；进度事件每秒；原生 repeat=Queue、增益=1 |
| `src/player/MusicSourceResolver.ts:67` | 预取真实 URL；`:139` 音质降级 `flac → 320k → 128k`，并保留本地文件/磁盘缓存优先级 |
| `src/player/CacheManager.ts:43` | 下载完整媒体到 `Documents/musicCache/`，与原生缓冲不同 |
| `src/components/PlayerVolumeBar.tsx:20` | 系统音量读写、硬件音量变化监听、系统音量 UI |
| `src/utils/timingClose.ts:23` | `BackgroundTimer` 到时调用业务 pause；“播完整首再关闭”当前只是注释 |
| `src/helpers/lyricManager.ts:186` 及播放 UI hooks | 消费 RNTP 曲目/状态/进度；替换引擎必须适配这些事件及状态 |

原生播放到假下一曲时，`trackPlayerIndex.ts:188` 的 `PlaybackActiveTrackChanged` 回调调用 `play` 或 `skipToNext`，再由 resolver 获取真实音源。当前业务并非把所有可播放 URL 一次性交给原生队列。**后台能播放一条 URL，不等于后台能执行这套解析、切歌、错误跳过和队列持久化。** RNTP4 的 Android `registerPlaybackService` 注册 Headless JS task（`src/trackPlayer.ts:65`），原生 `MusicService` 继承 `HeadlessJsTaskService`；iOS 这里是在同一 JS runtime 中注册回调，不能把它描述成 iOS 独立 Headless JS 服务。

音频中断应按现状记录：全仓 `src` 未找到 `RemoteDuck` 订阅；初始化调用 `setupPlayer({})`，没有设置 `autoHandleInterruptions`。RNTP4 原生有中断事件和可选恢复逻辑，但本应用没有显式启用这套自动恢复策略。不能凭 PRD 的需求描述，虚构一个已经实现的 JS duck/resume 策略，也不据此推翻用户已确认的 M01–M12。

### Expo Audio 57.0.4 的能力和准确差距

下表中的 API/源码属于同一个 **57.0.4 发布包**，不混用较老 Expo Audio 或 58 canary 的能力。[S4][S5]

| 功能 | 已确认的能力 | 对 CyMusic 的差距/适配 |
| --- | --- | --- |
| 在线、本地、seek、状态 | `AudioSource` 接收 URI、asset、headers；`AudioPlayer`、`AudioPlaylist` 有播放/暂停/seek 和状态接口 | 保留现有 resolver、文件解析、音质 fallback；适配 RNTP hooks/状态/失败处理。不能让播放库代替音源业务 |
| 原生队列、循环、增删 | `createAudioPlaylist`；`next/previous/skipTo/add/insert/remove/clear`；loop=`none/single/all`；iOS `AVQueuePlayer`、Android 多 MediaItem `ExoPlayer` | **已具备队列**。shuffle 仍可由当前业务队列实现；动态解析 URL、持久化和假曲触发模型需要适配，不能直接复制现有 RNTP 调用 |
| iOS 后台 | 原生 `audio` background mode + `setAudioModeAsync({ shouldPlayInBackground: true, playsInSilentMode: true })`；Playlist 在同一个 playable registry 中 | 持续原生播放有基础。当前存量 iOS 工程应在现有原生文件中配置；不以 clean prebuild 重建工程 |
| Android 长时间后台 | `AudioPlayer.setActiveForLockScreen` 绑定 `AudioControlsService : MediaSessionService`，官方要求此媒体前台服务支持持续后台播放 | **服务只接受 AudioPlayer**。Playlist 未公开接入入口；不能把单曲后台文档推导为 Playlist 同等保证。官方约“三分钟”停播说明是平台行为提示，不是本轮实测阈值 |
| 锁屏信息、播放/暂停、seek | `AudioPlayer.setActiveForLockScreen`、`updateLockScreenMetadata`；原生直接处理播放、暂停、切换播放状态、拖动进度与 ±10 秒 seek | **AudioPlaylist 没有上述锁屏方法**；`MediaController.activePlayer` 也只接受 `AudioPlayer` |
| 锁屏/耳机上一曲、下一曲 | `AudioLockScreenOptions` 只有 `showSeekForward/showSeekBackward/isLiveStream`；公开事件只有播放状态/采样或 playlist 状态/trackChanged | 未提供本应用的 `RemoteNext/RemotePrevious` 等远程回调契约。±10 秒快进不是下一首。源码没有 `nextTrackCommand/previousTrackCommand` 绑定，无法仅靠 JS facade 补齐 |
| 音频中断与拔耳机 | `interruptionMode`=`doNotMix/duckOthers/mixWithOthers`；iOS `handleInterruptionBegan/Ended` 和路由变化处理；Android focus loss/duck/gain 处理 | 已有原生自动策略，不能写成“不支持中断”。锁屏要求 `doNotMix`；行为与当前未启用自动恢复的 RNTP 设置不完全相同。没有同等的业务层 `RemoteDuck` 事件合同 |
| preload | `preload/clearPreloadedSource/clearAllPreloadedSources/getPreloadedSources`；iOS 预建 AVPlayer 缓冲，AudioPlayer 创建/replace 时消耗；Android 读入内存 ByteArray | 当前 `preloadSource` 是预取 URL；现有完整下载缓存另有 owner。尤其 Android 此实现读至 EOF，不能假设只是缓冲十秒，也不能当持久离线缓存。iOS Playlist 构造并未消费 AudioPlayer 的预加载缓存 |
| 系统音量 | `player.volume`、`playlist.volume` 写到 AVPlayer/ExoPlayer 音频增益 | **没有系统输出音量 get/set/listener 替代**。须保留独立系统音量模块；不能删除 `PlayerVolumeBar` 的硬件音量联动 |
| 生命周期和睡眠定时 | `useAudioPlayer/useAudioPlaylist` 随组件卸载释放；`createAudioPlayer/createAudioPlaylist` 可手动管理 | 应在应用根级保留一个播放 owner，迁移后不能因离开播放页停止音乐。没有已确认的 RNTP playback-service/原生睡眠定时等价 API；当前 `timingClose` 仍需保留/适配 |

决定性源码位置（路径相对 `expo-audio@57.0.4` tarball 的 `package/`）：

- `src/AudioModule.types.ts:396` 到 `:538` 是完整 Playlist 公开类；没有锁屏方法；Player 对应方法在 `:222`。
- `ios/AudioModule.swift:289` 到 `:408`、Android `AudioModule.kt:663` 到 `:860` 注册 Playlist 类；两者均未注册锁屏接口。
- `ios/MediaController.swift:8` 的 `activePlayer: AudioPlayer?`；`:234` 开始注册单曲 remote commands。
- Android `service/AudioControlsService.kt:47` 的 `currentPlayer: AudioPlayer?`；`:338` 的 `setActivePlayerInternal` 也只接受该类型。
- `ios/AudioModule.swift:589` 与 Android `AudioModule.kt:80` 是已实现的中断处理；`src/Audio.types.ts:624` 说明锁屏模式须 `doNotMix`。
- Android `AudioPreloadManager.kt:24` 读至 EOF 后写入 `ConcurrentHashMap<String, ByteArray>`；这是原生音频预取，不是 CyMusic 的持久下载库。

### RNTP v5：实现是真的，开放使用范围也确实变了

官方 README 明确从 v5 改为新包 `@rntp/player`、不向后兼容 v4。5.9.2 的发布源码有同步状态读取、完整 media-item 队列、preload、sleep timer 等接口，**确实是值得关注的原生新架构实现**；本次并未安装运行或把这些官方功能主张计为 CyMusic 验收通过。[S2][S3]

精确 **5.9.2** 包内 `license.txt` 的条款是：

- 免费范围仅限私人个人、纯个人且非职业目的，或合格学术机构严格用于教学/非商业研究。
- 任何不完全满足上述条件的使用都需要付费商业许可，条文明列营利公司、**非营利组织和政府实体**。不是“App 免费就免费用”。
- 商业许可为非独占、不可转让，包含不得竞争、不得未经书面允许向第三方分享/分发/再许可等约束。应按正式商业条款解释应用交付边界，不能当 MIT/Apache 随意再分发。
- 本日官方价格：Pro 一个商业 App **€99/月或 €999/年**；Studio 最多五个 **€249/月或 €2,499/年**，另计适用税费。平台、白标、客户交付走定制许可。价格页是时点快照。

v4 的 Apache-2.0 身份由当前安装包、npm metadata 与官方 v4 保留声明相互印证。新版改用商业条款，不意味着当前 4.1.2 自动变成付费包。另一方面，旧 nightly 的 Apache metadata 也不授权把现行商业 v5 的代码混入旧版。[S1][S2][S3]

### 开源候选：Audio API 0.13.3

0.13.3 稳定版已提供 `<Audio>`：播放、暂停、seek、preload、流式/完整文件加载及结束/错误回调；`PlaybackNotificationManager` 支持锁屏 metadata 和 `nextTrack/previousTrack/seekTo` 事件；`AudioManager` 支持中断、route 和系统音量变化监听。iOS `ios/audioapi/ios/system/notification/PlaybackNotification.mm:294` 确实绑定 `nextTrackCommand/previousTrackCommand`，与上述类型声明一致。[S7]

架构证据是 `src/specs/NativeAudioAPIModule.ts:15` 的 TurboModule Spec，`AudioAPIModule.ts:34` 的安装调用，以及 `ios/audioapi/ios/AudioAPIModule.mm:328` 的 `getTurboModule`。这是真实的 TurboModule/JSI 实现。旧 `StreamerNode` 在该版本已被标记 deprecated，官方源码要求评估 `<Audio>`，不应基于旧 StreamerNode 再设计新的长期方案。

它仍不是当前工程的直接替换：

1. 现有 `AudioBufferQueueSourceNode` 排的是已解码 PCM buffer，不是带 ID、metadata、动态音源、repeat/shuffle 的歌曲 URL 队列；本次没有确认现成的 RNTP 等价 native playlist owner。
2. 通知 API 和播放引擎分离，next/previous 是事件入口，仍需接回 CyMusic facade；在发布包原生源码中未发现 `HeadlessJsTask`，不能承诺 Android 后台 JS 存活与 RNTP service 等价。
3. `<Audio>` 的 source/context 随 React 生命周期清理（`Audio.tsx:54`、`useAudioSourceLoader.ts:239`）；必须设计根级播放 owner，不能用一个路由页面组件替代当前单例。
4. 音量变化监听不包含系统音量写入；同样保留独立音量模块。完整媒体缓存的路径、数据身份及音质 fallback 继续归原 owner。
5. 主项目 MIT 可商业使用；该版本 `THIRD_PARTY.md` 明示 WebKit BSD 和 FFmpeg LGPL 2.1-or-later。若采用包含 FFmpeg 的构建，应保留相应第三方分发/重链接材料；这不是 RNTP v5 的商业购买要求，但也不是“只附一份 MIT 就完整”。[S8]

它适合成为“明确投入重做音频适配”的开源选项；当前全面替换尚无功能等价证据。若未来要求彻底去除 RNTP4 的 interop，可基于该候选或自有 Expo Module 形成单独音频设计，再实施差异验收；本报告不把这种可能性写成已经完成的迁移。

### 相关规范与保留边界

- `.trellis/workflow.md`：研究持久化；依赖决定与实现/验收分开。
- `.trellis/spec/frontend/native-upgrade-contracts.md`：保留现有 facade、音源 runtime、当前队列/用户歌单数据身份、本地 URI 契约、系统能力和真实设备证据边界。
- 本任务 `prd.md` R2/R3/R8/R9、A04：保留全部播放/队列/后台/音频中断/数据行为；30 分钟真机锁屏、耳机/Bluetooth/中断仍属独立实机范围。
- 本任务 `design.md` 与 `retained-findings.md`：沿用业务 owners；不新增商业许可；RNTP4 是过渡候选，不因 Expo 包名而省略功能比较。

## External references

所有链接获取于 **2026-09-09**；精确获取时间、tarball SHA256、源码路径/行号与许可证摘录见 `audio-sources.json`。

- **S1**：[RNTP 未加 scope 的官方 npm registry](https://registry.npmjs.org/react-native-track-player)，当前 `latest=4.1.2`，Apache-2.0。
- **S2**：[官方 RNTP README](https://github.com/doublesymmetry/react-native-track-player#readme)、[新包 registry](https://registry.npmjs.org/@rntp%2Fplayer)、[5.9.2 发布源码](https://registry.npmjs.org/@rntp/player/-/player-5.9.2.tgz)。
- **S3**：[官方 v5 许可证](https://github.com/doublesymmetry/react-native-track-player/blob/main/license.txt)、[价格](https://rntp.dev/pricing)；并核对 S2 的精确版本包内 `license.txt`。
- **S4**：[Expo Audio registry](https://registry.npmjs.org/expo-audio)、[57.0.4 发布源码](https://registry.npmjs.org/expo-audio/-/expo-audio-57.0.4.tgz)。
- **S5**：[SDK57 Audio 文档](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)、[当前稳定 Audio 文档](https://docs.expo.dev/versions/latest/sdk/audio/)。
- **S6**：[Expo New Architecture 文档](https://docs.expo.dev/guides/new-architecture/)、[Expo Modules API](https://docs.expo.dev/modules/module-api/)，分别说明 interop、默认新架构支持及 JSI 抽象。
- **S7**：[Audio API registry](https://registry.npmjs.org/react-native-audio-api)、[0.13.3 发布源码](https://registry.npmjs.org/react-native-audio-api/-/react-native-audio-api-0.13.3.tgz)、[官方接入文档](https://docs.swmansion.com/react-native-audio-api/docs/fundamentals/getting-started)。
- **S8**：[0.13.3 MIT 许可证](https://raw.githubusercontent.com/software-mansion/react-native-audio-api/0.13.3/LICENSE)、[同版本 THIRD_PARTY](https://raw.githubusercontent.com/software-mansion/react-native-audio-api/0.13.3/THIRD_PARTY.md)。

## Caveats / Not Found

- 本轮未修改产品、依赖或锁文件，未安装、构建、运行模拟器或执行功能测试。用户已确认的 M01–M12 继续有效；不为这份研究要求重跑。
- Expo 的“持续后台/队列”官方描述不替代本应用动态音源和锁屏组合验证。尤其不把 `AudioPlayer` 的能力转移给 `AudioPlaylist`。
- `useTrackPlayerVolume` 全仓 `src` 搜索仅找到定义，无消费者；系统音量结论来自实际使用的 `PlayerVolumeBar`。类型导入 `Track` 本身也不算运行时功能依赖。
- `react-native-audio-api@0.13.3` npm tarball 未附项目根 LICENSE；已改读同版本官方 tag 的 LICENSE，并与 manifest 核对。没有把缺失文件误写成“未授权”。
- 若未来真的切换音频引擎，中文人工步骤应聚焦更换后的差异：后台自动连续切歌及失败跳过、锁屏/耳机上一首下一首/seek、中断恢复、系统音量联动、睡眠计时与本地缓存。这里没有把这些未来步骤计为本轮新增待办或已通过测试。
