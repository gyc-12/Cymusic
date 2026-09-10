// helpers/searchAll.ts

import { searchArtist, searchMusic } from '@/helpers/userApi/xiaoqiu'
import type { Track } from '@/player/types'

const PAGE_SIZE = 20

type SearchType = 'songs' | 'artists'

const searchAll = async (
	searchText: string,
	page: number = 1,
	type: SearchType = 'songs',
): Promise<{ data: Track[]; hasMore: boolean }> => {
	console.log('search text+++', searchText, 'page:', page, 'type:', type)

	let result
	if (type === 'songs') {
		console.log('search song')
		result = await searchMusic(searchText, page, PAGE_SIZE)
	} else {
		console.log('search artist')
		result = await searchArtist(searchText, page)
		// console.log('search result', result)
		// Transform artist results to Track format
		result.data = result.data.map((artist) => ({
			id: artist.id,
			title: artist.name,
			artist: artist.name,
			artwork: artist.avatar,
			isArtist: true,
		})) as Track[]
	}

	const hasMore = result.data.length === PAGE_SIZE

	return {
		data: result.data as Track[],
		hasMore,
	}
}

export default searchAll
