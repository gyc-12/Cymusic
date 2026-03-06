import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, LayoutRectangle, StyleSheet, Text, View } from 'react-native'

import LyricManager from '@/helpers/lyricManager'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import useDelayFalsy from '@/hooks/useDelayFalsy'
import PersistStatus from '@/store/PersistStatus'
import delay from '@/utils/delay'
import { musicIsPaused } from '@/utils/trackUtils'
import { FlatList } from 'react-native-gesture-handler'
import rpx from '../../utils/rpx'
import LyricItemComponent from './lyricItem'
const ITEM_HEIGHT = rpx(92)

interface IItemHeights {
	blankHeight?: number
	[k: number]: number
}

interface IProps {
	onTurnPageClick?: () => void
}

const fontSizeMap = {
	0: rpx(24),
	1: rpx(30),
	2: rpx(36),
	3: rpx(42),
} as Record<number, number>

export default function Lyric(props: IProps) {
	const { onTurnPageClick } = props
	// const lrcSource = {
	// 	rawLrc: nowLyricState.useValue() || '[00:00.00]暂无歌词',
	// } as ILyric.ILyricSource
	// const musicItem = myTrackPlayer.getCurrentMusic()
	// const parser = new LyricParser(lrcSource, musicItem, {})
	// const lyrics = parser.getLyric()
	// console.log('lyrics', lyrics)
	const [loading, setisLoading] = useState(false)
	const { meta, lyrics } = LyricManager.useLyricState()
	// console.log('lyrics', lyrics)
	const currentLrcItem = LyricManager.useCurrentLyric()
	// const showTranslation = PersistStatus.useValue('lyric.showTranslation', false)
	const fontSizeKey = PersistStatus.useValue('lyric.detailFontSize', 1)
	const fontSizeStyle = useMemo(
		() => ({
			fontSize: fontSizeMap[fontSizeKey!],
		}),
		[fontSizeKey],
	)

	const [draggingIndex, setDraggingIndex, setDraggingIndexImmi] = useDelayFalsy<number | undefined>(
		undefined,
		2000,
	)
	const musicState = myTrackPlayer.useMusicState()

	const [layout, setLayout] = useState<LayoutRectangle>()

	const listRef = useRef<FlatList<ILyric.IParsedLrcItem> | null>()

	const currentMusicItem = myTrackPlayer.useCurrentMusic()
	// const associateMusicItem = currentMusicItem
	// 	? MediaExtra.get(currentMusicItem)?.associatedLrc
	// 	: null
	// 是否展示拖拽
	const dragShownRef = useRef(false)

	// 组件是否挂载
	const isMountedRef = useRef(true)

	// 用来缓存高度
	const itemHeightsRef = useRef<IItemHeights>({})

	// 设置空白组件，获取组件高度
	const blankComponent = useMemo(() => {
		return (
			<View
				style={styles.empty}
				onLayout={(evt) => {
					itemHeightsRef.current.blankHeight = evt.nativeEvent.layout.height
				}}
			/>
		)
	}, [])

	const handleLyricItemLayout = useCallback((index: number, height: number) => {
		itemHeightsRef.current[index] = height
	}, [])

	// 滚到当前item
	const scrollToCurrentLrcItem = useCallback(() => {
		if (!listRef.current) {
			return
		}
		const currentLrcItem = LyricManager.getCurrentLyric()
		const lyrics = LyricManager.getLyricState().lyrics
		if (currentLrcItem?.index === -1 || !currentLrcItem) {
			listRef.current?.scrollToIndex({
				index: 0,
				viewPosition: 0.5,
			})
		} else {
			listRef.current?.scrollToIndex({
				index: Math.min(currentLrcItem.index ?? 0, lyrics.length - 1),
				viewPosition: 0.5,
			})
		}
	}, [])

	// const delayedScrollToCurrentLrcItem = useMemo(() => {
	// 	let sto: number

	// 	return () => {
	// 		if (sto) {
	// 			clearTimeout(sto)
	// 		}
	// 		sto = setTimeout(() => {
	// 			if (isMountedRef.current) {
	// 				scrollToCurrentLrcItem()
	// 			}
	// 		}, 200) as any
	// 	}
	// }, [])

	useEffect(() => {
		// 暂停且拖拽才返回
		if (
			lyrics.length === 0 ||
			draggingIndex !== undefined ||
			(draggingIndex === undefined && musicIsPaused(musicState)) ||
			lyrics[lyrics.length - 1].time < 1
		) {
			return
		}
		if (currentLrcItem?.index === -1 || !currentLrcItem) {
			listRef.current?.scrollToIndex({
				index: 0,
				viewPosition: 0.5,
			})
		} else {
			listRef.current?.scrollToIndex({
				index: Math.min(currentLrcItem.index ?? 0, lyrics.length - 1),
				viewPosition: 0.5,
			})
		}
	}, [currentLrcItem, lyrics, draggingIndex])

	useEffect(() => {
		scrollToCurrentLrcItem()
		return () => {
			isMountedRef.current = false
		}
	}, [])

	const onScrollBeginDrag = useCallback(() => {
		dragShownRef.current = true
	}, [])

	const onScrollEndDrag = useCallback(async () => {
		if (draggingIndex !== undefined) {
			setDraggingIndex(undefined)
		}
		dragShownRef.current = false
	}, [draggingIndex, setDraggingIndex])

	const onScroll = useCallback((e: any) => {
		if (dragShownRef.current) {
			const offset = e.nativeEvent.contentOffset.y + e.nativeEvent.layoutMeasurement.height / 2

			const itemHeights = itemHeightsRef.current
			let height = itemHeights.blankHeight!
			if (offset <= height) {
				setDraggingIndex(0)
				return
			}
			for (let i = 0; i < lyrics.length; ++i) {
				height += itemHeights[i] ?? 0
				if (height > offset) {
					setDraggingIndex(i)
					return
				}
			}
		}
	}, [lyrics.length, setDraggingIndex])

	const handleLyricItemPress = useCallback(
		async (index: number) => {
			if (index >= 0 && index < lyrics.length) {
				const time = lyrics[index].time + +(meta?.offset ?? 0)
				if (time !== undefined && !isNaN(time)) {
					await myTrackPlayer.seekTo(time)
					await myTrackPlayer.play()
				}
			}
		},
		[lyrics, meta?.offset],
	)

	const listHeader = useMemo(() => (
		<>
			{blankComponent}
			<View style={styles.lyricMeta}></View>
		</>
	), [blankComponent])

	const renderLyricItem = useCallback(({ item, index }: { item: ILyric.IParsedLrcItem; index: number }) => {
		return (
			<LyricItemComponent
				index={index}
				text={item.lrc}
				fontSize={fontSizeStyle.fontSize}
				onLayout={handleLyricItemLayout}
				light={draggingIndex === index}
				highlight={currentLrcItem?.index === index}
				onPress={() => handleLyricItemPress(index)}
			/>
		)
	}, [fontSizeStyle.fontSize, handleLyricItemLayout, draggingIndex, currentLrcItem?.index, handleLyricItemPress])

	return (
		<>
			<View style={styles.fwflex1}>
				{loading ? (
					<View style={styles.fwflex1}>
						<ActivityIndicator size="large" color="#fff" />
					</View>
				) : lyrics?.length ? (
					<FlatList
						ref={(_) => {
							listRef.current = _
						}}
						onLayout={(e) => {
							setLayout(e.nativeEvent.layout)
						}}
						viewabilityConfig={{
							itemVisiblePercentThreshold: 100,
						}}
						onScrollToIndexFailed={({ index }) => {
							delay(120).then(() => {
								listRef.current?.scrollToIndex({
									index: Math.min(index ?? 0, lyrics.length - 1),
									viewPosition: 0.5,
								})
							})
						}}
						fadingEdgeLength={120}
					ListHeaderComponent={listHeader}
					ListFooterComponent={blankComponent}
					onScrollBeginDrag={onScrollBeginDrag}
					onMomentumScrollEnd={onScrollEndDrag}
					onScroll={onScroll}
					scrollEventThrottle={32}
					style={styles.wrapper}
					data={lyrics}
					initialNumToRender={30}
					overScrollMode="never"
					extraData={currentLrcItem}
					renderItem={renderLyricItem}
					/>
				) : (
					<View style={styles.fullCenter}>
						<Text style={[styles.white, fontSizeStyle]}>暂无歌词</Text>
					</View>
				)}
			</View>
		</>
	)
}

const styles = StyleSheet.create({
	wrapper: {
		width: '100%',
		marginVertical: rpx(48),
		flex: 1,
	},
	fwflex1: {
		width: '100%',
		flex: 1,
	},
	empty: {
		paddingTop: '70%',
	},
	white: {
		color: 'white',
	},
	lyricMeta: {
		position: 'absolute',
		width: '100%',
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		left: 0,
		paddingHorizontal: rpx(48),
		bottom: rpx(48),
	},
	lyricMetaText: {
		color: 'white',
		opacity: 0.8,
		maxWidth: '80%',
	},
	linkText: {
		color: '#66ccff',
		textDecorationLine: 'underline',
	},
	fullCenter: {
		width: '100%',
		flex: 1,
		justifyContent: 'center',
		alignItems: 'center',
	},

	singleLine: {
		width: '67%',
		height: 1,
		backgroundColor: '#cccccc',
		opacity: 0.4,
	},
	playIcon: {
		width: rpx(90),
		textAlign: 'right',
		color: 'white',
	},
	searchLyric: {
		width: rpx(180),
		marginTop: rpx(14),
		paddingVertical: rpx(10),
		textAlign: 'center',
		alignSelf: 'center',
		color: '#66eeff',
		textDecorationLine: 'underline',
	},
})
