import { File, Paths } from 'expo-file-system'
import { createDownloadResumable, FileSystemSessionType } from 'expo-file-system/legacy'
import { logError } from './logger'

type DownloadProgress = { bytesWritten: number; contentLength: number }
let nextDownloadId = 0

/** Download into an isolated file and commit only an actual HTTP 200 response. */
export async function downloadFile(
	url: string,
	destinationUri: string,
	onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
	// Keep this string: File.move changes the source File object's URI to the destination.
	const temporaryUri = new File(
		Paths.cache,
		`cymusic-download-${Date.now()}-${++nextDownloadId}-${Math.random().toString(36).slice(2)}.tmp`,
	).uri
	const task = createDownloadResumable(
		url,
		temporaryUri,
		{ sessionType: FileSystemSessionType.FOREGROUND },
		({ totalBytesWritten, totalBytesExpectedToWrite }) => {
			if (totalBytesExpectedToWrite > 0) {
				onProgress?.({ bytesWritten: totalBytesWritten, contentLength: totalBytesExpectedToWrite })
			}
		},
	)
	try {
		const result = await task.downloadAsync()
		if (!result) throw new Error('下载已取消或未返回结果')
		if (result.status !== 200) throw new Error(`下载失败，状态码: ${result.status}`)
		await new File(temporaryUri).move(new File(destinationUri), { overwrite: true })
	} finally {
		// downloadAsync leaves its progress subscription installed, including after success.
		try {
			await task.cancelAsync()
		} catch (error) {
			logError('清理下载任务时出错:', error)
		}
		try {
			if (Paths.info(temporaryUri).exists) new File(temporaryUri).delete()
		} catch (error) {
			logError('清理下载临时文件时出错:', error)
		}
	}
}
