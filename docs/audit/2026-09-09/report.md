# CyMusic 项目文件与依赖重构评估

检查日期：2026-09-09。项目：`/Users/gyc/Code/Cymusic`。范围：本地 Git 索引与工作区、实际安装包、应用调用点、iOS 锁文件，以及当日官方版本、源码和文档。

**当前 APP 已经运行在 Expo 57 / RN 0.86 新架构上，但仍有部分原生模块通过旧接口兼容运行。下一步应围绕这些模块重构，保留现有音乐、音源、歌单、下载、分享和数据功能。** 用户确认的 M01–M12 全部通过继续有效。

本轮已完成文件整理和依赖评估。下文的依赖升级、替换均为建议，尚未实施。这里将用户所说的“1.x PO”理解为 Expo；Expo 官方模块本身也开源，评估重点是减少独立维护的社区原生依赖。

**1. 当前 Git 文件状态**

分支为 `main`，本地 HEAD 为 `305b9cd9096247303b19507d257075100e10c6ce`。本轮没有暂存或提交，也未核验远端分支的新变化。

| 项目 | 整理前 | 当前 |
| --- | ---: | ---: |
| Git 追踪路径 | 251 | 251 |
| 未修改 | 171 | 170 |
| 工作区修改 | 66 | 67 |
| 工作区已删除、索引仍追踪 | 14 | 14 |
| 已暂存改动 | 0 | 0 |
| 未追踪且未被忽略的文件 | 68,012 | 389 |

本轮新增的已追踪文件改动只有 `.gitignore`：忽略本任务的本地研究下载、构建证据和模拟器截图。其余 66 个修改、14 个删除是盘点前已经存在的状态。

完整清单：[251 个追踪路径](tracked-files.csv)、[389 个未追踪候选](untracked-files.csv)、[机器可读快照](git-state.json)。清单路径相对项目根目录；14 个删除项仍列出，避免把“本地看不到文件”误当成“Git 已经删除”。

| 追踪范围 | 总数 | 未修改 | 修改 | 删除 | 内容与处理意见 |
| --- | ---: | ---: | ---: | ---: | --- |
| `src/` | 171 | 119 | 52 | 0 | 应用业务、路由、组件、状态、工具和类型；保留 |
| `ios/` | 32 | 22 | 7 | 3 | 原生工程、音源模块、分享扩展、资源和 Pods 锁；保留原生能力 |
| 根目录文件 | 16 | 8 | 7 | 1 | 包声明、Yarn 锁、配置、README、许可证、图片与历史压缩包 |
| `assets/` | 14 | 14 | 0 | 0 | 图片、默认数据及播放占位音频；不能仅凭名字当临时文件删除 |
| `.idea/` | 7 | 0 | 0 | 7 | 用户原有 IDE 文件删除，保持现状 |
| `.claude/` | 5 | 5 | 0 | 0 | 原有音源插件开发知识，属于可保留成果 |
| `patches/` | 4 | 1 | 0 | 3 | 保留 xcode 补丁，三个旧包补丁已删除；新补丁尚未追踪 |
| `.github/` | 1 | 0 | 1 | 0 | iOS 构建 workflow |
| `.vscode/` | 1 | 1 | 0 | 0 | 可选团队编辑器配置 |
| **合计** | **251** | **170** | **67** | **14** | |

`src/` 的 171 个追踪文件进一步分为：路由 24、组件 52、常量 7、helpers 18、hooks 10、翻译 2、player 4、store 10、styles 1、types 25、utils 18。

当前已安装版本与本地最后一次提交有明显区别：

| 核心依赖 | 本地 HEAD 的声明 | 当前工作区/安装版本 | 当日 npm latest |
| --- | --- | --- | --- |
| Expo | `~50.0.14` | `57.0.20` | `57.0.21` |
| React Native | `0.73.6` | `0.86.3` | `0.87.1` |
| React | `18.2.0` | `19.2.3` | `19.2.8` |
| Track Player | `^4.1.1` | `4.1.2` | 原包仍为 `4.1.2` |

工作区改动和未追踪文件不会随 `git push` 自动上传；推送的是已提交内容。以后组织提交时，需要同时审查已有修改、已有删除和下面的必要新增文件。

**2. 哪些新增文件应进入应用提交**

这 7 个文件目前尚未追踪，但已经属于当前实现：

| 文件 | 必要性 |
| --- | --- |
| `ios/CyMusic/AppDelegate.swift` | 当前 Expo/RN 原生入口，接替已删除的旧入口 |
| `ios/CyMusic/PrivacyInfo.xcprivacy` | 当前主应用隐私清单 |
| `metro.config.js` | Expo Metro 配置及 Axios 原生端定向解析 |
| `patches/expo-localization+57.0.1.patch` | 日历标识和回退处理 |
| `patches/expo-share-intent+8.0.1.patch` | 历史待处理分享、剪贴板深链及无效数据处理 |
| `patches/react-native-awesome-slider+2.5.1.patch` | Reanimated 新版 SharedValue 类型适配 |
| `src/helpers/localFile.ts` | 更新安装后本地媒体路径重定位和文件所有权检查 |

建议 GitHub 内容按以下范围组织：

- **应用与构建**：现有业务源码、资源、完整保留的 `ios/`、配置、`yarn.lock`、`ios/Podfile.lock`、四个有效补丁和上述 7 个新增文件。当前使用 Yarn 1，已有 `package-lock.json` 删除与这一选择一致。
- **可复用知识**：本报告、`.trellis/spec/` 中的项目契约、原有音源插件开发说明；必要的任务入口和共享样本按协作需要纳入。
- **可选工具配置**：`AGENTS.md`、`.gitattributes`、`.agents/`、`.codex/` 及其他平台配置。未追踪的多套平台配置不都是应用构建所需，选择实际使用的部分即可。
- **本地材料**：研究下载、截图/视频帧、构建日志、运行现场和个人会话日志不应作为产品 Changelog。研究目录现已被忽略，原始恢复材料在项目外保留。

根目录仍追踪一个 `src.zip`，约 84 KiB，内有 50 个旧源码/元数据条目（包括 `.DS_Store`）。它容易与真正的 `src/` 混淆，建议后续单独删除该历史压缩包；本轮保留了它。Android 原生目录当前被忽略，没有追踪文件，现有生产范围和本报告的原生重点仍是 iOS。

**3. 废弃任务材料的处理结果**

实际活跃任务只有当前“直接重构”与原有 `00-bootstrap-guidelines`；此前各 SDK 阶段主要是研究目录和旧计划，并不是七个独立活跃任务。

已将 **61 个旧研究/计划项、66,367 个 Git 候选文件、1,161,724,182 字节（约 1.16 GB）**移到项目外备份。剩余本地研究证据加入忽略规则；当前未追踪候选为 389 个，其中包含本次 12 个报告文件和新增的经验索引。

保留了有用的 MMKV 数据与恢复契约、本地 URI 迁移规则、Metro/FlashList/图片修复、直接目标的构建与验收证据，以及仍被直接目标使用的共享样本。当前任务入口已更新，旧逐版本路线不再是后续执行计划。

Git 原来没有追踪的 Changelog 文件；本轮也没有创建逐版本 Changelog。清理详情和恢复位置见 [cleanup.md](cleanup.md)，全部目录映射见 [retired-materials.csv](retired-materials.csv)。

**4. 当前第三方依赖盘点**

`package.json` 有 **51 个运行依赖、14 个开发依赖，共 65 个直接依赖**，实际安装版本全部与精确声明一致。完整版本、许可证、用途和建议见 [依赖全表](dependencies.md) 与 [dependencies.csv](dependencies.csv)。

从实现方式看，直接依赖包括 16 个社区原生包、3 个社区 JS 组件、17 个 Expo 官方包、3 个框架包、11 个纯 JS 包和 15 个构建/检查工具；最后一类包含放在运行依赖中的 `patch-package`。

**新架构判断依据是实际 Spec/codegen、Fabric、Nitro/JSI 或 Expo Modules 实现。仅在新架构应用里能运行，不等于库已迁移原生接口。** Expo 官方文档也说明，旧模块可以通过 interop 兼容层继续工作。[E1]

| 社区依赖 | 当前 → npm latest | 当前实现与用途 | 建议 |
| --- | --- | --- | --- |
| `react-native-track-player` | 4.1.2 → 4.1.2 | 旧原生模块，interop；播放、事件、锁屏控制 | 过渡保留；音频专项替换，见下节 |
| `react-native-fs` | 2.20.0 → 2.20.0 | 旧模块；下载、目录、文件读写与路径 | **优先改用 Expo FileSystem** |
| `react-native-background-timer` | 2.4.1 → 2.4.1 | 旧模块；睡眠定时、请求超时、delay | **拆分用途后重构**；没有直接等价的 Expo 定时器 |
| `react-native-volume-manager` | 2.2.0 → 2.2.0 | 旧模块；系统音量读写与监听 | 保留能力，改为自有现代模块是可行方向 |
| `@react-native-async-storage/async-storage` | 2.2.0 → 3.1.1 | 已有 TurboModule；配置持久化 | 保留 Expo 映射版本；避免仅为新架构再迁库 |
| `react-native-mmkv` | 4.3.2 → 4.3.2 | 已是 Nitro；业务数据持久化 | 保留，当前已完成关键 API/数据适配 |
| `react-native-nitro-modules` | 0.35.9 → 0.37.1 | Nitro/JSI 基础层；MMKV 必需 peer | 与 MMKV 成套维护，不独立盲升 |
| `react-native-gesture-handler` | 2.32.0 → 3.2.1 | 已有 Fabric/Turbo；播放器与歌词手势 | 保留 SDK57 推荐线，暂不跨到 3.x |
| `react-native-reanimated` | 4.5.1 → 4.6.0 | 已面向新架构；动画 | 与 Worklets 成套维护 |
| `react-native-worklets` | 0.10.1 → 0.12.2 | 新架构原生/JSI；Reanimated 配套 | 当前保留 0.10.x，不能只升级这一项 |
| `react-native-safe-area-context` | 5.7.0 → 5.9.1 | 已有 Fabric/Turbo；安全区 | 按 Expo 兼容范围维护 |
| `react-native-screens` | 4.26.0 → 4.27.0 | 已有 Fabric/Turbo；原生导航 | 按 Expo 兼容范围维护 |
| `@react-native-menu/menu` | 2.0.0 → 2.0.0 | 已有 Fabric；歌曲/设置菜单 | 可保留；Expo UI 是可选替代 |
| `react-native-loader-kit` | 4.1.0 → 4.1.0 | 已有 Fabric；两处播放中的跳动条 | 可用现有 Reanimated 精简，不是架构阻塞项 |
| `react-native-image-colors` | 2.6.0 → 2.6.0 | 已是 Expo Modules；封面调色板 | 保留；Expo Image 没有等价提取接口 |
| `expo-share-intent` | 8.0.1 → 8.0.1 | **社区包**，已是 Expo Modules；输入分享 | 评估官方 Sharing 替代，需功能迁移 |
| `@shopify/flash-list` | 2.0.2 → 2.3.2 | JS 列表，v2 要求新架构，无独立原生 Pod | 已适配；更高版本另做价值验证 |
| `react-native-awesome-slider` | 2.5.1 → 2.9.0 | JS + Reanimated/Gesture，无自有旧原生模块 | 可升级或改 Expo UI Slider；先核对补丁与交互 |
| `react-native-toast-message` | 2.2.1 → 2.5.2 | 纯 JS 提示组件 | 普通维护更新，不属于新架构迁移 |

上述 16 个社区原生直接依赖中，12 个已有现代实现，4 个仍使用旧接口。还需考虑两个表外边界：

- **自有 `UserApiModule`**：`ios/CyMusic/UserApiModule.h/.m` 仍使用 `RCTEventEmitter`、`RCT_EXPORT_MODULE` 和 `RCT_EXPORT_METHOD`。它承载独立 JavaScriptCore 音源脚本环境。应迁移导出接口到本地 Expo Module 或 TurboModule，同时保留脚本隔离、CommonJS/LX 协议、加密、请求关联、取消、事件和销毁语义；Expo 没有现成的 CyMusic 音源运行器。
- **间接 `@react-native-masked-view/masked-view@0.3.2`**：由 Router 引入，已经进入 Pods；使用 `requireNativeComponent`/旧 ViewManager，latest 仍是 0.3.2。不要为消除这一项直接破坏 Router 的内部依赖，应跟踪官方组合或验证实际导航替代路径。

另外，业务源码直接导入了 `buffer@5.7.1`，却没有在 `package.json` 显式声明，值得补齐。`react-native-svg` 仅在声明文件中出现，当前未安装、也没有对应 Pod，不能把它计为正在运行的原生库。

**5. Track Player 与官方音频替代的结论**

你对 Track Player 的判断是对的：**当前 4.1.2 仍是旧原生接口实现。** 安装包 JS 使用 `NativeModules.TrackPlayerModule`，iOS 使用 `RCTEventEmitter` 和旧导出宏，Android 使用 `ReactContextBaseJavaModule`，没有完整 TurboModule/Nitro 实现链。项目安装 Nitro 是为了 MMKV，不会自动把 Track Player 变成 Nitro。

| 方案 | 新架构与许可证 | 保留现有功能的关键差距 | 评估 |
| --- | --- | --- | --- |
| RNTP 4.1.2 | 旧模块 interop；Apache-2.0 | 已有本应用的业务适配与运行证据，继续保留架构债务 | **作为过渡基线保留** |
| RNTP v5：`@rntp/player@5.9.2` | 真正 TurboModule；商业/有限免费许可 | 新包与 v4 不兼容；接口和使用许可都需重新决定 | 功能接近，但不是免费开源的常规升级 |
| `expo-audio@57.0.4` | Expo Modules/JSI；MIT | 有原生 `AudioPlaylist`，但未打通 Playlist 与锁屏切歌控制 | **暂不能无损直接替换当前播放器** |
| `react-native-audio-api@0.13.3` | TurboModule/JSI；主项目 MIT | 有播放与锁屏 next/previous 事件；业务队列、根级生命周期和后台解析仍需适配 | **值得做有边界的开源方案验证** |

Expo Audio 57 已经有真正的原生队列，不能沿用“Expo Audio 不支持队列”的旧判断。但该精确版本中，锁屏控制的原生 owner 只接受单曲 `AudioPlayer`，`AudioPlaylist` 没有对应入口；公开控制也缺少本应用需要的 `RemoteNext` / `RemotePrevious` 契约。快进/快退十秒不等于上一首/下一首。单纯用 JS 自己排队无法补上缺失的原生锁屏命令。[A1]

本应用的队列并非把全部歌曲 URL 一次性交给原生：真正业务队列在 `src/store/playList.ts`，`trackPlayerIndex.ts` 使用“当前曲目 + 假下一曲”触发动态音源解析，锁屏切歌也进入同一业务 facade。因此替代方案必须保留后台解析、音质回退、失败跳过、队列持久化和完整文件缓存，而不只是“能播放一个 URL”。RNTP 的导入/类型引用涉及 37 个源码文件，替换应集中在既有播放入口与事件适配边界。

RNTP v5 的免费范围只覆盖限定的个人非职业用途或合格学术教学/研究，不能按“APP 免费发布”推导免费使用。官方当前单商业 App 价格为 €99/月或 €999/年，其他分发限制需按精确许可确认。RNTP4 的 Apache-2.0 许可不因此改变。

Audio API 是可研究的免费开源方向，但不能称为现成的 RNTP 等价库；其第三方构件还包括 WebKit BSD、可用 FFmpeg LGPL。若选择它，先验证锁屏/耳机切歌、后台动态音源、连续播放/失败恢复和生命周期，再决定是否承担全量适配。详细代码与许可依据见 [音频专项报告](audio-analysis.md) 和 [audio-sources.json](audio-sources.json)。

**6. Expo 57 能替换哪些依赖**

| 当前能力/依赖 | Expo 官方方案 | 替代程度 | 对本项目的建议 |
| --- | --- | --- | --- |
| RNFS 文件读写、下载、缓存 | 已安装 `expo-file-system@57.0.6` | **高** | 优先统一文件层，减少一个旧原生模块 |
| 输入分享 `expo-share-intent` | `expo-sharing@57.0.18` 的 `useIncomingShare` / payload API | **大部分可覆盖，但实验性** | 对现有分享扩展做专项迁移验证 |
| AsyncStorage | `expo-sqlite@57.0.2` 的 `expo-sqlite/kv-store` | **API 可覆盖，存量数据不自动迁移** | 有明确统一存储收益时再换 |
| MMKV4 | SQLite/kv-store 或自有存储层 | 功能可重做，性能和同步契约不同 | 当前已是 Nitro，不建议顺带再迁库 |
| 原生菜单 `@react-native-menu/menu` | `@expo/ui` 的 ContextMenu/Menu | 大部分菜单能力可覆盖 | 可选精简；保留长按、动作、图标、子菜单及禁用/删除状态 |
| Awesome Slider | `@expo/ui` Slider | 可覆盖基本滑块 | 手势、缓冲进度、动态样式和系统音量同步需适配；不是必换项 |
| LoaderKit 播放跳动条 | 已有 Reanimated；普通等待状态可用 Expo UI ProgressView | 视觉效果需重新实现 | 当前是 `LineScaleParty` 播放指示，不能直接换成普通 loading 而声称等价 |
| Image Colors 封面主色/调色板 | Expo Image 无同等 palette API | **无直接替代** | 保留已有 Expo Modules 实现 |
| Track Player | Expo Audio | 部分覆盖，锁屏队列有缺口 | 见上一节，不直接替换 |
| Background Timer | Expo BackgroundTask/TaskManager | **不等价** | BackgroundTask 是系统择机任务，不是精确定时器 |
| 系统输出音量 | Expo Audio 的 `volume` | **不等价** | `volume` 控制播放器增益，不含系统音量读写/硬件键监听 |
| CryptoJS/音源加密 | `expo-crypto@57.0.2` | 摘要/随机数/AES-GCM 可覆盖一部分 | 当前 AES-CBC/ECB、编码与源协议不能整体直接替换 |
| 自有 JSC 音源运行器 | 本地 Expo Module 开发 API | 提供封装方式，没有业务替代品 | 迁移模块接口，保留原脚本环境和功能 |

文件层是收益最明确的一项。Expo FileSystem 57 的 `File`、`Directory`、`Paths`、`FileHandle` 和 `DownloadTask` 已包含读写、移动、目录操作、分段读取、下载进度、取消及暂停/恢复等能力。当前项目 4 个文件仍导入 `/legacy` API，这个路径表示旧版 API 表面，不能直接等同为“旧 RN Bridge 模块”。应将它们与 5 个直接 RNFS 调用文件一起梳理。[E2]

迁移时需保留 Documents 数据、Library 下的历史封面路径、下载/缓存目录、已存 URI 的重定位、文件所有权及删除约束。`Paths` 并未直接提供当前 RNFS 使用的同名 `LibraryDirectoryPath`，路径映射要显式处理；新下载 API 的返回值/错误也不是 RNFS 的 `statusCode`。iOS 后台传输可以继续，但原 JS task 在进程重建后不会自动恢复，不能扩张原有功能承诺。

Expo Sharing 57 已支持 iOS/Android 接收文本、URL 和文件，且插件允许指定现有 App Group、扩展 bundle ID 和 activation rules。**官方仍将输入分享标为 experimental，并说明 iOS 从分享扩展打开主应用的方式未获 Apple 正式支持，未来可能变化。** 切换前要核对现有分享数据格式、待处理分享、`clip` 剪贴板深链、Safari/Files 冷启动、去重及清理；不能让生成插件覆盖现有原生扩展后就认定迁移完成。[E3]

后台计时应拆开处理：两个网络请求模块的超时和普通 delay 可评估标准 `AbortController`/计时机制；睡眠定时需在可持续播放的根级或原生播放 owner 中维护截止时间、取消及暂停动作。Expo BackgroundTask 明确不保证准确时刻执行，不能替换当前到点暂停功能。[E6]

**7. 哪些升级值得先做**

建议目标组合是当日稳定的 **Expo 57.0.21 + RN 0.86.3 + React 19.2.3**，并协调 Router 57.0.20、babel-preset-expo 57.0.11。当前已验证工作区仍为 Expo 57.0.20；这个补丁更新尚未执行。Expo 57.0.21 的官方映射仍指定上述 RN/React，不能把 npm 独立最新 RN 0.87.1 或 React 19.2.8直接拼进去。

| 优先级 | 工作 | 价值与边界 |
| --- | --- | --- |
| P0 | 明确音频目标，先验证 Audio API 或自有现代音频模块方案 | 决定能否真正摆脱 RNTP4，同时保持锁屏切歌和后台音源业务 |
| P1 | RNFS → Expo FileSystem，保留数据/路径契约 | 已有官方依赖，替换范围清晰，直接减少旧模块 |
| P1 | 自有 UserApiModule 的现代接口、后台定时、系统音量 | 解决三处仍在旧接口上的核心能力；按现有 owner 拆分实施 |
| P1 | 同 SDK 补丁协调更新；补显式 buffer；Node 类型对齐实际工具链 | 保持构建可重现，避免依赖偶然由其他包带入；不做所有包 latest 扫升 |
| P2 | Expo Sharing 输入分享迁移验证 | 有机会减少社区模块和补丁，但有实验性/原生扩展迁移成本 |
| P2 | Slider 维护更新、LoaderKit 精简、可选 Expo UI 菜单 | 属于维护与体积收益，现有包多数已支持新架构 |
| P2 | Axios 等仍在使用的 JS 库维护更新 | 核对音源请求、取消、编码和 Metro 行为；不把包版本变化当新架构进度 |
| 暂缓 | AsyncStorage3、再次替换MMKV、GestureHandler3、Zustand5、Immer11、Babel8、TS7、ESLint10 | 多数不能消除当前原生兼容依赖，却会增加数据/API/工具链变化 |

Reanimated 的版本约束尤其具体：当前 4.5.1 需要 Worklets 0.10.x；4.6.0 需要 0.12.x。两项不能分开升级。当前 MMKV4、FlashList2、菜单、Image Colors 和 LoaderKit 已有相应现代实现，不需要为了“看起来更彻底”再换一遍。

`iconv-lite` 与根级 `@babel/preset-env` 未发现应用/根配置的直接使用，可作为删除直接声明的候选。`expo-font`、`expo-linking`、`expo-splash-screen`、Nitro、Worklets 和 patch-package 虽然可能没有业务 import，却分别参与 peer、原生配置、构建或安装，不能按零 import 删除。

**8. 验证范围与交付索引**

本轮完成了 Git 路径逐项导出、65 个声明/安装版本核对、官方 npm 稳定标签查询、Expo 57.0.20 与 57.0.21 映射比较、应用 AST 引用扫描、重点原生实现及官方替代 API 检查。iOS Pod 锁中的 212 项（含 subspec）和 125 个声明入口已导出为 [pods.csv](pods.csv)；它们不等于 212 个需要单独升级的 RN 库。SwiftAudioEx、MMKVCore、SDWebImage、图像解码器等底层依赖应跟随其上层播放器/存储/图片包维护。

已有 Debug/Release、数据恢复与人工验收结果按原范围保留。本轮没有重新安装依赖、Pods、构建或运行模拟器。D01 真机、A07 内部清理、完整 Release 逻辑数据比较和实际 CI 执行仍是后续范围；现有 TS2578、lint 56 errors/61 warnings、Doctor 18/21 也没有被这份报告消除。

| 文件 | 用途 |
| --- | --- |
| [tracked-files.csv](tracked-files.csv) | 全部 251 个追踪路径、状态和 GitHub 建议 |
| [untracked-files.csv](untracked-files.csv) | 当前 389 个未忽略候选及用途分类 |
| [dependencies.md](dependencies.md) / [dependencies.csv](dependencies.csv) | 全部 65 个直接依赖、版本、用途、建议；CSV含引用与许可证 |
| [pods.csv](pods.csv) | 完整 iOS Pod 锁条目 |
| [audio-analysis.md](audio-analysis.md) | 播放器架构、功能与许可证深度比较 |
| [cleanup.md](cleanup.md) / [retired-materials.csv](retired-materials.csv) | 已执行的旧材料清理及恢复映射 |
| [git-state.json](git-state.json) / [sources.json](sources.json) / [audio-sources.json](audio-sources.json) | 快照、兼容矩阵及可追溯来源 |

主要外部依据（获取于 2026-09-09；精确查询时刻与包数据见来源文件）：

- **E1**：[Expo 新架构与 interop 说明](https://docs.expo.dev/guides/new-architecture/)。
- **E2**：[Expo FileSystem SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/filesystem/)，并核对当前安装的 57.0.6 类型/API源码。
- **E3**：[Expo Sharing SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/)，并核对 57.0.18 发布包及配置插件。
- **E4**：[Expo SQLite SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/)，并核对 kv-store 的 Storage 实现。
- **E5**：[Expo UI SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/ui/)，并核对 ContextMenu/Menu/Slider/ProgressView 发布源码。
- **E6**：[Expo BackgroundTask SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/background-task/)。
- **E7**：[Expo Image SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/image/)、[Expo Crypto SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/crypto/)。
- **A1**：[Expo Audio SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/audio/)；RNTP4/v5、Audio API的精确发布源码与许可链接见音频专项报告。
