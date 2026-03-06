import { NowPlayList } from '@/components/NowPlayList'
import { ThemeColors, screenPadding } from '@/constants/tokens'
import { useThemeColors } from '@/hooks/useAppTheme'
import { usePlayList } from '@/store/playList'
import { useHeaderHeight } from '@react-navigation/elements'
import React, { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Track } from 'react-native-track-player'

const PlayListScreen = () => {
	const colors = useThemeColors()
	const styles = useMemo(() => createStyles(colors), [colors])
	const headerHeight = useHeaderHeight()
	const tracks = usePlayList()

	return (
		<SafeAreaView style={[styles.modalContainer, { paddingTop: headerHeight }]}>
			<NowPlayList id="PlayListScreen" tracks={tracks as Track[]} />
		</SafeAreaView>
	)
}

const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
	modalContainer: {
		flex: 1,
		paddingHorizontal: screenPadding.horizontal,
		backgroundColor: colors.background,
	},
	header: {
		fontSize: 28,
		fontWeight: 'bold',
		padding: 0,
		paddingBottom: 20,
		paddingTop: 0,
		color: colors.text,
	},
	})

export default PlayListScreen
