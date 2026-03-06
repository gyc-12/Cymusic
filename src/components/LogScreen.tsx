import { ThemeColors, fontSize, screenPadding } from '@/constants/tokens'
import { useThemeColors } from '@/hooks/useAppTheme'
import { logError, useLoggerHook } from '@/helpers/logger'
import i18n from '@/utils/i18n'
import { Ionicons } from '@expo/vector-icons'
import React, { useMemo, useRef, useState } from 'react'
import {
	Alert,
	Animated,
	Clipboard,
	FlatList,
	Modal,
	Pressable,
	SafeAreaView,
	ScrollView,
	Share,
	StyleSheet,
	Text,
	TouchableOpacity,
	TouchableWithoutFeedback,
	View,
} from 'react-native'
const LogScreen = () => {
	const colors = useThemeColors()
	const styles = useMemo(() => createStyles(colors), [colors])
	const { logs, clearLogs } = useLoggerHook()
	const [selectedLog, setSelectedLog] = useState<null | any>(null)
	const fadeAnim = useRef(new Animated.Value(0)).current
	const handleShare = async () => {
		const logText = logs.map((log) => `[${log.timestamp}] [${log.level}] ${log.message}`).join('\n')
		try {
			await Share.share({
				message: logText,
			})
		} catch (error) {
			logError(i18n.t('logScreen.shareError'), error)
		}
	}
	const handleLongPress = (item: any) => {
		handleCopy(item)
	}

	const handleCopy = (item: any) => {
		const logText = `[${item.timestamp}] [${item.level}] ${item.message}`
		Clipboard.setString(logText)
		// 可以添加一个提示，告诉用户日志已复制
		Alert.alert(i18n.t('logScreen.copy'), i18n.t('logScreen.copyMessage'))
		Animated.timing(fadeAnim, {
			toValue: 0,
			duration: 500,
			useNativeDriver: true,
		}).start()
	}
	const renderItem = ({ item }: { item: any }) => (
		<Pressable
			onPress={() => setSelectedLog(item)}
			onLongPress={() => handleLongPress(item)}
			style={({ pressed }) => [styles.logItem, pressed && styles.pressed]}
		>
			<View style={styles.logHeader}>
				<Text style={[styles.logLevel, { color: getLogColor(item.level) }]}>{item.level}</Text>
				<Text style={styles.logTimestamp}>{formatTimestamp(item.timestamp)}</Text>
			</View>
			<Text style={styles.logMessage}>{item.message}</Text>
		</Pressable>
	)

	const formatTimestamp = (timestamp: string) => {
		const date = new Date(timestamp)
		return `${padZero(date.getHours())}:${padZero(date.getMinutes())}:${padZero(date.getSeconds())}`
	}

	const padZero = (num: number) => (num < 10 ? `0${num}` : num)

	const getLogColor = (level: string) => {
		switch (level) {
			case 'ERROR':
				return colors.primary
			case 'WARN':
				return '#FFA500' // 橙色
			case 'INFO':
			default:
				return colors.success
		}
	}

	return (
		<SafeAreaView style={styles.safeArea}>
			<View style={styles.container}>
				<View style={styles.header}>
					<Text style={styles.title}>{i18n.t('logScreen.title')}</Text>
					<View style={styles.headerButtons}>
						<TouchableOpacity onPress={handleShare} style={styles.iconButton}>
							<Ionicons name="share-social-outline" size={20} color={colors.text} />
							<Text style={styles.buttonText}>{i18n.t('logScreen.actions.share')}</Text>
						</TouchableOpacity>
						<TouchableOpacity onPress={clearLogs} style={styles.iconButton}>
							<Ionicons name="trash-outline" size={20} color={colors.text} />
							<Text style={styles.buttonText}>{i18n.t('logScreen.actions.clear')}</Text>
						</TouchableOpacity>
					</View>
				</View>
				<FlatList
					data={logs}
					keyExtractor={(item, index) => index.toString()}
					renderItem={renderItem}
					ListEmptyComponent={<Text style={styles.emptyText}>{i18n.t('logScreen.empty')}</Text>}
					contentContainerStyle={logs.length === 0 && styles.emptyContainer}
					style={styles.flatList}
				/>
				{/* 日志详情模态框 */}
				<Modal visible={selectedLog !== null} transparent animationType="slide">
					<TouchableWithoutFeedback onPress={() => setSelectedLog(null)}>
						<View style={styles.modalOverlay} />
					</TouchableWithoutFeedback>
					<View style={styles.modalContainer}>
						<ScrollView contentContainerStyle={styles.modalContent}>
							{selectedLog && (
								<View>
									<View style={styles.modalHeader}>
										<Text style={styles.modalTitle}>{i18n.t('logScreen.details.title')}</Text>
										<TouchableOpacity onPress={() => setSelectedLog(null)}>
											<Ionicons name="close" size={24} color={colors.text} />
										</TouchableOpacity>
									</View>
									<Text style={styles.modalTimestamp}>{selectedLog.timestamp}</Text>
									<Text style={[styles.modalLevel, { color: getLogColor(selectedLog.level) }]}>
										{selectedLog.level}
									</Text>
									<Text style={styles.modalMessage}>{selectedLog.message}</Text>
									{selectedLog.details && (
										<View style={styles.modalDetails}>
											<Text style={styles.detailsTitle}>{i18n.t('logScreen.details.title')}</Text>
											<Text style={styles.detailsContent}>
												{typeof selectedLog.details === 'string'
													? selectedLog.details
													: JSON.stringify(selectedLog.details, null, 2)}
											</Text>
										</View>
									)}
								</View>
							)}
						</ScrollView>
					</View>
				</Modal>
			</View>
		</SafeAreaView>
	)
}

const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: colors.background,
	},
	container: {
		flex: 1,
		backgroundColor: colors.background,
		paddingHorizontal: screenPadding.horizontal,
		// 移除 paddingTop: 16，避免内容被顶部遮挡
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 16,
		paddingVertical: 8, // 增加垂直内边距
	},
	title: {
		fontSize: fontSize.lg,
		fontWeight: '700',
		color: colors.text,
	},
	headerButtons: {
		flexDirection: 'row',
	},
	iconButton: {
		flexDirection: 'row',
		alignItems: 'center',
		marginLeft: 16,
	},
	buttonText: {
		marginLeft: 4,
		color: colors.text,
		fontSize: fontSize.sm,
	},
	flatList: {
		flex: 1, // 确保 FlatList 占据剩余空间并可滚动
	},
	logItem: {
		paddingVertical: 12,
		borderBottomWidth: 1,
		borderBottomColor: colors.separator,
	},
	logHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		marginBottom: 4,
	},
	logLevel: {
		fontSize: fontSize.sm,
		fontWeight: '600',
	},
	logTimestamp: {
		fontSize: fontSize.sm,
		color: colors.textMuted,
	},
	logMessage: {
		fontSize: fontSize.base,
		color: colors.text,
	},
	emptyContainer: {
		flexGrow: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},
	emptyText: {
		fontSize: fontSize.base,
		color: colors.textMuted,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: colors.overlay,
		justifyContent: 'flex-end',
	},
	modalContainer: {
		backgroundColor: colors.surface,
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		maxHeight: '80%',
	},
	modalContent: {
		padding: 20,
	},
	modalHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	modalTitle: {
		fontSize: fontSize.lg,
		fontWeight: '700',
		color: colors.text,
	},
	modalTimestamp: {
		fontSize: fontSize.sm,
		color: colors.textMuted,
		marginBottom: 4,
	},
	modalLevel: {
		fontSize: fontSize.sm,
		fontWeight: '600',
		marginBottom: 8,
	},
	modalMessage: {
		fontSize: fontSize.base,
		color: colors.text,
		marginBottom: 12,
	},
	modalDetails: {
		backgroundColor: colors.surfaceMuted,
		padding: 10,
		borderRadius: 8,
		marginBottom: 16,
	},
	detailsTitle: {
		fontSize: fontSize.sm,
		fontWeight: '600',
		color: colors.text,
		marginBottom: 4,
	},
	detailsContent: {
		fontSize: fontSize.sm,
		color: colors.textMuted,
		fontFamily: 'monospace',
	},
	closeButton: {
		backgroundColor: colors.primary,
		paddingVertical: 10,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 10,
	},
	closeButtonText: {
		color: colors.text,
		fontSize: fontSize.base,
		fontWeight: 'bold',
	},
	copyButton: {
		position: 'absolute',
		right: 10,
		top: 10,
		backgroundColor: colors.primary,
		padding: 5,
		borderRadius: 5,
	},
	copyButtonText: {
		color: colors.text,
		fontSize: fontSize.sm,
	},
	pressed: {
		backgroundColor: colors.overlaySoft,
		opacity: 0.5,
	},
	})

export default LogScreen
