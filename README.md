<p align="center">
  <img src="1024.png" alt="CyMusic Logo" width="180" style="border-radius: 20%;" />
</p>

<h1 align="center">CyMusic </h1>

<p align="center">一个基于 React native 开发的音乐软件。支持开发可以点点star。</p>

<p align="center">
  <img src="https://img.shields.io/badge/Expo-57.0.21-blue" alt="Expo" />
  <img src="https://img.shields.io/badge/Node-24.19.0-brightgreen" alt="Node" />
  <img src="https://img.shields.io/badge/platforms-iOS-lightgrey" alt="platforms" />
</p>

##  简介

代码未内置源。可以导入自定义源，注意导入的音乐源的安全可靠性。**CyMusic 官方 App 永久免费，仅限个人非商业使用，禁止用于商业用途。** 如有侵权请联系删除。源码与第三方组件的授权范围见下方[项目协议](#项目协议)。

-  **支持的平台**：iOS 16.4 及以上
-  **软件下载**：[发布页面](https://github.com/gyc-12/Cymusic/releases)
-  **自定义源示例**：[CyMusic-ImportMusicApi-Example](https://github.com/gyc-12/CyMusic-ImportMusicApi-Example)
-  **TG频道**：[https://t.me/gyc_123](https://t.me/gyc_123)

##  截图展示

![应用截图](readme.jpg)

##  技术栈

-  **React Native 0.86.3 / React 19.2.3**：New Architecture、Fabric 和 Hermes
-  **Expo 57.0.21**：与 React Native 配套的稳定版本
-  **TypeScript**：JavaScript 的超集，添加了静态类型检查
-  **React Native Track Player v5（`@rntp/player` 5.9.2）**：通过 New Architecture 原生接口播放音频，采用[独立许可证](third-party-licenses/rntp-player-5.9.2.txt)
-  **Zustand**：轻量级状态管理库
-  **Expo Router**：基于文件系统的路由，使用其配套的导航依赖
-  **MMKV 4 / Nitro 与 AsyncStorage**：保留现有数据库和分块存储格式
-  **本地 Expo Modules**：文件路径安全查询、自有 JavaScriptCore 音源运行时、系统音量和定时服务

##  开发指南

使用 macOS、Xcode 26.4 及以上和 Node 22.13 及以上的受支持 LTS 版本。
本次本机构建使用 Xcode 26.6、Node 24.19.0、Yarn 1.22.22、CocoaPods 1.16.2；
CI 配置也固定为这组版本。最低运行系统为 iOS 16.4。

### 安装依赖

以下命令从仓库根目录执行。首次复现使用新的检出目录，不带入已有的
`node_modules`、`ios/Pods`、`ios/build` 或其他 DerivedData。下载缓存可以复用；
已安装的 Pods 包含 Debug/Release 状态，不能作为下载缓存复用。

```bash
yarn install --frozen-lockfile --non-interactive
cd ios
pod _1.16.2_ install --deployment
cd ..
```

使用仓库中的 `yarn.lock`、`ios/Podfile.lock` 和 `patch-package --error-on-fail`。
补丁失败时应修复对应版本的补丁；不要跳过 postinstall 或改用另一份锁文件。

`@react-native-menu/menu@2.0.0` 的 iOS 补丁修复新架构下默认图标颜色被转换为透明色的问题
（[上游 issue #1034](https://github.com/react-native-menu/menu/issues/1034)）。
补丁让颜色值 `0` 沿用系统着色，恢复菜单图标及深浅色适配；此版本不支持用 `0` 隐藏图标。
更新该补丁后需要重新构建 iOS App，仅刷新 JavaScript 不会生效。

项目保留了 `ios/` 原生工程，其中包含 `user-api-preload.js` 和分享扩展。
自定义 JavaScriptCore 引擎与现代原生接口位于 `modules/cymusic-native/`，通过
Expo 自动链接加入原生构建。修改 Expo 配置后，需要同步检查原生工程；
不要运行 `expo prebuild` 重新生成原生工程：SDK 57 默认执行 clean，
`--no-clean` 也可能重写自定义分享扩展。

`package.json` 的公共配置 `expo.autolinking.ios.buildFromSource` 保留四项：
`expo-localization`、`expo-share-intent`、`ExpoModulesCore`、`ExpoModulesWorklets`。
定位和分享模块通过源码编译应用补丁；Core 源码选择消除本机路径参与 Pod 校验和的问题，
Worklets 同时使用源码以匹配静态 Core 的链接。该配置还会让 `ExpoFileSystem`、
`ExpoFont` 和 `ExpoImage` 使用源码，这五个模块都编译为静态库；图像编解码依赖
以 `ios/Podfile.lock` 为准。React、ReactNativeDependencies 和 Hermes v1 保留上游
按 Debug/Release 切换的预编译产物。`ExpoModulesJSI` 则由自己的上游 SPM 脚本
固定以 Release 编译，包括 Debug 宿主构建。

### 运行 iOS 版本

```bash
npx expo run:ios --no-install
```

自定义原生模块需要开发构建，不能直接在 Expo Go 中运行。切换 Node 安装路径后，
检查被忽略的 `ios/.xcode.env.local` 是否仍指向有效的 Node 可执行文件。

### 本地 Pods 配置恢复

仅针对当前 RN 0.86.3 / CocoaPods 1.16.2 的已有安装目录：如果先构建 Release，
再在同一 `ios/Pods` 中运行 `pod install`，CocoaPods 可能删除
`React-Core-prebuilt/.last_build_configuration` 和
`ReactNativeDependencies/.last_build_configuration`，却保留 Release 框架。
后续 Debug 会按上游“无标记即初始 Debug”的规则跳过替换，可能缺少 Debug 符号。

遇到这一状态时，可在新检出目录按上述锁定命令复现。需要保留该 Pods 目录时，
先停止使用同一目录的原生构建，确认当前依赖已完整安装、Node 版本符合上述要求，
且 Pods 中两组对应的 Debug/Release artifact tar 包齐全，再从仓库根目录运行
以下已验证的官方脚本序列。它会恢复两个框架及其配置标记：

```bash
(
  set -e
  cd ios/Pods
  node ../../node_modules/react-native/scripts/replace-rncore-version.js -c Release -r 0.86.3 -p "$PWD"
  node ../../node_modules/react-native/scripts/replace-rncore-version.js -c Debug -r 0.86.3 -p "$PWD"
  node ../../node_modules/react-native/third-party-podspecs/replace_dependencies_version.js -c Release -r 0.86.3 -p "$PWD"
  node ../../node_modules/react-native/third-party-podspecs/replace_dependencies_version.js -c Debug -r 0.86.3 -p "$PWD"
)
```

标记与框架一致后，正常构建会按配置切换 React、ReactNativeDependencies 和 Hermes。
再次运行 `pod install` 后应重新检查上述状态。CI 使用全新的 Pods 目录，不运行这段恢复命令。

### 构建未签名 iOS 应用

```bash
xcodebuild -workspace ios/CyMusic.xcworkspace \
  -scheme CyMusic -configuration Release -sdk iphoneos \
  -derivedDataPath ios/build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" DEVELOPMENT_TEAM=""
```

现有 GitHub Actions 工作流使用 `macos-26` 和相同的固定工具版本，输出未签名 IPA。
安装到真机仍需自己的有效签名和 App Group 配置。模拟器及未签名构建不代表
真机后台播放、锁屏遥控或签名分享已经通过验证。

升级已有安装时保留应用身份及 App Group，不要卸载应用。MMKV 升级前应备份
完整应用数据；源码回退不能恢复新版存储核心写过的数据库。

### 专项回归与当前状态

使用上述 Node 24 环境运行；包含 Foundation、JavaScriptCore 或 Swift 的检查需要 macOS/Xcode：

```bash
node scripts/check-rntp-player.mjs
node scripts/check-rntp-remote-native.mjs
node scripts/check-local-files.mjs
node scripts/check-file-downloads.mjs
node scripts/check-source-host.mjs
node scripts/check-source-runtime.mjs
node scripts/check-volume.mjs
node scripts/check-volume-native.mjs
node scripts/check-request-timers.mjs
node scripts/check-sleep-timer.mjs
node scripts/check-native-services.mjs
```

文件 I/O 已统一到 Expo FileSystem；系统音量、HTTP 有限后台执行时间和睡眠截止事件
由本地 Expo Modules 提供。播放器已迁移到 RNTP v5，保留现有业务歌单、音源解析和缓存；
输入分享保留现有扩展和协议。播放器迁移的验证与回退说明见
[RNTP v5 集成记录](docs/maintenance/2026-09-10-rntp-v5.md)。
此前框架和自有模块的版本、构建结果及历史静态检查问题见
[升级优化结果与验证范围](docs/maintenance/2026-09-10-results.md)，任务顺序见
[执行计划](docs/maintenance/2026-09-10-plan.md)，全部 Git 追踪路径见
[项目文件状态](docs/maintenance/2026-09-10-files.md)。

##  功能列表

### 已完成功能

- ✅ 播放本地音乐功能
- ✅ 下载和缓存音乐功能
- ✅ 歌曲加入指定歌单
- ✅ 删除歌单内歌曲功能
- ✅ 一些动画细节模仿AM
- ✅ 查看专辑
- ✅ player页面多选项，分享功能
- ✅ 在线链接导入音源功能
- ✅ 增加日志系统
- ✅ 歌词滑动、字体大小调整
- ✅ 搜索结果翻页
- ✅ 播放器中的单曲系统分享；本地多选导出当前展示文件路径
- ✅ 多选功能
- ✅ Toast 提示
- ✅ 显示已缓存标识
- ✅ 新建自定义歌单
- ✅ 遇到无高音质的音乐自动尝试切换低一级音质播放
- ✅ 首页列表加载歌曲分页
- ✅ 定时关闭
- ✅ 歌词界面保持手机亮屏
- ✅ 音源文件导入更新逻辑，如果第一次导入，则自动选择
- ✅ 进入后台后的一些Alert处理
- ✅ 导入歌单输入栏被键盘遮挡 [#85](https://github.com/gyc-12/Cymusic/issues/85)
- ✅ APP启动图片不适配不同屏幕的机子 [#91](https://github.com/gyc-12/Cymusic/issues/91)
- ✅ 搜索歌手和歌曲分開 [#95](https://github.com/gyc-12/Cymusic/issues/95)

### 待实现功能

- 🔄 网易云歌单
- 🔄 歌词不同步调整
- 🔄 音源文件分享到应用
- 🔄 对导入的所有音源进行批量测试可用性
- 🔄 flac 格式音乐快进后歌词不同步问题
- 🔄 文档完善
- 🔄 （待添加更多任务）

##  参考项目

- [CodeWithGionatha-Labs/music-player](https://github.com/CodeWithGionatha-Labs/music-player)
- [lyswhut/lx-music-mobile](https://github.com/lyswhut/lx-music-mobile)
- [maotoumao/MusicFree](https://github.com/maotoumao/MusicFree)

##  项目协议

本项目的源码许可、第三方组件许可与官方 App 使用范围分别如下：

- **CyMusic 自有源码**按 [Apache License 2.0](LICENSE) 授权。下述 App 使用说明不修改 Apache-2.0 的条款，也不撤销已有的源码授权。
- **RNTP v5 不属于 CyMusic 的 Apache-2.0 授权范围**，不能因为本项目开源而将 RNTP v5 视为 Apache-2.0、MIT 或其他开源许可证下的软件。本项目使用 `@rntp/player@5.9.2`；其版权属于 Double Symmetry GmbH，适用随该版本发布的[独立许可证原文](third-party-licenses/rntp-player-5.9.2.txt)。来源与版本见[第三方许可说明](third-party-licenses/README.md)。使用或分发时须遵守该许可证，CyMusic 不另行授予其商业使用或再许可权利。
- **集成 RNTP v5 的 CyMusic 官方 App 永久免费，仅限个人、非职业、非商业使用，禁止商业用途。** 免费不等于可以用于公司、组织或商业产品；RNTP 的授权条件以其原文为准。其他第三方依赖同样保留各自的许可证。

以下为官方 App 的使用说明，不替代自有源码或第三方组件各自的许可证。

---

### 词语约定

本协议中的"本项目"指Music Player项目；"使用者"指签署本协议的使用者；"官方音乐平台"指对本项目内置的包括酷我、酷狗、咪咕等音乐源的官方平台统称；"版权数据"指包括但不限于图像、音频、名字等在内的他人拥有所属版权的数据。

### 一、数据来源 

1.1 本项目的各官方平台在线数据来源原理是从其公开服务器中拉取数据（与未登录状态在官方平台APP获取的数据相同），经过对数据简单地筛选与合并后进行展示，因此本项目不对数据的合法性、准确性负责。

1.2 本项目本身没有获取某个音频数据的能力，本项目使用的在线音频数据来源来自软件设置内"音乐来源"设置所选择的"源"返回的在线链接。例如播放某首歌，本项目所做的只是将希望播放的歌曲名字、歌手名字等信息传递给"源"，若"源"返回了一个链接，则本项目将认为这就是该歌曲的音频数据而进行使用，至于这是不是正确的音频数据本项目无法校验其准确性，所以使用本项目的过程中可能会出现希望播放的音频与实际播放的音频不对应或者无法播放的问题。

1.3 本项目的非官方平台数据（例如我的收藏列表）来自使用者本地系统或者使用者连接的同步服务，本项目不对这些数据的合法性、准确性负责。

### 二、版权数据 

2.1 使用本项目的过程中可能会产生版权数据。对于这些版权数据，本项目不拥有它们的所有权。为了避免侵权，使用者务必在**24小时内**清除使用本项目的过程中所产生的版权数据。

### 三、音乐平台别名 

3.1 本项目内的官方音乐平台别名为本项目内对官方音乐平台的一个称呼，不包含恶意。如果官方音乐平台觉得不妥，可联系本项目更改或移除。

### 四、资源使用 

4.1 本项目内使用的部分包括但不限于字体、图片等资源来源于互联网。如果出现侵权可联系本项目移除。

### 五、免责声明 

5.1 由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。

### 六、使用限制 

6.1 CyMusic 官方 App **永久免费，仅限个人非商业使用，禁止用于商业用途**。自有源码在 GitHub 发布并按上述源码许可证授权；RNTP v5 等第三方组件依各自许可证授权。本项目不对项目内的技术可能存在违反当地法律法规的行为作保证。

6.2 **禁止在违反当地法律法规的情况下使用本项目。** 对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。

### 七、版权保护 

7.1 音乐平台不易，请尊重版权，支持正版。

### 八、非商业性质 

8.1 CyMusic 官方 App 仅供个人、非职业、非商业用途，不接受任何商业（包括但不限于广告等）合作及捐赠。

### 九、接受协议 

9.1 使用 CyMusic 官方 App 表示接受上述 App 使用说明；源码及第三方组件的使用权利与义务以其各自许可证为准。

---

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=gyc-12/Cymusic&type=Date)](https://www.star-history.com/#gyc-12/Cymusic&Date)
