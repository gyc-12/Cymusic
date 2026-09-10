import myTrackPlayer from '@/helpers/trackPlayerIndex'

export const useTrackPlayerRepeatMode = () => {
	const repeatMode = myTrackPlayer.useRepeatMode()
	return { repeatMode, changeRepeatMode: myTrackPlayer.setRepeatMode }
}
