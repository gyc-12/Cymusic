# 开发指南

[返回 README](../README.md#开发指南)

使用 macOS、Xcode 26.4 及以上和 Node 22.13 及以上的受支持 LTS 版本。
本次本机构建使用 Xcode 26.6、Node 24.19.0、Yarn 1.22.22、CocoaPods 1.16.2；
CI 配置也固定为这组版本。最低运行系统为 iOS 16.4。

## 安装依赖

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

## 运行 iOS 版本

```bash
npx expo run:ios --no-install
```

自定义原生模块需要开发构建，不能直接在 Expo Go 中运行。切换 Node 安装路径后，
检查被忽略的 `ios/.xcode.env.local` 是否仍指向有效的 Node 可执行文件。

## 本地 Pods 配置恢复

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

## 构建未签名 iOS 应用

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

## 专项回归与当前状态

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
[RNTP v5 集成记录](maintenance/2026-09-10-rntp-v5.md)。
此前框架和自有模块的版本、构建结果及历史静态检查问题见
[升级优化结果与验证范围](maintenance/2026-09-10-results.md)，任务顺序见
[执行计划](maintenance/2026-09-10-plan.md)，全部 Git 追踪路径见
[项目文件状态](maintenance/2026-09-10-files.md)。
