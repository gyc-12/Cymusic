declare namespace LX {
  namespace Music {
    interface MusicQualityType { // {"type": "128k", size: "3.56M"}
      type: LX.Quality
      size: string | null
    }
    interface MusicQualityTypeKg { // {"type": "128k", size: "3.56M"}
      type: LX.Quality
      size: string | null
      hash: string
    }
    type _MusicQualityType = Partial<Record<Quality, {
      size: string | null
    }>>
    type _MusicQualityTypeKg = Partial<Record<Quality, {
      size: string | null
      hash: string
    }>>


    interface MusicInfoMetaBase {
      songId: string | number // 歌曲ID，mg源为copyrightId，local为文件路径
      albumName: string // 歌曲专辑名称
      picUrl?: string | null // 歌曲图片链接
    }

    interface MusicInfoMeta_online extends MusicInfoMetaBase {
      qualitys: MusicQualityType[]
      _qualitys: _MusicQualityType
      albumId?: string | number // 歌曲专辑ID
    }

    interface MusicInfoMeta_local extends MusicInfoMetaBase {
      filePath: string
      ext: string
    }


    interface MusicInfoBase<S = LX.Source> {
      id: string
      name: string // 歌曲名
      singer: string // 艺术家名
      source: S // 源
      interval: string | null // 格式化后的歌曲时长，例：03:55
      meta: MusicInfoMetaBase
    }

    interface MusicInfoLocal extends MusicInfoBase<'local'> {
      meta: MusicInfoMeta_local
    }

    interface MusicInfo_online_common extends MusicInfoBase<'kw' | 'wy'> {
      meta: MusicInfoMeta_online
    }

    interface MusicInfoMeta_kg extends MusicInfoMeta_online {
      qualitys: MusicQualityTypeKg[]
      _qualitys: _MusicQualityTypeKg
      hash: string // 歌曲hash
    }
    interface MusicInfo_kg extends MusicInfoBase<'kg'> {
      meta: MusicInfoMeta_kg
    }

    interface MusicInfoMeta_tx extends MusicInfoMeta_online {
      strMediaMid: string // 歌曲strMediaMid
      id?: number // 歌曲songId
      albumMid?: string // 歌曲albumMid
    }
    interface MusicInfo_tx extends MusicInfoBase<'tx'> {
      meta: MusicInfoMeta_tx
    }

    interface MusicInfoMeta_mg extends MusicInfoMeta_online {
      copyrightId: string // 歌曲copyrightId
      lrcUrl?: string // 歌曲lrcUrl
      mrcUrl?: string // 歌曲mrcUrl
      trcUrl?: string // 歌曲trcUrl
    }
    interface MusicInfo_mg extends MusicInfoBase<'mg'> {
      meta: MusicInfoMeta_mg
    }

    type MusicInfoOnline = MusicInfo_online_common | MusicInfo_kg | MusicInfo_tx | MusicInfo_mg
    type MusicInfo = MusicInfoOnline | MusicInfoLocal

    interface LyricInfo {
      // 歌曲歌词
      lyric: string
      // 翻译歌词
      tlyric?: string | null
      // 罗马音歌词
      rlyric?: string | null
      // 逐字歌词
      lxlyric?: string | null
    }

    interface LyricInfoSave {
      id: string
      lyrics: LyricInfo
    }

    interface MusicUrlInfo {
      id: string
      url: string
    }

    interface MusicInfoOtherSourceSave {
      id: string
      list: MusicInfoOnline[]
    }

  }
}
declare namespace IMusic {
    export interface IMusicItemBase extends ICommon.IMediaBase {
        /** 其他属性 */
        [k: keyof IMusicItem]: IMusicItem[k];
    }

    /** 音质 */
    export type IQualityKey = '128k'|'320k' | 'flac'  ;
    export type IQuality = Record<
        IQualityKey,
        {
            url?: string;
            size?: string | number;
        }
    >;

    // 音源定义
    export interface IMediaSource {
        headers?: Record<string, string>;
        /** 兜底播放 */
        url?: string;
        /** UA */
        userAgent?: string;
        /** 音质 */
        quality?: IMusic.IQualityKey;
        /** 大小 */
        size?: number;
    }

    export interface IMusicItem {
        /** 歌曲在平台的唯一编号 */
        id: string;
        /** 平台 */
        platform: string;
        /** 作者 */
        artist: string;
        /** 标题 */
        title: string;
        /** 别名 */
        alias?: string;
        /** 时长(s) */
        duration: number;
        /** 专辑名 */
        album: string;
        /** 专辑封面图 */
        artwork: string;
        /** 默认音源 */
        url?: string;
        /** 音源 */
        source?: Partial<Record<IQualityKey, IMediaSource>>;
        /** 歌词 */
        lyric?: ILyric.ILyricSource;
        /** @deprecated 歌词URL */
        lrc?: string;
        /** @deprecated 歌词（原始文本 有时间戳） */
        rawLrc?: string;
        /** 音质信息 */
        qualities?: IQuality;
        /** 其他可以被序列化的信息 */
        [k: string]: any;
        /** 内部信息 */
        [k: symbol]: any;
    }
 export interface PlayList {
        /** 歌单在平台的唯一编号 */
        id: string;
        /** 平台 */
        platform: string;
        /** 作者 */
        artist: string;
        /** 标题 */
        title: string;
        /** 歌单名 */
        name: string;
        /** 歌单封面图 */
        artwork: string;
        /** 音源 */
        source?: Partial<Record<IQualityKey, IMediaSource>>;

        songs: IMusicItem[];
        /** 其他可以被序列化的信息 */
        [k: string]: any;
        /** 内部信息 */
        [k: symbol]: any;
    }
     export interface MusicApi {
        /** 音源编号 */
        id: string;
        /** 作者 */
        author: string;
        /** 音源名称 */
        name: string;
        /** 版本 */
        version: string;
        /** 更新地址 */
        srcUrl: string;
       /** 脚本内容 */
        script: string;
        /** 脚本类型: cymusic 原有格式 / lxmusic lx-music 格式 */
        scriptType?: 'cymusic' | 'lxmusic';
        /** 音源方法 */
        getMusicUrl: any;
        /** 其他可以被序列化的信息 */
        [k: string]: any;
        /** 内部信息 */
        [k: symbol]: any;
    }
    export interface IMusicItemCache extends IMusicItem {
        $localLyric?: ILyric.ILyricSource;
    }
}
