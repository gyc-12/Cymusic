# 第三方许可

CyMusic 自有源码的根目录 [LICENSE](../LICENSE) 不替代第三方软件的许可证。
每项依赖保留其版权声明及授权条件。

## React Native Track Player v5

- 包名与固定版本：`@rntp/player@5.9.2`
- 版权所有：Double Symmetry GmbH
- 本地许可证：[rntp-player-5.9.2.txt](rntp-player-5.9.2.txt)，按 npm 发布包中的 `license.txt` 原样保留。
- 上游仓库：[doublesymmetry/react-native-track-player](https://github.com/doublesymmetry/react-native-track-player)
- 固定许可证来源：[上游 license.txt](https://github.com/doublesymmetry/react-native-track-player/blob/c5a6400a2defb13b6cdbd2f7d3b47dd9f5c42c56/license.txt)
- 发布包：[player-5.9.2.tgz](https://registry.npmjs.org/@rntp/player/-/player-5.9.2.tgz)
- 发布包 SHA-256：`8db99641430af01a2dc3e7e43d55e3a1e26045c0807a142e21ab1c20ce24624e`

RNTP v5 不由 CyMusic 的 Apache-2.0 许可证授权，也未被重新许可为 Apache-2.0。
它的非商业授权有明确范围；任何使用或分发都须遵守其完整许可证。CyMusic 的
免费发布不代表向其他人授予 RNTP 的商业使用、分发或再许可权利。

仓库中的 [RNTP 补丁](../patches/@rntp+player+5.9.2.patch) 修改 iOS 遥控事件通知，
用于避免迟到的音源请求覆盖暂停或停止操作；增加按歌曲保留的可选精确跳转策略，
用于改善部分 FLAC 快进后的音频时间偏差；并移除一条在 RN 0.86 类型中已失效的
TypeScript 错误抑制注释。它不修改或取代上述许可证；
其中涉及的 RNTP 代码仍属于该第三方组件。

集成该组件的 CyMusic 官方 App 永久免费，仅限个人、非职业、非商业使用，
禁止商业用途。此说明不改写上游许可证，也不撤销 CyMusic 自有源码已有的
Apache-2.0 授权。
