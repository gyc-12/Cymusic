import musicSdk from '@/components/utils/musicSdk'
import { Artist, Playlist, TrackWithPlaylist } from '@/helpers/types'
import { useEffect } from 'react'
import type { Track } from '@/player/types'
import { create } from 'zustand'

import { getTopLists } from '@/helpers/userApi/getMusicSource'
import PersistStatus from '@/store/PersistStatus'

interface LibraryState {
	allTracks: TrackWithPlaylist[]
	tracks: TrackWithPlaylist[]
	favorites: IMusic.IMusicItem[]
	nowLyric: string
	playlists: Playlist[]
	isLoading: boolean
	toggleTrackFavorite: (track: Track) => void
	addToPlaylist: (track: Track, playlistName: string) => void
	fetchTracks: (refresh?: boolean) => Promise<void>
	setNowLyric: (lyric: string) => void
	setPlayList: (newPlayList?: Playlist[]) => void
	page: number
	hasMore: boolean
	// getMusicIndex: (musicItem?: IMusic.IMusicItem | null) => number
	// isInPlayList: (musicItem?: IMusic.IMusicItem | null) => boolean
	// getPlayListMusicAt: (index: number) => IMusic.IMusicItem | null
	// isPlayListEmpty: () => boolean
}

const mapTrack = (track: {
	songmid: any
	url: any
	name: any
	singer: any
	albumName: any
	genre: any
	releaseDate: any
	img: any
	interval: any
	singerImg: any
}): TrackWithPlaylist => {
	return {
		id: track.songmid || 'default_songmid', // 如果 songmid 为 undefined 或 null，设置默认值 'default_songmid'
		url: track.url || 'Unknown', // 如果 url 为 undefined 或 null，设置默认值 'http://example.com/default.mp3'
		title: track.name || 'Untitled Song', // 如果 name 为 undefined 或 null，设置默认值 'Untitled Song'
		artist: track.singer || 'Unknown Artist', // 如果 singer 为 undefined 或 null，设置默认值 'Unknown Artist'
		album: track.albumName || 'Unknown Album', // 如果 albumName 为 undefined 或 null，设置默认值 'Unknown Album'
		genre: track.genre || 'Unknown Genre', // 如果 genre 为 undefined 或 null，设置默认值 'Unknown Genre'
		date: track.releaseDate || 'Unknown Release Date', // 如果 releaseDate 为 undefined 或 null，设置默认值 'Unknown Release Date'
		artwork: track.img || 'http://example.com/default.jpg', // 如果 img 为 undefined 或 null，设置默认值 'http://example.com/default.jpg'
		duration: 0, // 如果 interval 为 undefined 或 null，设置默认值 0
		singerImg: track.singerImg || 'http://example.com/default_artist.jpg',
	}
}
export const useLibraryStore = create<LibraryState>((set, get) => ({
	allTracks: [],
	tracks: [],
	isLoading: false,
	page: 1,
	hasMore: true,
	favorites: PersistStatus.get('music.favorites') || [],
	nowLyric: '当前无歌词',
	playlists: [],
	toggleTrackFavorite: (track: Track) => {
		set((state) => {
			const favorites = [...state.favorites]
			const index = favorites.findIndex((fav) => fav.id === track.id)

			if (index !== -1) {
				// 如果存在，则从数组中删除
				favorites.splice(index, 1)
			} else {
				// 如果不存在，则添加到数组中
				favorites.push(track as IMusic.IMusicItem)
			}
			// 更新持久化存储中的favorites
			PersistStatus.set('music.favorites', favorites)

			// 返回新的状态
			return { favorites }
		})
	},
	addToPlaylist: (track, playlistName) =>
		set((state) => ({
			tracks: state.tracks.map((currentTrack) => {
				if (currentTrack.url === track.url) {
					return {
						...currentTrack,
						playlist: [...(currentTrack.playlist ?? []), playlistName],
					}
				}
				return currentTrack
			}),
		})),
	fetchTracks: async (refresh = false) => {
		const { page, hasMore, isLoading, allTracks } = get()
		if (isLoading || (!hasMore && !refresh)) return
		const PAGE_SIZE = 100

		try {
			if (refresh || allTracks.length === 0) {
				// 只在刷新或首次加载时请求数据
				set({ isLoading: true })

				const data = await musicSdk['tx'].leaderboard.getList(26, 1)
				const mappedTracks = data.list.map(mapTrack)
				// console.log(mappedTracks.length)
				set({ allTracks: mappedTracks })
			}
			set({ isLoading: true })
			// // 延时
			// await new Promise((resolve) => setTimeout(resolve, 5000))
			// console.log(isLoading)
			const currentPage = refresh ? 1 : page
			const start = (currentPage - 1) * PAGE_SIZE
			const end = start + PAGE_SIZE
			const newTracks = get().allTracks.slice(start, end)

			set((state) => ({
				tracks: refresh ? newTracks : [...state.tracks, ...newTracks],
				page: currentPage + 1,
				hasMore: end < get().allTracks.length,
				isLoading: false,
			}))
		} catch (error) {
			console.error('Failed to fetch tracks:', error)
			set({ isLoading: false })
		}
	},
	setNowLyric: (nowLyric: string) => {
		set({ nowLyric: nowLyric })
	},
	setPlayList: async (newPlayList?) => {
		try {
			const playlists = await getTopLists()
			const combinedData = playlists.flatMap((group) =>
				group.data.map((playlist) => ({
					...playlist,
					coverImg: playlist.coverImg.replace(/^http:/, 'https:'),
				})),
			)
			set({ playlists: combinedData })
		} catch (error) {
			console.error('Failed to set playlist:', error)
		}
	},
	// getMusicIndex: (musicItem) => {
	//   if (!musicItem) {
	//     return -1
	//   }
	//   const { playListIndexMap } = useLibraryStore.getState()
	//   return playListIndexMap[musicItem.platform]?.[musicItem.id] ?? -1
	// },
	// isInPlayList: (musicItem) => {
	//   if (!musicItem) {
	//     return false
	//   }
	//   const { playListIndexMap } = useLibraryStore.getState()
	//   return playListIndexMap[musicItem.platform]?.[musicItem.id] > -1
	// },
	// getPlayListMusicAt: (index) => {
	//   const { tracks } = useLibraryStore.getState()
	//   const len = tracks.length
	//   if (len === 0) {
	//     return null
	//   }
	//   return tracks[(index + len) % len]
	// },
	// isPlayListEmpty: () => {
	//   const { tracks } = useLibraryStore.getState()
	//   return tracks.length === 0
	// },
}))

export const useTracks = () => {
	const { tracks, fetchTracks } = useLibraryStore()
	useEffect(() => {
		fetchTracks()
	}, [fetchTracks])
	return tracks
}
export const useAllTracks = () => {
	const allTracks = useLibraryStore((state) => state.allTracks)
	return allTracks
}
// export const useSetPlayList = () => {
//   const { tracks, setPlayList } = useLibraryStore()
//   useEffect(() => {
//      setPlayList(tracks)
//   }, [setPlayList])
//   return tracks
// }

export const useFavorites = () => {
	const favorites = useLibraryStore((state) => state.favorites)
	const toggleTrackFavorite = useLibraryStore((state) => state.toggleTrackFavorite)
	return {
		favorites,
		toggleTrackFavorite,
	}
}
export const useNowLyric = () => {
	const nowLyric = useLibraryStore((state) => state.nowLyric)
	const setNowLyric = useLibraryStore((state) => state.setNowLyric)
	return { nowLyric, setNowLyric }
}
export const useArtists = () =>
	useLibraryStore((state) => {
		return state.tracks.reduce((acc, track) => {
			const existingArtist = acc.find((artist) => artist.name === track.artist)
			if (existingArtist) {
				existingArtist.tracks.push(track)
			} else {
				acc.push({
					name: track.artist ?? 'Unknown',
					tracks: [track],
					singerImg: track.singerImg,
				})
			}
			return acc
		}, [] as Artist[])
	})

export const usePlaylists = () => {
	const playlists = useLibraryStore((state) => {
		return state.playlists
	})

	const setPlayList = useLibraryStore((state) => state.setPlayList)
	useEffect(() => {
		setPlayList()
	}, [setPlayList])
	return { playlists, setPlayList }
}
export const useTracksLoading = () => {
	return useLibraryStore((state) => state.isLoading)
}
