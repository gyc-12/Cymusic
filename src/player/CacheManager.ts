import { logError, logInfo } from '@/helpers/logger'
import { importedLocalMusicStore, qualityStore } from './PlayerStore'
import PersistStatus from '@/store/PersistStatus'
import * as FileSystem from 'expo-file-system/legacy'
import { downloadFile } from '@/helpers/fileDownload'
import { fileUriFromPath } from '@/helpers/localFile'
import FileSystemNative from '../../modules/cymusic-native'

const cacheDir = FileSystem.documentDirectory + 'musicCache/'
const cacheDirectoryPath = `${FileSystemNative.documentDirectoryPath}/musicCache`

function sanitizeFilename(str: string): string {
	return str.replace(/[/\\?%*:|"<>]/g, '-')
}

export const ensureCacheDirExists = async () => {
	const dirInfo = await FileSystem.getInfoAsync(cacheDir)
	if (!dirInfo.exists) {
		await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true })
	}
}

export const ensureDirExists = async (dirPath: string) => {
	const dirInfo = await FileSystem.getInfoAsync(dirPath)
	if (!dirInfo.exists) {
		await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true })
	}
}

export const getLocalFilePath = (musicItem: IMusic.IMusicItem): string => {
	const format = qualityStore.getValue() === 'flac' ? 'flac' : 'mp3'
	const safeTitle = sanitizeFilename(musicItem.title)
	const safeArtist = sanitizeFilename(musicItem.artist)
	const platformId = musicItem.platform && musicItem.id
		? `${musicItem.platform}_${musicItem.id}`
		: `${safeTitle}-${safeArtist}`
	return `${cacheDir}${platformId}.${format}`
}

// Only accepts paths produced by getLocalFilePath. The filename is raw text,
// while cacheDir is an Expo URI; decoding the whole string would change %/# names.
export const getCacheFileUri = (localPath: string): string =>
	fileUriFromPath(`${cacheDirectoryPath}/${localPath.slice(cacheDir.length)}`)

export const isCached = async (musicItem: IMusic.IMusicItem): Promise<boolean> => {
	const filePath = getLocalFilePath(musicItem)
	const fileInfo = await FileSystem.getInfoAsync(getCacheFileUri(filePath))
	return fileInfo.exists
}

export const downloadToCache = async (musicItem: IMusic.IMusicItem): Promise<string> => {
	try {
		await ensureCacheDirExists()
		const localPath = getLocalFilePath(musicItem)
		await downloadFile(musicItem.url, getCacheFileUri(localPath), (res) => {
			const progress = res.bytesWritten / res.contentLength
			logInfo(`下载进度: ${(progress * 100).toFixed(2)}%`)
		})
		logInfo('音频文件已缓存到本地:', localPath)
		return localPath
	} catch (error) {
		logError('下载音频文件时出错:', error)
		throw error
	}
}

export const clearCache = async () => {
	const dirInfo = await FileSystem.getInfoAsync(cacheDir)
	if (dirInfo.exists) {
		await FileSystem.deleteAsync(cacheDir, { idempotent: true })
		const importedLocalMusic = importedLocalMusicStore.getValue() || []
		const updatedImportedLocalMusic = importedLocalMusic.filter((item: IMusic.IMusicItem) => {
			const url = item.url || ''
			const normalizedUrl = url.replace(/^file:\/\//, '')
			return !normalizedUrl.startsWith(cacheDir)
		})
		importedLocalMusicStore.setValue(updatedImportedLocalMusic)
		PersistStatus.set('music.importedLocalMusic', updatedImportedLocalMusic)
		logInfo('缓存已清理')
	} else {
		logInfo('缓存目录不存在，无需清理')
	}
}

export { cacheDir }
