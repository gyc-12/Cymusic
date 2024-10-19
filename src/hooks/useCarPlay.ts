import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { useFavorites, useTracks } from '@/store/library'
import { usePlayList } from '@/store/playList'
import { useEffect, useRef, useState } from 'react'
import { CarPlay, ListTemplate, NowPlayingTemplate, TabBarTemplate } from 'react-native-carplay'
import { useActiveTrack } from 'react-native-track-player'
import { useTrackPlayerFavorite } from './useTrackPlayerFavorite'

export default function useCarPlay() {
	const [carPlayConnected, setCarPlayConnected] = useState(CarPlay.connected)

	// 你需要实现这个 hook
	// const { playlists, playlistIds, playFromMediaId } = usePlayback();
	const { favorites, toggleTrackFavorite } = useFavorites()
	const { isFavorite, toggleFavorite } = useTrackPlayerFavorite()
	const activeTrack = useActiveTrack()
	const tracks = useTracks()
	const playingList = usePlayList()
	const playingListRef = useRef(playingList)
	const isFavoriteRef = useRef(false)
	const toggleFavoriteRef = useRef(toggleFavorite)
	const activeTrackRef = useRef(activeTrack)
	const favoritesRef = useRef(favorites)
	const buildBrowseTree = () => {
		if (!carPlayConnected) return

		const songsTemplate = new ListTemplate({
			id: 'songs',
			title: '音乐',
			sections: [
				{
					header: '音乐列表',
					// @ts-expect-error 类型不匹配但能用
					items: tracks.map((track) => ({
						text: track.title,
						detailText: track.artist,
						imgUrl: track.artwork,
					})),
				},
			],
			tabTitle: '音乐',
			tabSystemImageName: 'music.note', // 使用 SF Symbols
			onItemSelect: async (item) => {
				// 处理选择逻辑
				await myTrackPlayer.playWithReplacePlayList(
					tracks[item.index] as IMusic.IMusicItem,
					tracks as IMusic.IMusicItem[],
				)
				return Promise.resolve()
			},
		})

		const favoritesTemplate = new ListTemplate({
			id: 'favorites',
			title: '喜欢列表',
			sections: [
				{
					header: '喜欢列表',
					// @ts-expect-error 类型不匹配但能用
					items: favoritesRef.current.map((track) => ({
						text: track.title,
						detailText: track.artist,
						imgUrl: track.artwork,
					})),
				},
			],
			tabTitle: '喜欢',
			tabSystemImageName: 'heart.fill', // 使用 SF Symbols
			onItemSelect: async (item) => {
				// 处理选择逻辑
				await myTrackPlayer.playWithReplacePlayList(
					favorites[item.index] as unknown as IMusic.IMusicItem,
					favorites as IMusic.IMusicItem[],
				)
				return Promise.resolve()
			},
		})
		const playingTemplate = new ListTemplate({
			id: 'playing',
			title: '当前播放',
			sections: [
				{
					header: '进入播放界面',
					items: [{ text: '进入播放界面' }],
				},
				{
					header: '播放列表',
					items: [{ text: '进入播放列表' }],
				},
			],
			tabTitle: '播放',
			tabSystemImageName: 'play.fill', // 使用 SF Symbols
			onItemSelect: async (item) => {
				// 处理选择逻辑
				if (item.index === 0) {
					pushNowPlayingTemplate()
				} else if (item.index === 1) {
					updatePlaylistTemplate()
				}
				return Promise.resolve()
			},
		})

		const tabBarTemplate = new TabBarTemplate({
			title: 'CyMusic',
			tabTitle: 'CyMusic',
			tabSystemImageName: 'music.note',
			templates: [songsTemplate, favoritesTemplate, playingTemplate],
			onTemplateSelect: () => {},
		})

		CarPlay.setRootTemplate(tabBarTemplate)
	}

	const makeNowPlayingTemplate = (playback = 'shuffle') => {
		if (!carPlayConnected) return
		return new NowPlayingTemplate({
			buttons: [
				{
					id: 'favorite',
					type: 'add-to-library',
				},
			],
			albumArtistButtonEnabled: true,
			upNextButtonTitle: 'Tester',
			upNextButtonEnabled: false,
			onUpNextButtonPressed() {
				console.log('up next was pressed')
			},
			onButtonPressed(e) {
				switch (e.id) {
					case 'favorite':
						if (isFavoriteRef.current) {
							console.log('已经是喜欢')
							return
						} else {
							console.log('添加喜欢')
							try {
								toggleFavoriteRef.current()
								console.log('成功添加到喜欢')
							} catch (error) {
								console.error('Failed to toggle favorite:', error)
							}
						}

						return
				}
			},
		})
	}

	const updatePlaylistTemplate = () => {
		if (!carPlayConnected) return
		// console.log('playingList', playingListRef.current)
		try {
			const newPlaylistTemplate = new ListTemplate({
				id: 'playlist',
				title: '播放列表',
				sections: [
					{
						// @ts-expect-error 类型不匹配但能用
						items: playingListRef.current.map((track) => ({
							text: track.title,
							detailText: track.artist,
							imgUrl: track.artwork,
						})),
					},
				],
				onItemSelect: async (item) => {
					await myTrackPlayer.playWithReplacePlayList(
						playingList[item.index] as unknown as IMusic.IMusicItem,
						playingList as IMusic.IMusicItem[],
					)
					return Promise.resolve()
				},
			})

			CarPlay.popTemplate(false)
			CarPlay.pushTemplate(newPlaylistTemplate, true)
		} catch (error) {
			console.error('Failed to update playlist template:', error)
		}
	}

	const pushNowPlayingTemplate = (template = makeNowPlayingTemplate()) => {
		if (!template) return
		CarPlay.pushTemplate(template)
		CarPlay.enableNowPlaying(true)
	}

	useEffect(() => {
		// if (Platform.OS !== 'ios') return
		function onConnect() {
			setCarPlayConnected(true)
		}

		function onDisconnect() {
			setCarPlayConnected(false)
		}

		CarPlay.registerOnConnect(onConnect)
		CarPlay.registerOnDisconnect(onDisconnect)

		return () => {
			CarPlay.unregisterOnConnect(onConnect)
			CarPlay.unregisterOnDisconnect(onDisconnect)
		}
	}, [])

	useEffect(() => {
		if (!carPlayConnected) return
		buildBrowseTree()
	}, [carPlayConnected])

	useEffect(() => {
		playingListRef.current = playingList
	}, [playingList])
	useEffect(() => {
		console.log('isFavorite', isFavorite)
		isFavoriteRef.current = isFavorite
		activeTrackRef.current = activeTrack
		toggleFavoriteRef.current = toggleFavorite
	}, [isFavorite, activeTrack])
	useEffect(() => {
		favoritesRef.current = favorites
	}, [favorites])
	return { carPlayConnected, buildBrowseTree }
}
