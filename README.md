# CyMusic

一个基于 React native 开发的音乐软件，仍在开发中，并不完善。支持开发可以点点star。

RN新手，代码质量一般，请见谅。

支持的平台：

- IOS
  软件下载请转到：[发布页面](https://github.com/gyc-12/music-player-master/releases)<br>

代码未内置源。可以导入自定义源，注意导入的音乐源的安全可靠性。仅供学习交流使用，请勿用于商业用途，如有侵权请联系删除。

自定义源示例参考：<https://github.com/gyc-12/CyMusic-ImportMusicApi-Example>

tg频道：<https://t.me/gyc_123>

## TODO

- [x] 播放本地音乐功能
- [x] 下载和缓存音乐功能
- [x] 歌曲加入指定歌单
- [x] feat：删除歌单内歌曲功能
- [x] feat：一些动画细节模仿AM
- [x] feat：查看专辑
- [x] feat: player页面多选项，分享功能
- [x] feat：在线链接导入音源功能
- [x] feat：增加日志系统
- [x] feat：歌词滑动、字体大小调整
- [x] feat：搜索结果翻页
- [ ] feat：网易云歌单
- [x] feat：歌单、下载歌曲导出功能
- [x] feat：多选功能
- [ ] feat：歌词不同步调整
- [x] feat：定时关闭
- [x] feat：歌词界面保持手机亮屏
- [ ] 修复：flac 格式音乐快进后歌词不同步问题
- [x] feat：carplay模拟器支持。
- [ ] （待添加更多任务）

## 技术栈

- React Native：跨平台移动应用开发框架
- Expo：简化 React Native 开发的工具和服务平台
- TypeScript：JavaScript 的超集，添加了静态类型检查
- React Native Track Player：用于音频播放的库
- Zustand：轻量级状态管理库
- React Navigation：页面导航库
- Expo Router：基于文件系统的路由解决方案
- AsyncStorage：本地数据存储库

## 基于

<https://github.com/CodeWithGionatha-Labs/music-player>

<https://github.com/lyswhut/lx-music-mobile>

<https://github.com/maotoumao/MusicFree>

# Screenshots

![alt text](readme.jpg)

# 开发

## Installation

```bash
yarn install
```

## Run IOS

```bash
npx expo run:ios
```

# 项目协议

本项目基于 Apache License 2.0 许可证发行，以下协议是对于 Apache License 2.0 的补充，如有冲突，以以下协议为准。

---

词语约定：本协议中的“本项目”指Music Player项目；“使用者”指签署本协议的使用者；“官方音乐平台”指对本项目内置的包括酷我、酷狗、咪咕等音乐源的官方平台统称；“版权数据”指包括但不限于图像、音频、名字等在内的他人拥有所属版权的数据。

#### 一、数据来源

1.1 本项目的各官方平台在线数据来源原理是从其公开服务器中拉取数据（与未登录状态在官方平台APP获取的数据相同），经过对数据简单地筛选与合并后进行展示，因此本项目不对数据的合法性、准确性负责。

1.2 本项目本身没有获取某个音频数据的能力，本项目使用的在线音频数据来源来自软件设置内“音乐来源”设置所选择的“源”返回的在线链接。例如播放某首歌，本项目所做的只是将希望播放的歌曲名字、歌手名字等信息传递给“源”，若“源”返回了一个链接，则本项目将认为这就是该歌曲的音频数据而进行使用，至于这是不是正确的音频数据本项目无法校验其准确性，所以使用本项目的过程中可能会出现希望播放的音频与实际播放的音频不对应或者无法播放的问题。

1.3 本项目的非官方平台数据（例如我的收藏列表）来自使用者本地系统或者使用者连接的同步服务，本项目不对这些数据的合法性、准确性负责。

#### 二、版权数据

2.1 使用本项目的过程中可能会产生版权数据。对于这些版权数据，本项目不拥有它们的所有权。为了避免侵权，使用者务必在**24小时内**清除使用本项目的过程中所产生的版权数据。

#### 三、音乐平台别名

3.1 本项目内的官方音乐平台别名为本项目内对官方音乐平台的一个称呼，不包含恶意。如果官方音乐平台觉得不妥，可联系本项目更改或移除。

#### 四、资源使用

4.1 本项目内使用的部分包括但不限于字体、图片等资源来源于互联网。如果出现侵权可联系本项目移除。

#### 五、免责声明

5.1 由于使用本项目产生的包括由于本协议或由于使用或无法使用本项目而引起的任何性质的任何直接、间接、特殊、偶然或结果性损害（包括但不限于因商誉损失、停工、计算机故障或故障引起的损害赔偿，或任何及所有其他商业损害或损失）由使用者负责。

#### 六、使用限制

6.1 本项目完全免费，且开源发布于 GitHub 面向全世界人用作对技术的学习交流。本项目不对项目内的技术可能存在违反当地法律法规的行为作保证。

6.2 **禁止在违反当地法律法规的情况下使用本项目。** 对于使用者在明知或不知当地法律法规不允许的情况下使用本项目所造成的任何违法违规行为由使用者承担，本项目不承担由此造成的任何直接、间接、特殊、偶然或结果性责任。

#### 七、版权保护

7.1 音乐平台不易，请尊重版权，支持正版。

#### 八、非商业性质

8.1 本项目仅用于对技术可行性的探索及研究，不接受任何商业（包括但不限于广告等）合作及捐赠。

#### 九、接受协议

9.1 若你使用了本项目，将代表你接受本协议。

---

## Star History

<a href="https://star-history.com/#gyc-12/music-player-master&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=gyc-12/music-player-master&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=gyc-12/music-player-master&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=gyc-12/music-player-master&type=Date" />
 </picture>
</a>
