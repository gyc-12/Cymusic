import { logError, logInfo } from '@/helpers/logger'
import { qualityStore } from './PlayerStore'
import * as FileSystem from 'expo-file-system'
import RNFS from 'react-native-fs'

const cacheDir = FileSystem.documentDirectory + 'musicCache/'

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
	return `${cacheDir}${musicItem.title}-${musicItem.artist}.${format}`
}

export const isCached = async (musicItem: IMusic.IMusicItem): Promise<boolean> => {
	const filePath = getLocalFilePath(musicItem)
	const fileInfo = await FileSystem.getInfoAsync(filePath)
	return fileInfo.exists
}

export const downloadToCache = async (musicItem: IMusic.IMusicItem): Promise<string> => {
	try {
		await ensureCacheDirExists()
		const localPath = getLocalFilePath(musicItem)
		const downloadResult = await RNFS.downloadFile({
			fromUrl: musicItem.url,
			toFile: localPath,
			progressDivider: 1,
			progress: (res) => {
				const progress = res.bytesWritten / res.contentLength
				logInfo(`下载进度: ${(progress * 100).toFixed(2)}%`)
			},
		}).promise

		if (downloadResult.statusCode === 200) {
			logInfo('音频文件已缓存到本地:', localPath)
			return localPath
		} else {
			throw new Error(`下载失败，状态码: ${downloadResult.statusCode}`)
		}
	} catch (error) {
		logError('下载音频文件时出错:', error)
		throw error
	}
}

export const clearCache = async () => {
	const { importedLocalMusicStore } = require('./PlayerStore')
	const PersistStatus = require('@/store/PersistStatus').default
	const dirInfo = await FileSystem.getInfoAsync(cacheDir)
	if (dirInfo.exists) {
		await FileSystem.deleteAsync(cacheDir, { idempotent: true })
		const importedLocalMusic = importedLocalMusicStore.getValue() || []
		const updatedImportedLocalMusic = importedLocalMusic.filter((item: IMusic.IMusicItem) => {
			return !item.url.startsWith(cacheDir)
		})
		importedLocalMusicStore.setValue(updatedImportedLocalMusic)
		PersistStatus.set('music.importedLocalMusic', updatedImportedLocalMusic)
		logInfo('缓存已清理')
	} else {
		logInfo('缓存目录不存在，无需清理')
	}
}

export { cacheDir }
