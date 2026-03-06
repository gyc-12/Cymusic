import { MusicRepeatMode } from '@/helpers/types'
import { GlobalState } from '@/utils/stateMapper'

/** 当前播放 */
export const currentMusicStore = new GlobalState<IMusic.IMusicItem | null>(null)
/** 歌单 */
export const playListsStore = new GlobalState<IMusic.PlayList[] | []>(null)
/** 播放模式 */
export const repeatModeStore = new GlobalState<MusicRepeatMode>(MusicRepeatMode.QUEUE)
/** 音质 */
export const qualityStore = new GlobalState<IMusic.IQualityKey>('128k')
/** 音源 */
export const musicApiStore = new GlobalState<IMusic.MusicApi[] | []>(null)
/** 当前音源 */
export const musicApiSelectedStore = new GlobalState<IMusic.MusicApi>(null)
/** 音源状态 */
export const nowApiState = new GlobalState<string>('正常')
/** 是否自动缓存本地 */
export const autoCacheLocalStore = new GlobalState<boolean>(true)
/** 是否显示已缓存图标 */
export const isCachedIconVisibleStore = new GlobalState<boolean>(true)
/** 首页加载歌曲数量 */
export const songsNumsToLoadStore = new GlobalState<number>(100)
/** 已导入的本地音乐 */
export const importedLocalMusicStore = new GlobalState<IMusic.IMusicItem[] | []>(null)
/** 当前歌词 */
export const nowLyricState = new GlobalState<string>(null)
