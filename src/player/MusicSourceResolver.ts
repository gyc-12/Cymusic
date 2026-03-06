import { fakeAudioMp3Uri } from '@/constants/images'
import { logError, logInfo } from '@/helpers/logger'
import PersistStatus from '@/store/PersistStatus'
import { showToast } from '@/utils/utils'
import RNFS from 'react-native-fs'
import { isCached, getLocalFilePath } from './CacheManager'
import { musicApiSelectedStore, nowApiState, qualityStore } from './PlayerStore'

export type SourceResult = {
	url: string
	wasCached: boolean
}

export type ResolveSourceRequestType = 'current' | 'preload'

type ResolveSourceOptions = {
	requestType?: ResolveSourceRequestType
}

type MusicUrlRequestContext = {
	requestKey: string
	requestType: ResolveSourceRequestType
	timeoutMs: number
}

const preloadCache = new Map<string, string>()
const CURRENT_SOURCE_REQUEST_TIMEOUT_MS = 5000
const PRELOAD_SOURCE_REQUEST_TIMEOUT_MS = 12000

const isCurrentSourceRequest = (requestType: ResolveSourceRequestType) =>
	requestType === 'current'

const getSourceRequestTimeoutMs = (requestType: ResolveSourceRequestType) =>
	isCurrentSourceRequest(requestType)
		? CURRENT_SOURCE_REQUEST_TIMEOUT_MS
		: PRELOAD_SOURCE_REQUEST_TIMEOUT_MS

const getMusicItemSourceKey = (item: IMusic.IMusicItem) =>
	String(item.platform || item.source || 'unknown').replace(/\s+/g, '_')

const createTimeoutPromise = (timeoutMs: number) =>
	new Promise<never>((_, reject) => {
		setTimeout(() => reject(new Error('请求超时')), timeoutMs)
	})

const createSourceRequestKey = (
	item: IMusic.IMusicItem,
	requestType: ResolveSourceRequestType,
) =>
	`source_${requestType}_${getMusicItemSourceKey(item)}_${item.id}_${Date.now().toString(36)}_${Math.random()
		.toString(36)
		.slice(2, 8)}`

const getSourceRequestLogPrefix = (
	requestType: ResolveSourceRequestType,
	requestKey: string,
) => `[sourceResolver][${requestType}][requestKey=${requestKey}]`

function makePreloadKey(item: IMusic.IMusicItem): string {
	return `${getMusicItemSourceKey(item)}://${item.id}`
}

export const getPreloadedUrl = (item: IMusic.IMusicItem): string | undefined => {
	return preloadCache.get(makePreloadKey(item))
}

export const preloadSource = async (item: IMusic.IMusicItem): Promise<void> => {
	const key = makePreloadKey(item)
	if (preloadCache.has(key)) return
	try {
		const result = await resolveSource(item, { requestType: 'preload' })
		if (result.url && !result.url.includes('fake')) {
			preloadCache.set(key, result.url)
			if (preloadCache.size > 10) {
				const firstKey = preloadCache.keys().next().value
				if (firstKey) preloadCache.delete(firstKey)
			}
		}
	} catch {
		// preload failures are silent
	}
}

const setQuality = (quality: IMusic.IQualityKey) => {
	qualityStore.setValue(quality)
	PersistStatus.set('music.quality', quality)
}

export const resolveSource = async (
	musicItem: IMusic.IMusicItem,
	options: ResolveSourceOptions = {},
): Promise<SourceResult> => {
	const preloadKey = makePreloadKey(musicItem)
	const requestType = options.requestType ?? 'current'

	if (musicItem.url && musicItem.url.startsWith('file://')) {
		const isFileExist = await RNFS.exists(musicItem.url)
		if (!isFileExist) {
			if (isCurrentSourceRequest(requestType)) {
				logError('本地文件不存在:', musicItem.url)
				showToast('错误', '本地文件不存在，请删除并重新缓存或导入。', 'error')
			}
			return { url: fakeAudioMp3Uri, wasCached: false }
		}
		preloadCache.delete(preloadKey)
		return { url: musicItem.url, wasCached: false }
	}

	const cached = await isCached(musicItem)
	if (cached) {
		const localPath = getLocalFilePath(musicItem)
		preloadCache.delete(preloadKey)
		logInfo('使用缓存的音频路径播放:', localPath)
		return { url: localPath, wasCached: true }
	}

	// 只在本地与磁盘缓存都未命中时，才复用预加载的远端音源
	const preloaded = getPreloadedUrl(musicItem)
	if (preloaded) {
		logInfo(`[sourceResolver][${requestType}] 使用预加载的音源:`, preloaded)
		preloadCache.delete(preloadKey)
		return { url: preloaded, wasCached: false }
	}

	if (!musicItem.url || musicItem.url === 'Unknown' || musicItem.url.includes('fake')) {
		const nowMusicApi = musicApiSelectedStore.getValue()
		if (nowMusicApi == null) {
			if (isCurrentSourceRequest(requestType)) {
				showToast('错误', '获取音乐失败，请先导入音源。', 'error')
			}
			return { url: fakeAudioMp3Uri, wasCached: false }
		}

		const requestKey = createSourceRequestKey(musicItem, requestType)
		const logPrefix = getSourceRequestLogPrefix(requestType, requestKey)
		const timeoutMs = getSourceRequestTimeoutMs(requestType)

		try {
			const qualityOrder: IMusic.IQualityKey[] = ['flac', '320k', '128k']
			let currentQualityIndex = qualityOrder.indexOf(qualityStore.getValue())
			let resp_url: string | null = null

			logInfo(`${logPrefix} 开始请求音源: ${musicItem.title} - ${musicItem.artist}`)

			while (currentQualityIndex < qualityOrder.length && !resp_url) {
				const currentQuality = qualityOrder[currentQualityIndex]
				try {
					resp_url = await Promise.race([
						nowMusicApi.getMusicUrl(
							musicItem.title,
							musicItem.artist,
							musicItem.id,
							currentQuality,
							{ requestKey, requestType, timeoutMs } as MusicUrlRequestContext,
						),
						createTimeoutPromise(timeoutMs),
					])
					if (!resp_url || resp_url === '') {
						if (isCurrentSourceRequest(requestType)) {
							logInfo(
								`${logPrefix} ${currentQuality}音质无可用链接，尝试下一个音质`,
							)
						}
						currentQualityIndex++
						resp_url = null
						continue
					}
					if (
						isCurrentSourceRequest(requestType) &&
						currentQuality !== qualityStore.getValue()
					) {
						showToast('提示', `已自动切换至${currentQuality}音质`, 'info')
						setQuality(currentQuality)
					}
					logInfo(`${logPrefix} 成功获取${currentQuality}音质的音乐URL:`, resp_url)
				} catch (error) {
					if (isCurrentSourceRequest(requestType)) {
						logInfo(`${logPrefix} ${currentQuality}音质无可用链接(catch),尝试下一个音质`)
					}
					const errMsg = error instanceof Error ? error.message : String(error)
					if (isCurrentSourceRequest(requestType)) {
						logError(`${logPrefix} (catch error): ${errMsg}`)
					}
					currentQualityIndex++
				}
			}

			if (!resp_url) {
				if (isCurrentSourceRequest(requestType)) {
					nowApiState.setValue('异常')
					throw new Error('无法获取任何音质的音乐，请稍后重试。')
				}
				return { url: fakeAudioMp3Uri, wasCached: false }
			}
			logInfo(`${logPrefix} 最终的音乐 URL:`, resp_url)
			if (isCurrentSourceRequest(requestType)) {
				nowApiState.setValue('正常')
			}
			return { url: resp_url, wasCached: false }
		} catch (error) {
			if (isCurrentSourceRequest(requestType)) {
				nowApiState.setValue('异常')
			}
			const errMsg = error instanceof Error ? error.message : String(error)
			if (isCurrentSourceRequest(requestType)) {
				logError(`${logPrefix} 获取音乐 URL 失败: ${errMsg}`)
				const errorMessage =
					errMsg === '请求超时'
						? '获取音乐超时，请稍后重试。'
						: errMsg || '获取音乐失败，请稍后重试。'
				showToast(errorMessage, '', 'error')
			}
			return { url: fakeAudioMp3Uri, wasCached: false }
		}
	}

	return { url: musicItem.url, wasCached: false }
}
