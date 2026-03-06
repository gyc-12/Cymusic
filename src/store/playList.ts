
import {GlobalState} from '@/utils/stateMapper';
import PersistStatus from '@/store/PersistStatus'

/** 音乐队列 */
const playListStore = new GlobalState<IMusic.IMusicItem[]>([]);

/** 下标映射 - 使用 Map 提升查找性能 */
let playListIndexMap: Map<string, number> = new Map();
let indexMapDirty = true;

function makeKey(platform: string, id: string): string {
    return `${platform}://${id}`;
}

function ensureIndexMap() {
    if (!indexMapDirty) return;
    const list = playListStore.getValue();
    const newMap = new Map<string, number>();
    for (let i = 0; i < list.length; i++) {
        newMap.set(makeKey(list[i].platform, list[i].id), i);
    }
    playListIndexMap = newMap;
    indexMapDirty = false;
}

/**
 * 设置播放队列
 * @param newPlayList 新的播放队列
 * @param shouldSave 是否持久化
 * @param lazy 为 true 时延迟索引构建到首次查询时
 */
export function setPlayList(
    newPlayList: IMusic.IMusicItem[],
    shouldSave = true,
    lazy = false,
) {
    playListStore.setValue(newPlayList);
    if (lazy) {
        indexMapDirty = true;
    } else {
        const newMap = new Map<string, number>();
        for (let i = 0; i < newPlayList.length; i++) {
            newMap.set(makeKey(newPlayList[i].platform, newPlayList[i].id), i);
        }
        playListIndexMap = newMap;
        indexMapDirty = false;
    }
    if (shouldSave) {
        PersistStatus.set('music.play-list', newPlayList);
    }
}

/**
 * 获取当前的播放队列
 */
export const getPlayList = playListStore.getValue;

/**
 * hook
 */
export const usePlayList = playListStore.useValue;

/**
 * 寻找歌曲在播放列表中的下标
 * @param musicItem 音乐
 * @returns 下标
 */
export function getMusicIndex(musicItem?: IMusic.IMusicItem | null) {
    if (!musicItem) {
        return -1;
    }
    ensureIndexMap();
    return playListIndexMap.get(makeKey(musicItem.platform, musicItem.id)) ?? -1;
}

/**
 * 歌曲是否在播放队列中
 * @param musicItem 音乐
 * @returns 是否在播放队列中
 */
export function isInPlayList(musicItem?: IMusic.IMusicItem | null) {
    if (!musicItem) {
        return false;
    }
    ensureIndexMap();
    const idx = playListIndexMap.get(makeKey(musicItem.platform, musicItem.id));
    return idx !== undefined && idx > -1;
}

/**
 * 获取第i个位置的歌曲
 * @param index 下标
 */
export function getPlayListMusicAt(index: number): IMusic.IMusicItem | null {
    const playList = playListStore.getValue();

    const len = playList.length;
    if (len === 0) {
        return null;
    }

    return playList[(index + len) % len];
}

/**
 * 播放队列是否为空
 * @returns
 */
export function isPlayListEmpty() {
    return playListStore.getValue().length === 0;
}
