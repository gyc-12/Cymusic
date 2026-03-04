/**
 * 管理当前歌曲的歌词
 */

import LyricParser from '@/utils/lrcParser'
import PersistStatus from '@/store/PersistStatus'

import { isSameMediaItem } from '@/utils/mediaItem'

import { GlobalState } from '@/utils/stateMapper'
import ReactNativeTrackPlayer, { Event } from 'react-native-track-player'
import myTrackPlayer, { nowLyricState } from './trackPlayerIndex'
const lyricStateStore = new GlobalState<{
	loading: boolean
	lyricParser?: LyricParser
	lyrics: ILyric.IParsedLrc
	translationLyrics?: ILyric.IParsedLrc
	meta?: Record<string, any>
	hasTranslation: boolean
}>({
	loading: true,
	lyrics: [],
	hasTranslation: false,
})

const currentLyricStore = new GlobalState<ILyric.IParsedLrcItem | null>(null)
export const durationStore = new GlobalState<number>(0)

const loadingState = {
	loading: true,
	lyrics: [],
	hasTranslation: false,
}

function setLyricLoading() {
	lyricStateStore.setValue(loadingState)
}
ReactNativeTrackPlayer.addEventListener(Event.PlaybackProgressUpdated, async (data) => {
	// console.log('progress changed:', data.position)
	// console.log('duration:', data.duration)
	durationStore.setValue(data.duration)
	refreshLyric()
})
// 重新获取歌词
async function refreshLyric(fromStart?: boolean, forceRequest = false) {
	const musicItem = myTrackPlayer.getCurrentMusic()
	try {
		if (!musicItem) {
			lyricStateStore.setValue({
				loading: false,
				lyrics: [],
				hasTranslation: false,
			})

			currentLyricStore.setValue({
				lrc: 'MusicFree',
				time: 0,
			})

			return
		}

		const currentParserMusicItem = lyricStateStore.getValue()?.lyricParser?.getCurrentMusicItem()
		const lyricDelaySeconds = PersistStatus.get('lyric.delaySeconds') ?? 0

		const lrcSource: ILyric.ILyricSource | null | undefined = {
			rawLrc: nowLyricState.getValue() || '[00:00.00]暂无歌词',
		}

		// console.log(lrcSource, 'lrcSource')
		// if (forceRequest || !isSameMediaItem(currentParserMusicItem, musicItem)) {
		// 	lyricStateStore.setValue(loadingState)
		// 	currentLyricStore.setValue(null)

		// 	// lrcSource = { ...lrcSource, rawLrc: nowLyricState.getValue() || '[00:00.00]暂无歌词' }
		// } else {
		// 	// lrcSource = { ...lrcSource, rawLrc: nowLyricState.getValue() || '[00:00.00]暂无歌词' }
		// }

		const realtimeMusicItem = myTrackPlayer.getCurrentMusic()
		// if (isSameMediaItem(musicItem, realtimeMusicItem)) {
		if (realtimeMusicItem) {
			if (lrcSource) {
				// const mediaExtra = MediaExtra.get(musicItem)
				const parser = new LyricParser(lrcSource, musicItem, {
					offset: lyricDelaySeconds,
				})

				lyricStateStore.setValue({
					loading: false,
					lyricParser: parser,
					lyrics: parser.getLyric(),
					translationLyrics: lrcSource.translation ? parser.getTranslationLyric() : undefined,
					meta: parser.getMeta(),
					hasTranslation: !!lrcSource.translation,
				})
				// 更新当前状态的歌词
				const currentLyric = fromStart
					? parser.getLyric()[0]
					: parser.getPosition((await myTrackPlayer.getProgress()).position).lrc
				currentLyricStore.setValue(currentLyric || null)
				// console.log(currentLyric, 'currentLyric')
			} else {
				// 没有歌词
				lyricStateStore.setValue({
					loading: false,
					lyrics: [],
					hasTranslation: false,
				})
			}
		}
	} catch (e) {
		console.log(e, 'LRC')
		const realtimeMusicItem = myTrackPlayer.getCurrentMusic()
		if (isSameMediaItem(musicItem, realtimeMusicItem)) {
			// 异常情况
			lyricStateStore.setValue({
				loading: false,
				lyrics: [],
				hasTranslation: false,
			})
		}
	}
}

// 获取歌词
async function setup() {
	// DeviceEventEmitter.addListener(EDeviceEvents.REFRESH_LYRIC, refreshLyric)

	refreshLyric()
}

const LyricManager = {
	setup,
	useLyricState: lyricStateStore.useValue,
	getLyricState: lyricStateStore.getValue,
	useCurrentLyric: currentLyricStore.useValue,
	getCurrentLyric: currentLyricStore.getValue,
	setCurrentLyric: currentLyricStore.setValue,
	refreshLyric,
	setLyricLoading,
}

export default LyricManager
