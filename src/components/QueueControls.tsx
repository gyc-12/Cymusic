import { colors } from '@/constants/tokens'
import myTrackPlayer, { MusicRepeatMode, repeatModeStore } from '@/helpers/trackPlayerIndex'
import { setPlayList } from '@/store/playList'
import { defaultStyles } from '@/styles'
import i18n from '@/utils/i18n'
import { Ionicons } from '@expo/vector-icons'
import shuffle from 'lodash.shuffle'
import { StyleSheet, Text, View, ViewProps } from 'react-native'
import { TouchableOpacity } from 'react-native-gesture-handler'
import { Track } from 'react-native-track-player'

type QueueControlsProps = {
	tracks: Track[]
	showImportMenu?: boolean
	onImportTrack?: () => void
	isMultiSelectMode?: boolean
	onSelectAll?: () => void
	isAllSelected?: boolean
	deleteSelectedTracks?: () => void
	exportSelectedTracks?: () => void
} & ViewProps

export const QueueControls = ({
	tracks,
	style,
	showImportMenu,
	onImportTrack,
	isMultiSelectMode = false,
	onSelectAll,
	isAllSelected = false,
	deleteSelectedTracks,
	exportSelectedTracks,
	...viewProps
}: QueueControlsProps) => {
	const handlePlay = async () => {
		await myTrackPlayer.playWithReplacePlayList(
			tracks[0] as IMusic.IMusicItem,
			tracks as IMusic.IMusicItem[],
		)
		myTrackPlayer.setRepeatMode(MusicRepeatMode.QUEUE)
	}

	const handleShufflePlay = async () => {
		if (tracks.length === 0) return
		const shuffledTracks = shuffle(tracks)
		repeatModeStore.setValue(MusicRepeatMode.SHUFFLE)
		await myTrackPlayer.playWithReplacePlayList(
			shuffledTracks[0] as IMusic.IMusicItem,
			shuffledTracks as IMusic.IMusicItem[],
		)
	}

	return (
		<View style={[{ flexDirection: 'row', columnGap: 16 }, style]} {...viewProps}>
			{/* Play button */}
			<View style={{ flex: 1 }}>
				{isMultiSelectMode ? (
					<TouchableOpacity onPress={onSelectAll} activeOpacity={0.8} style={styles.button}>
						<Ionicons
							name={isAllSelected ? 'checkbox-outline' : 'square-outline'}
							size={24}
							color={colors.primary}
						/>
						<Text style={styles.buttonText}>
							{isAllSelected ? i18n.t('playButton.cancel') : i18n.t('playButton.selectAll')}
						</Text>
					</TouchableOpacity>
				) : (
					<TouchableOpacity onPress={handlePlay} activeOpacity={0.8} style={styles.button}>
						<Ionicons name="play" size={22} color={colors.primary} />

						<Text style={styles.buttonText}>{i18n.t('playButton.play')}</Text>
					</TouchableOpacity>
				)}
			</View>

			{/* Shuffle button */}
			{!isMultiSelectMode ? (
				<View style={{ flex: 1 }}>
					<TouchableOpacity onPress={handleShufflePlay} activeOpacity={0.8} style={styles.button}>
						<Ionicons name={'shuffle-sharp'} size={24} color={colors.primary} />

						<Text style={styles.buttonText}>{i18n.t('playButton.shuffle')}</Text>
					</TouchableOpacity>
				</View>
			) : (
				<View style={{ flex: 1 }}>
					<TouchableOpacity
						onPress={deleteSelectedTracks}
						activeOpacity={0.8}
						style={styles.button}
					>
						<Ionicons name={'trash-outline'} size={24} color={colors.primary} />

						<Text style={styles.buttonText}>{i18n.t('playButton.delete')}</Text>
					</TouchableOpacity>
				</View>
			)}
			{/* import button */}
			{showImportMenu && (
				<View style={{ flex: 1 }}>
					{isMultiSelectMode ? (
						<TouchableOpacity
							onPress={exportSelectedTracks}
							activeOpacity={0.8}
							style={styles.button}
						>
							<Ionicons name={'exit-outline'} size={24} color={colors.primary} />

							<Text style={styles.buttonText}>{i18n.t('playButton.out')}</Text>
						</TouchableOpacity>
					) : (
						<TouchableOpacity onPress={onImportTrack} activeOpacity={0.8} style={styles.button}>
							<Ionicons name={'enter-outline'} size={24} color={colors.primary} />

							<Text style={styles.buttonText}>{i18n.t('playButton.import')}</Text>
						</TouchableOpacity>
					)}
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	button: {
		padding: 12,
		backgroundColor: 'rgba(47, 47, 47, 0.5)',
		borderRadius: 8,
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		columnGap: 8,
	},
	buttonText: {
		...defaultStyles.text,
		color: colors.primary,
		fontWeight: '600',
		fontSize: 18,
		textAlign: 'center',
	},
})
