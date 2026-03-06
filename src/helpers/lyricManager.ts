/**
 * 管理当前歌曲的歌词
 */

import PersistStatus from '@/store/PersistStatus'
import { isSameMediaItem } from '@/utils/mediaItem'
import { GlobalState } from '@/utils/stateMapper'
import LyricParser from '@/utils/lrcParser'
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
const DEFAULT_LYRIC = '[00:00.00]暂无歌词'
let lastRawLyric = ''
let lastLyricDelaySeconds: number | null = null

const loadingState = {
	loading: true,
	lyrics: [],
	hasTranslation: false,
}

function setLyricLoading() {
	lyricStateStore.setValue(loadingState)
}
function resetLyricState() {
	lyricStateStore.setValue({
		loading: false,
		lyrics: [],
		hasTranslation: false,
	})
	currentLyricStore.setValue({
		lrc: 'MusicFree',
		time: 0,
	})
	lastRawLyric = ''
	lastLyricDelaySeconds = null
}

function getLyricSource(): ILyric.ILyricSource {
	return {
		rawLrc: nowLyricState.getValue() || DEFAULT_LYRIC,
	}
}

function updateCurrentLyricByPosition(position: number, parser?: LyricParser) {
	const activeParser = parser ?? lyricStateStore.getValue().lyricParser
	if (!activeParser) {
		currentLyricStore.setValue(null)
		return
	}
	const currentLyric = activeParser.getPosition(position).lrc
	currentLyricStore.setValue(currentLyric || null)
}

function shouldRebuildParser(
	musicItem: IMusic.IMusicItem,
	lyricParser: LyricParser | undefined,
	rawLrc: string,
	lyricDelaySeconds: number,
	forceRequest: boolean,
) {
	if (forceRequest || !lyricParser) {
		return true
	}

	return (
		!isSameMediaItem(lyricParser.getCurrentMusicItem(), musicItem) ||
		lastRawLyric !== rawLrc ||
		lastLyricDelaySeconds !== lyricDelaySeconds
	)
}

// 重新获取歌词
async function refreshLyric(fromStart?: boolean, forceRequest = false, positionOverride?: number) {
	const musicItem = myTrackPlayer.getCurrentMusic()
	try {
		if (!musicItem) {
			resetLyricState()
			return
		}

		const lyricDelaySeconds = PersistStatus.get('lyric.delaySeconds') ?? 0
		const lrcSource = getLyricSource()
		const rawLrc = lrcSource.rawLrc || DEFAULT_LYRIC
		const lyricParser = lyricStateStore.getValue().lyricParser

		if (!shouldRebuildParser(musicItem, lyricParser, rawLrc, lyricDelaySeconds, forceRequest)) {
			if (fromStart) {
				currentLyricStore.setValue(lyricParser?.getLyric()[0] || null)
				return
			}
			if (positionOverride !== undefined) {
				updateCurrentLyricByPosition(positionOverride, lyricParser)
				return
			}
			const progress = await myTrackPlayer.getProgress()
			updateCurrentLyricByPosition(progress.position, lyricParser)
			return
		}

		const realtimeMusicItem = myTrackPlayer.getCurrentMusic()
		if (!realtimeMusicItem || !isSameMediaItem(musicItem, realtimeMusicItem)) {
			return
		}

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
		lastRawLyric = rawLrc
		lastLyricDelaySeconds = lyricDelaySeconds

		if (fromStart) {
			currentLyricStore.setValue(parser.getLyric()[0] || null)
			return
		}
		if (positionOverride !== undefined) {
			updateCurrentLyricByPosition(positionOverride, parser)
			return
		}

		const progress = await myTrackPlayer.getProgress()
		updateCurrentLyricByPosition(progress.position, parser)
	} catch (e) {
		console.log(e, 'LRC')
		const realtimeMusicItem = myTrackPlayer.getCurrentMusic()
		if (musicItem && isSameMediaItem(musicItem, realtimeMusicItem)) {
			lyricStateStore.setValue({
				loading: false,
				lyrics: [],
				hasTranslation: false,
			})
		}
	}
}

ReactNativeTrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (data) => {
	durationStore.setValue(data.duration)

	const musicItem = myTrackPlayer.getCurrentMusic()
	if (!musicItem) {
		return
	}

	const lyricParser = lyricStateStore.getValue().lyricParser
	const rawLrc = nowLyricState.getValue() || DEFAULT_LYRIC
	const lyricDelaySeconds = PersistStatus.get('lyric.delaySeconds') ?? 0
	const parserReady =
		!!lyricParser &&
		isSameMediaItem(lyricParser.getCurrentMusicItem(), musicItem) &&
		lastRawLyric === rawLrc &&
		lastLyricDelaySeconds === lyricDelaySeconds

	if (parserReady) {
		updateCurrentLyricByPosition(data.position, lyricParser)
		return
	}

	refreshLyric(false, true, data.position).catch((e) => {
		console.log(e, 'LRC_PROGRESS')
	})
})

ReactNativeTrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => {
	refreshLyric(true, true, 0).catch((e) => {
		console.log(e, 'LRC_ACTIVE_TRACK')
	})
})

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
