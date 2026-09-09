# 完整直接依赖清单

共 65 项：51 个 dependencies、14 个 devDependencies。查询时间：2026-09-09T14:42:48.252560+00:00。65 个已安装版本均与 package.json 精确声明一致。

“npm latest”是查询时稳定标签，不代表建议安装版本。Expo 57.0.21 的 bundledNativeModules 映射用于兼容比较；详细范围、许可证、架构证据及源码位置见 [dependencies.csv](dependencies.csv)。原生能力不由包名前缀判断。

**运行依赖（51）**

| 依赖 | 当前 → npm latest | 类型 | 建议与理由 |
| --- | --- | --- | --- |
| `@babel/runtime` | 7.24.1 → 8.0.0 | 纯JS | **保留7.x**。Babel运行辅助与依赖peer；Expo57的preset仍要求^7.20.0，不直接上8。 |
| `@expo/vector-icons` | 15.0.3 → 15.1.1 | Expo官方 | **按SDK维护**。15.1.1满足Expo范围，但不是架构迁移项；无需为升版本替换整套图标。 |
| `@react-native-async-storage/async-storage` | 2.2.0 → 3.1.1 | 社区原生 | **保留2.2.0**。当前已支持TurboModule且是Expo57映射。3.1.1有新数据库API及legacy迁移入口，不为新架构额外迁库；可评估expo-sqlite/kv-store。 |
| `@react-native-menu/menu` | 2.0.0 → 2.0.0 | 社区原生 | **保留；可选替换**。2.0.0已有Fabric。@expo/ui ContextMenu/Menu可替换，需保留菜单动作、图标、嵌套与长按/点击行为，架构收益有限。 |
| `@shopify/flash-list` | 2.0.2 → 2.3.2 | 社区JS组件 | **保留SDK版本**。2.0.2已面向新架构。2.3.2可做独立性能/缺陷评估，Expo映射仍是2.0.2；保留memo辅助槽修复。 |
| `axios` | 1.7.2 → 1.20.0 | 纯JS | **维护升级候选**。1.7.2→1.20.0仍为1.x；保留XHR、请求取消/响应和音源行为，并复核Metro定向解析。不是原生架构项。 |
| `base-64` | 0.1.0 → 1.0.0 | 纯JS | **低优先级更新**。0.1.0→1.0.0需验证音频元数据解码；纯JS，不影响原生新架构。 |
| `crypto-js` | 4.2.0 → 4.2.0 | 纯JS | **保留现有协议实现**。4.2.0已是latest。Expo Crypto57支持摘要/随机数/AES-GCM，但不能直接替代当前AES-CBC/ECB与协议编码。 |
| `expo` | 57.0.20 → 57.0.21 | 框架 | **同SDK补丁升级候选**。57.0.20→57.0.21，协同Router57.0.20和babel-preset-expo57.0.11；不独立提升RN/React。 |
| `expo-blur` | 57.0.2 → 57.0.2 | Expo官方 | **保留**。已为官方SDK57模块；暂无版本差。 |
| `expo-constants` | 57.0.17 → 57.0.17 | Expo官方 | **保留**。设置页和Router/share-intent依赖；保持SDK映射。 |
| `expo-dev-client` | 57.0.18 → 57.0.18 | Expo官方 | **保留开发用途**。没有业务import不等于未使用；原生开发客户端与联调需要。 |
| `expo-document-picker` | 57.0.1 → 57.0.1 | Expo官方 | **保留**。本地音频和音源文件导入的官方模块。 |
| `expo-file-system` | 57.0.6 → 57.0.6 | Expo官方 | **统一文件层**。已安装57.0.6；当前业务仍使用/legacy API。可用File/Directory/Paths/DownloadTask替换RNFS并逐步改成新API，保留路径和下载语义。 |
| `expo-font` | 57.0.3 → 57.0.3 | Expo官方 | **保留peer/基础能力**。图标/Expo依赖使用；不能因业务无直接import就删除。 |
| `expo-haptics` | 57.0.2 → 57.0.2 | Expo官方 | **保留**。已为官方SDK57模块。 |
| `expo-image` | 57.0.4 → 57.0.4 | Expo官方 | **保留**。已为官方SDK57图片组件；无等价封面调色板API替代image-colors。 |
| `expo-image-picker` | 57.0.16 → 57.0.16 | Expo官方 | **保留**。歌单自定义封面；保留已有Library图片URI重定位。 |
| `expo-keep-awake` | 57.0.1 → 57.0.1 | Expo官方 | **保留**。播放器设置所需；已为官方模块。 |
| `expo-linear-gradient` | 57.0.1 → 57.0.1 | Expo官方 | **保留**。播放器视觉效果；已为官方组件。 |
| `expo-linking` | 57.0.9 → 57.0.9 | Expo官方 | **保留peer/链接能力**。Router和share-intent的peer依赖，业务无直接import不能判未使用。 |
| `expo-localization` | 57.0.1 → 57.0.1 | Expo官方 | **保留补丁**。57.0.1仍需当前日历dangi与fallback补丁，源码编译选择一起保留。 |
| `expo-router` | 57.0.19 → 57.0.20 | Expo官方 | **同SDK补丁升级候选**。57.0.19→57.0.20随Expo57.0.21协调；保留搜索/导航/分享provider修复。 |
| `expo-share-intent` | 8.0.1 → 8.0.1 | 社区原生 | **官方替代验证候选**。社区包，已使用Expo Modules且与Expo57匹配。Expo Sharing57接收功能可替换大部分能力，但experimental，需迁App Group数据、剪贴板深链和冷启动去重。 |
| `expo-splash-screen` | 57.0.8 → 57.0.8 | Expo官方 | **保留配置插件**。app.json启用；业务无直接import不能判未使用。 |
| `expo-status-bar` | 57.0.1 → 57.0.1 | Expo官方 | **保留**。Expo官方JS封装；不是待迁移旧原生模块。 |
| `i18n-js` | 4.5.0 → 4.5.3 | 纯JS | **小版本维护候选**。4.5.0→4.5.3；保留翻译键和语言持久化。 |
| `iconv-lite` | 0.6.3 → 0.7.3 | 纯JS | **直接声明移除候选**。应用源码/原生资源/配置未见直接使用；核对实际依赖链后移除直接声明，transitive仍可保留。 |
| `immer` | 10.1.1 → 11.1.18 | 纯JS | **暂缓大版本**。10→11不解决原生架构问题，现有配置/队列状态更新需要独立验证。 |
| `lodash` | 4.17.21 → 4.18.1 | 纯JS | **同系列维护候选**。4.17.21→4.18.1；保留搜索节流/去抖行为。 |
| `lodash.shuffle` | 4.2.0 → 4.2.0 | 纯JS | **保留**。4.2.0已是latest，业务随机播放使用；可日后与lodash去重。 |
| `patch-package` | 8.0.0 → 8.0.1 | 开发工具 | **保留安装工具**。postinstall --error-on-fail应用四个补丁；不是业务运行库。8.0.1可独立维护更新。 |
| `react` | 19.2.3 → 19.2.8 | 框架 | **保留Expo映射**。Expo57.0.21仍映射19.2.3；npm19.2.8不作为独立升级指令。 |
| `react-native` | 0.86.3 → 0.87.1 | 框架 | **保留Expo映射**。Expo57.0.21仍映射0.86.3；独立latest0.87.1不与当前SDK混装。 |
| `react-native-awesome-slider` | 2.5.1 → 2.9.0 | 社区JS组件 | **更新或替换验证**。纯JS+Reanimated/Gesture，不是旧原生模块。2.9.0可核对类型修复后升级；@expo/ui Slider或官方文档收录的社区slider需重做拖动/样式映射。 |
| `react-native-background-timer` | 2.4.1 → 2.4.1 | 社区原生 | **高优先级重构**。2.4.1仍为旧模块。拆分网络超时与睡眠定时；Expo BackgroundTask不提供精确到时回调，不能直接替代。 |
| `react-native-fs` | 2.20.0 → 2.20.0 | 社区原生 | **优先替换**。2.20.0仍为旧模块且latest未变；统一到已安装的Expo FileSystem57，迁移5个直接调用文件。 |
| `react-native-gesture-handler` | 2.32.0 → 3.2.1 | 社区原生 | **保留SDK版本**。2.32.0已支持新架构；latest3.2.1是大版本且不在Expo57映射，不盲升。 |
| `react-native-image-colors` | 2.6.0 → 2.6.0 | 社区原生 | **保留**。2.6.0已用Expo Modules，latest相同；Expo Image没有等价调色板提取API。 |
| `react-native-loader-kit` | 4.1.0 → 4.1.0 | 社区原生 | **可选精简**。4.1.0已有Fabric；实际用于LineScaleParty播放指示。可用已有Reanimated重做同效果，普通ProgressView并不等价。 |
| `react-native-mmkv` | 4.3.2 → 4.3.2 | 社区原生 | **保留**。4.3.2已为Nitro新实现且latest相同；不为减少依赖再迁一遍用户数据库。 |
| `react-native-nitro-modules` | 0.35.9 → 0.37.1 | 社区原生 | **跟随MMKV配套维护**。0.37.1可研究但非自动必升；当前0.35.9与MMKV4.3.2已有运行/数据证据。无业务import仍为必需peer。 |
| `react-native-reanimated` | 4.5.1 → 4.6.0 | 社区原生 | **保留配套组合**。当前4.5.1要求Worklets0.10.x；4.6.0要求0.12.x。作为成套升级单独验证，不只升其中一项。 |
| `react-native-safe-area-context` | 5.7.0 → 5.9.1 | 社区原生 | **按SDK维护**。5.7.0已有Fabric/Turbo；5.9.1超出Expo当前~5.7.0范围，不因latest独立升级。 |
| `react-native-screens` | 4.26.0 → 4.27.0 | 社区原生 | **按SDK维护**。4.26.0已有Fabric/Turbo；4.27.0超出~4.26.0范围；保留当前唯一版本和搜索header行为。 |
| `react-native-toast-message` | 2.2.1 → 2.5.2 | 社区JS组件 | **可做小版本更新**。纯JS；2.2.1→2.5.2不涉及旧原生模块。 |
| `react-native-track-player` | 4.1.2 → 4.1.2 | 社区原生 | **过渡保留；后续音频专项**。4.1.2仍为旧原生模块interop。Expo Audio57有原生Playlist但未接入完整锁屏切歌；v5新包为商业/有限许可；见audio-analysis.md。 |
| `react-native-volume-manager` | 2.2.0 → 2.2.0 | 社区原生 | **保留能力，规划模块替换**。2.2.0仍为旧模块；Expo Audio volume是播放器增益，不能替代系统音量get/set/listener。可在自有Expo Module中保留该能力。 |
| `react-native-worklets` | 0.10.1 → 0.12.2 | 社区原生 | **保留配套组合**。0.10.1与Reanimated4.5.1配套；latest0.12.2须随Reanimated4.6.0一起评估。 |
| `ts-pattern` | 5.0.8 → 5.9.0 | 纯JS | **低优先级维护**。5.0.8→5.9.0；纯JS模式匹配，不影响原生架构。 |
| `zustand` | 4.5.2 → 5.0.15 | 纯JS | **暂缓大版本**。4.5.2→5.0.15需检查selector稳定性、订阅和持久化；当前没有为新架构必须升级的依据。 |

**开发依赖（14）**

| 依赖 | 当前 → npm latest | 建议与理由 |
| --- | --- | --- |
| `@babel/core` | 7.29.0 → 8.0.1 | **保留7.x**。latest8.0.1；Expo57 preset仍基于Babel7插件链，不直接切8。 |
| `@babel/preset-env` | 7.24.5 → 8.0.2 | **直接声明移除候选**。本项目Babel配置只使用babel-preset-expo；核对构建链后再删直接声明，暂不升8。 |
| `@react-native/metro-config` | 0.86.3 → 0.87.1 | **保留配套版本**。0.86.3与RN匹配并满足Worklets peer；真正Metro入口为expo/metro-config。 |
| `@types/lodash.shuffle` | 4.2.9 → 4.2.9 | **保留**。4.2.9已是latest，TypeScript工具依赖。 |
| `@types/node` | 16.9.1 → 26.5.0 | **优先对齐工具链**。16.9.1偏离CI Node24；应选择24.x类型，而不是直接用npm latest26.5.0。 |
| `@types/react` | 19.2.14 → 19.2.18 | **同系列补丁候选**。19.2.14→19.2.18，与React19.2工具链一并验证。 |
| `@typescript-eslint/eslint-plugin` | 8.69.0 → 8.70.0 | **成对维护更新**。8.69.0→8.70.0，与parser同步；现存lint问题另行归因。 |
| `@typescript-eslint/parser` | 8.69.0 → 8.70.0 | **成对维护更新**。8.69.0→8.70.0，与plugin同步。 |
| `babel-preset-expo` | 57.0.10 → 57.0.11 | **同SDK补丁升级候选**。57.0.10→57.0.11随Expo57.0.21协调。 |
| `eslint` | 8.57.0 → 10.10.0 | **独立工具链任务**。8.57.0→10.10.0涉及flat config及插件兼容；不要与原生重构绑在一起。 |
| `eslint-plugin-react` | 7.34.1 → 7.37.5 | **维护更新候选**。7.34.1→7.37.5，核对现有ESLint8兼容范围。 |
| `eslint-plugin-react-hooks` | 4.6.0 → 7.1.1 | **独立规则升级**。4.6.0→7.1.1可能引入新规则与编译器检查；不要用升级掩盖当前基线。 |
| `prettier` | 3.2.5 → 3.9.6 | **低优先级维护**。3.2.5→3.9.6；避免在重构中产生全仓无关格式差异。 |
| `typescript` | 6.0.3 → 7.0.2 | **暂缓大版本**。6.0.3→7.0.2需独立评估编译器/API和工具支持；当前TS2578不能当升级已解决。 |

**扫描口径与额外发现**

- 使用 TypeScript AST 扫描 src 下 JS/TS/JSX/TSX（含声明文件），以及根 JS 配置中的 import/export/require/dynamic import。CSV 的文件数包含类型引用，不能当作运行时调用数。配置插件、原生自动链接、peer 与生成代码另行核对，零个业务 import 不直接判定未使用。
- `buffer@5.7.1` 被三个业务文件直接导入，另有类型引用，但未直接声明。建议补显式依赖；npm latest=6.0.3，是否同时升主版本单独验证。
- `react-native-svg` 只出现在 src/types/declarations.d.ts 的 SvgProps 声明；当前未安装、无 RNSVG Pod。它不是本应用已在运行的原生依赖。`node:crypto` 也只在 .d.ts 中，不是Hermes业务运行时加载。
- Router57.0.19 间接引入 `@react-native-masked-view/masked-view@0.3.2`（旧视图接口、latest仍0.3.2）及 `@expo/ui@57.0.16`（官方Expo模块）。两者已在Pod锁文件中，不能仅看65个直接声明。
- `xcode@3.0.1` 是构建时的间接依赖，Apache-2.0；现有补丁防止不存在的PBXGroup导致插件崩溃。
- `react-native-track-player`、`typescript` 的直接依赖许可证为 Apache-2.0；其余当前直接依赖 metadata 为 MIT。更换到RNTP v5的许可不同，见音频报告。
