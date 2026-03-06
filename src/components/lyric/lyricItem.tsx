import { ThemeColors } from '@/constants/tokens'
import { useThemeColors } from '@/hooks/useAppTheme'
import rpx from '@/utils/rpx'
import * as Haptics from 'expo-haptics'
import React, { memo, useCallback, useMemo, useRef } from 'react'
import { Animated, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native'
interface ILyricItemComponentProps {
	// 行号
	index?: number
	// 显示
	light?: boolean
	// 高亮
	highlight?: boolean
	// 文本
	text?: string
	// 字体大小
	fontSize?: number
	onPress: () => Promise<void>
	onLayout?: (index: number, height: number) => void
}

function _LyricItemComponent(props: ILyricItemComponentProps) {
	const { highlight, text, onLayout, index, fontSize, onPress } = props
	const colors = useThemeColors()
	const lyricStyles = useMemo(() => createStyles(colors), [colors])
	const animatedOpacity = useRef(new Animated.Value(0)).current

	const handlePress = useCallback(() => {
		// 触发震动
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)

		// 显示背景
		Animated.sequence([
			Animated.timing(animatedOpacity, {
				toValue: 1,
				duration: 600,
				useNativeDriver: true,
			}),
			Animated.timing(animatedOpacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}),
		]).start()

		// 调用原来的 onPress
		onPress()
	}, [onPress, animatedOpacity])

	return (
		<TouchableWithoutFeedback onPress={handlePress}>
			<View>
				<Animated.View
					style={[
						lyricStyles.background,
						{
							opacity: animatedOpacity,
						},
					]}
				/>
				<Text
					onLayout={({ nativeEvent }) => {
						if (index !== undefined) {
							onLayout?.(index, nativeEvent.layout.height)
						}
					}}
					style={[
						lyricStyles.item,
						{
							fontSize: fontSize || rpx(28),
						},
						highlight
							? [
									lyricStyles.highlightItem,
									{
										color: colors.primary,
									},
								]
							: null,
						// light ? lyricStyles.draggingItem : null,
					]}
				>
					{text}
				</Text>
			</View>
		</TouchableWithoutFeedback>
	)
}
// 歌词
const LyricItemComponent = memo(
	_LyricItemComponent,
	(prev, curr) =>
		prev.light === curr.light &&
		prev.highlight === curr.highlight &&
		prev.text === curr.text &&
		prev.index === curr.index &&
		prev.fontSize === curr.fontSize,
)

export default LyricItemComponent

const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
	highlightItem: {
		opacity: 1,
	},
	item: {
		color: colors.text,
		opacity: 0.6,
		paddingHorizontal: rpx(64),
		paddingVertical: rpx(24),
		width: '100%',
		textAlign: 'center',
		textAlignVertical: 'center',
	},
	draggingItem: {
		opacity: 1,
		color: colors.text,
	},
	background: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: colors.overlaySoft,
		borderRadius: rpx(10),
	},
	})
