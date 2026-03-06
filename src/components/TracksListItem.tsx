import { TrackShortcutsMenu } from '@/components/TrackShortcutsMenu'
import { unknownTrackImageUri } from '@/constants/images'
import { colors, fontSize } from '@/constants/tokens'
import { defaultStyles } from '@/styles'
import { getThumbnailArtwork } from '@/utils/imageUtils'
import rpx from '@/utils/rpx'
import { Entypo, Ionicons } from '@expo/vector-icons'
import React, { memo, useMemo } from 'react'
import { StyleSheet, Text, TouchableHighlight, TouchableOpacity, View } from 'react-native'
import FastImage from 'react-native-fast-image'
import LoaderKit from 'react-native-loader-kit'
import { Track } from 'react-native-track-player'
import { StopPropagation } from './utils/StopPropagation'

export type TracksListItemProps = {
	track: Track
	onTrackSelect: (track: Track) => void
	isActiveTrack?: boolean
	isPlaying?: boolean
	isSinger?: boolean
	allowDelete?: boolean
	onDeleteTrack?: (trackId: string) => void
	isMultiSelectMode?: boolean
	onToggleSelection?: (trackId: string) => void
	selectedTracks?: Set<string>
	toggleMultiSelectMode?: () => void
}

const TracksListItem = ({
	track,
	onTrackSelect: handleTrackSelect,
	isActiveTrack = false,
	isPlaying = false,
	isSinger = false,
	allowDelete = false,
	isMultiSelectMode = false,
	onToggleSelection,
	selectedTracks,
	onDeleteTrack,
	toggleMultiSelectMode,
}: TracksListItemProps) => {
	return (
		<TouchableHighlight
			onPress={() => (isMultiSelectMode ? onToggleSelection?.(track.id) : handleTrackSelect(track))}
			onLongPress={toggleMultiSelectMode}
		>
			<View style={styles.trackItemContainer}>
				{isMultiSelectMode && (
					<TouchableOpacity
						onPress={() => onToggleSelection?.(track.id)}
						style={{ marginRight: 10 }}
					>
						<Ionicons
							name={selectedTracks?.has(track.id) ? 'checkbox' : 'square-outline'}
							size={24}
							color={selectedTracks?.has(track.id) ? colors.primary : 'gray'}
						/>
					</TouchableOpacity>
				)}
				<View>
					<FastImage
						source={useMemo(() => ({
							uri: getThumbnailArtwork(track.artwork) ?? unknownTrackImageUri,
							priority: FastImage.priority.normal,
							cache: FastImage.cacheControl.immutable,
						}), [track.artwork])}
						style={{
							...styles.trackArtworkImage,
							opacity: isActiveTrack ? 0.6 : 1,
						}}
					/>

					{isActiveTrack &&
						(isPlaying ? (
							<LoaderKit
								style={styles.trackPlayingIconIndicator}
								name="LineScaleParty"
								color={colors.icon}
							/>
						) : (
							<Ionicons
								style={styles.trackPausedIndicator}
								name="play"
								size={24}
								color={colors.icon}
							/>
						))}
				</View>
				<View
					style={{
						flex: 1,
						flexDirection: 'row',
						alignItems: 'center',
					}}
				>
					<View style={{ flex: 3 }}>
						<Text
							numberOfLines={1}
							style={{
								...styles.trackTitleText,
								color: isActiveTrack ? colors.primary : colors.text,
							}}
						>
							{track.title}
						</Text>
						{track.artist && (
							<Text numberOfLines={1} style={styles.trackArtistText}>
								{track.artist}
							</Text>
						)}
					</View>

					{!isMultiSelectMode && (
						<View style={{ flex: 1 }}>
							<StopPropagation>
								<TrackShortcutsMenu
									track={track}
									isSinger={isSinger}
									allowDelete={allowDelete}
									onDeleteTrack={onDeleteTrack}
								>
									<View
										style={{
											flex: 1,
											alignItems: 'flex-end',
											justifyContent: 'center',
											paddingLeft: rpx(100),
										}}
									>
										<Entypo name="dots-three-horizontal" size={18} color={colors.icon} />
									</View>
								</TrackShortcutsMenu>
							</StopPropagation>
						</View>
					)}
				</View>
			</View>
		</TouchableHighlight>
	)
}
export default memo(TracksListItem)
const styles = StyleSheet.create({
	trackItemContainer: {
		flexDirection: 'row',
		columnGap: 14,
		alignItems: 'center',
		paddingRight: 0,
	},
	trackPlayingIconIndicator: {
		position: 'absolute',
		top: 18,
		left: 16,
		width: 16,
		height: 16,
	},
	trackPausedIndicator: {
		position: 'absolute',
		top: 14,
		left: 14,
	},
	trackArtworkImage: {
		borderRadius: 8,
		width: 50,
		height: 50,
	},
	trackTitleText: {
		...defaultStyles.text,
		fontSize: fontSize.sm,
		fontWeight: '600',
		maxWidth: '80%',
	},
	trackArtistText: {
		...defaultStyles.text,
		color: colors.textMuted,
		fontSize: 14,
		marginTop: 4,
		maxWidth: '80%',
	},
})
