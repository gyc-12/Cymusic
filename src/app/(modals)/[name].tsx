import { SingerTracksList } from '@/components/SingerTracksList'
import { screenPadding } from '@/constants/tokens'
import { logInfo } from '@/helpers/logger'
import { getAlbumSongList, getSingerDetail } from '@/helpers/userApi/getMusicSource'
import { useThemeColors } from '@/hooks/useAppTheme'
import { useDefaultStyles } from '@/styles'
import { useLocalSearchParams, usePathname } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, ScrollView, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Track } from 'react-native-track-player'
import ShareIntent from './shareintent'
// 专辑页面or歌手页面
const SingerListScreen = () => {
	const colors = useThemeColors()
	const defaultStyles = useDefaultStyles()
	const pathname = usePathname()
	logInfo('pathname', pathname)
	const isShareIntentPath = pathname.includes('cymusic')

	const { name: playlistName, album } = useLocalSearchParams<{ name: string; album?: string }>()
	const isAlbum = !!album
	logInfo('album', album)

	const [singerListDetail, setSingerListDetail] = useState<{ musicList: Track[] } | null>(null)
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		if (isShareIntentPath) {
			return
		}
		const fetchSingerListDetail = async () => {
			let detail
			if (isAlbum) {
				detail = await getAlbumSongList(playlistName)
				// console.log('detail', detail)
				// console.log('playlistName', playlistName)
			} else {
				detail = await getSingerDetail(playlistName)
			}

			setSingerListDetail(detail)

			setLoading(false)
		}
		fetchSingerListDetail()
	}, [isAlbum, isShareIntentPath, playlistName])

	if (isShareIntentPath) {
		return <ShareIntent></ShareIntent>
	}

	console.log('album', album)

	if (loading) {
		return (
			<View
				style={{
					flex: 1,
					justifyContent: 'center',
					alignItems: 'center',
					backgroundColor: colors.background,
				}}
			>
				<ActivityIndicator size="large" color={colors.loading} />
			</View>
		)
	}
	const DismissPlayerSymbol = () => {
		const { top } = useSafeAreaInsets()

		return (
			<View
				style={{
					position: 'absolute',
					top: top - 28,
					left: 0,
					right: 0,
					flexDirection: 'row',
					justifyContent: 'center',
				}}
			>
				<View
					accessible={false}
					style={{
						width: 65,
						height: 8,
						borderRadius: 8,
						backgroundColor: colors.dismissBar,
						opacity: 0.7,
					}}
				/>
			</View>
		)
	}

	return (
		<SafeAreaView style={defaultStyles.container}>
			<DismissPlayerSymbol />
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				style={{ paddingHorizontal: screenPadding.horizontal }}
			>
				<SingerTracksList playlist={singerListDetail} tracks={singerListDetail.musicList} />
			</ScrollView>
		</SafeAreaView>
	)
}

export default SingerListScreen
