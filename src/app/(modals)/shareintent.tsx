import { ThemeColors } from '@/constants/tokens'
import { useThemeColors } from '@/hooks/useAppTheme'
import { logError, logInfo } from '@/helpers/logger'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import {
	createMusicApiFromScript,
	fetchScriptFromUrl,
	looksLikeScriptText,
} from '@/helpers/userApi/importMusicSource'
import * as FileSystem from 'expo-file-system'
import { router } from 'expo-router'
import { useShareIntentContext } from 'expo-share-intent'
import React, { useMemo, useState } from 'react'
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const ShareIntent = () => {
	const colors = useThemeColors()
	const styles = useMemo(() => createStyles(colors), [colors])
	const { hasShareIntent, shareIntent, error, resetShareIntent } = useShareIntentContext()
	const [importing, setImporting] = useState(false)

	const sharedFile = shareIntent?.files?.[0] ?? null
	const sharedType = shareIntent?.type ?? 'null'
	const sharedFilesCount = shareIntent?.files?.length ?? 0
	const sharedText = shareIntent?.text?.trim?.() ?? ''
	const hasScriptText = looksLikeScriptText(sharedText)
	const sharedUrl = shareIntent?.webUrl?.trim?.() ?? ''
	const fallbackUrl = !hasScriptText && /^https?:\/\//i.test(sharedText) ? sharedText : ''
	const sourceUrl = hasScriptText ? '' : sharedUrl || fallbackUrl
	const canImport = !!sharedFile?.path || !!sourceUrl || !!sharedText

	const sourceLabel = useMemo(() => {
		if (sharedFile?.fileName) return sharedFile.fileName
		if (hasScriptText) return '脚本文本'
		if (sourceUrl) return sourceUrl
		if (sharedText) return '分享文本'
		return '无可用来源'
	}, [hasScriptText, sharedFile?.fileName, sourceUrl, sharedText])

	const sourceInfo = useMemo(() => {
		if (sharedFile?.path && sharedFile?.size) {
			return `大小: ${(sharedFile.size / 1024).toFixed(1)} KB`
		}
		if (sharedFile?.path) {
			return '来源: 文件'
		}
		if (hasScriptText) {
			return '来源: 脚本文本'
		}
		if (sourceUrl) {
			return '来源: URL'
		}
		if (sharedText) {
			return '来源: 文本脚本'
		}
		return '请分享 .js 文件、脚本链接或脚本文本'
	}, [hasScriptText, sharedFile?.path, sharedFile?.size, sourceUrl, sharedText])

	logInfo('shareIntent', shareIntent)
	logInfo('hasShareIntent', hasShareIntent)
	logInfo('error', error)
	logInfo('shareIntent.type', sharedType)
	logInfo('shareIntent.filesCount', sharedFilesCount)
	logInfo('shareIntent.textLength', sharedText.length)
	logInfo('shareIntent.webUrl', sharedUrl)
	logInfo('shareIntent.hasScriptText', hasScriptText)

	const resolveScriptText = async () => {
		if (sharedFile?.path) {
			return FileSystem.readAsStringAsync(sharedFile.path)
		}
		if (hasScriptText) {
			return sharedText
		}
		if (sourceUrl) {
			return fetchScriptFromUrl(sourceUrl)
		}
		if (sharedText) {
			return sharedText
		}
		throw new Error('未识别到可导入的 JS 音源脚本')
	}

	const handleFinish = () => {
		resetShareIntent()
		router.replace('/')
	}

	const handleImport = async () => {
		if (!canImport || importing) return

		setImporting(true)
		try {
			// 1) 优先把分享文本当脚本尝试导入，避免“脚本里带 URL”被误判成网页链接
			if (!sharedFile?.path && sharedText) {
				try {
					const musicApi = await createMusicApiFromScript(sharedText)
					myTrackPlayer.addMusicApi(musicApi)
					Alert.alert('导入成功', '音源脚本已成功导入', [{ text: '确定', onPress: handleFinish }])
					return
				} catch (err) {
					logInfo(
						'shared text is not a direct script, fallback to url/file import',
						err instanceof Error ? err.message : String(err),
					)
				}
			}

			// 2) 文件/URL 路径继续按原逻辑导入
			const scriptText = await resolveScriptText()
			const musicApi = await createMusicApiFromScript(scriptText)
			myTrackPlayer.addMusicApi(musicApi)
			Alert.alert('导入成功', '音源脚本已成功导入', [{ text: '确定', onPress: handleFinish }])
		} catch (err) {
			const errMsg = err instanceof Error ? err.message : String(err)
			logError('分享导入音源失败:', errMsg)
			Alert.alert('导入失败', `无法导入音源脚本: ${errMsg}`, [
				{ text: '确定', onPress: handleFinish },
			])
		} finally {
			setImporting(false)
		}
	}

	if (!canImport) {
		return (
			<SafeAreaView style={styles.container}>
				<View style={styles.card}>
					<Text style={styles.title}>导入音源</Text>
					<Text style={styles.message}>没有可导入的 JS 音源脚本</Text>
					<Text style={styles.fileInfo}>{sourceInfo}</Text>
					<Text style={styles.debugText}>
						{`type=${sharedType} files=${sharedFilesCount} textLen=${sharedText.length} url=${sharedUrl ? 1 : 0} script=${hasScriptText ? 1 : 0}`}
					</Text>
					<TouchableOpacity style={[styles.importButton, styles.cancelButton]} onPress={handleFinish}>
						<Text style={[styles.importButtonText, styles.cancelButtonText]}>返回</Text>
					</TouchableOpacity>
				</View>
			</SafeAreaView>
		)
	}

	return (
		<SafeAreaView style={styles.container}>
			<View style={styles.card}>
				<Text style={styles.title}>导入音源</Text>
				<Text style={styles.fileName} numberOfLines={2}>
					{sourceLabel}
				</Text>
				<Text style={styles.fileInfo}>{sourceInfo}</Text>
				<View style={styles.buttonContainer}>
					<TouchableOpacity
						style={[styles.importButton, styles.importPrimary]}
						onPress={handleImport}
						disabled={importing}
					>
						<Text style={styles.importButtonText}>{importing ? '导入中...' : '导入'}</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.importButton, styles.cancelButton]}
						onPress={handleFinish}
						disabled={importing}
					>
						<Text style={[styles.importButtonText, styles.cancelButtonText]}>取消</Text>
					</TouchableOpacity>
				</View>
			</View>
		</SafeAreaView>
	)
}

const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
		padding: 16,
	},
	card: {
		backgroundColor: colors.surfaceElevated,
		borderRadius: 10,
		padding: 16,
		marginTop: 16,
		shadowColor: colors.shadow,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.1,
		shadowRadius: 8,
	},
	title: {
		fontSize: 20,
		fontWeight: '600',
		color: colors.text,
		marginBottom: 16,
	},
	fileName: {
		fontSize: 16,
		color: colors.text,
		marginBottom: 8,
	},
	fileInfo: {
		fontSize: 14,
		color: colors.text,
		marginBottom: 24,
		opacity: 0.8,
	},
	importButton: {
		backgroundColor: colors.primary,
		padding: 16,
		borderRadius: 8,
		alignItems: 'center',
	},
	importButtonText: {
		color: '#FFFFFF',
		fontSize: 16,
		fontWeight: '600',
	},
	message: {
		color: colors.text,
		fontSize: 16,
		textAlign: 'center',
		marginBottom: 8,
	},
	debugText: {
		color: colors.text,
		fontSize: 12,
		opacity: 0.7,
		marginBottom: 16,
	},
	buttonContainer: {
		flexDirection: 'row',
		gap: 10,
	},
	importPrimary: {
		flex: 1,
	},
	cancelButton: {
		flex: 1,
		backgroundColor: 'transparent',
		borderWidth: 1,
		borderColor: colors.primary,
	},
	cancelButtonText: {
		color: colors.primary,
	},
	})

export default ShareIntent
