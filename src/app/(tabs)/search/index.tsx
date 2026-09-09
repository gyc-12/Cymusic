import { SearchList } from '@/components/SearchList'
import { ThemeColors } from '@/constants/tokens'
import { useThemeColors } from '@/hooks/useAppTheme'
import searchAll from '@/helpers/searchAll'
import { useNavigationSearch } from '@/hooks/useNavigationSearch'
import i18n from '@/utils/i18n'
import debounce from 'lodash/debounce'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	Animated,
	Dimensions,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Track } from 'react-native-track-player'

type SearchType = 'songs' | 'artists'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const SEGMENT_WIDTH = (SCREEN_WIDTH - 32 - 4) / 2 // 32 for padding, 4 for container padding

const SearchlistsScreen = () => {
	const colors = useThemeColors()
	const styles = useMemo(() => createStyles(colors), [colors])
	// const router = useRouter()
	const [searchResults, setSearchResults] = useState<Track[]>([])
	const [page, setPage] = useState(1)
	const [isLoading, setIsLoading] = useState(false)
	const [hasMore, setHasMore] = useState(true)
	const searchRequestRef = useRef(0)
	const [searchType, setSearchType] = useState<SearchType>('songs')
	const slideAnim = useRef(new Animated.Value(0)).current
	const search = useNavigationSearch({
		searchBarOptions: {
			placeholder: i18n.t('find.inSearch'),
			cancelButtonText: i18n.t('find.cancel'),
		},
	})

	const fetchSearchResults = useCallback(
		async (currentPage: number) => {
			if (!search) {
				return
			}

			const requestId = ++searchRequestRef.current
			setIsLoading(true)

			try {
				const { data, hasMore: moreResults } = await searchAll(search, currentPage, searchType)

				if (requestId === searchRequestRef.current) {
					setHasMore(moreResults)
					setSearchResults((prevResults) => {
						const newResults = currentPage === 1 ? data : [...prevResults, ...data]

						return newResults
					})

					setPage(currentPage)
				}
			} catch (error) {
				console.error('Error fetching search results:', error)
			} finally {
				if (requestId === searchRequestRef.current) {
					setIsLoading(false)
				}
			}
		},
		[search, searchType],
	)
	const debouncedFetchSearchResults = useRef(
		debounce((currentPage: number) => {
			fetchSearchResults(currentPage)
		}, 300),
	).current

	useEffect(() => {
		debouncedFetchSearchResults.cancel()
	}, [search])
	useEffect(() => {
		setPage(1)
		setHasMore(true)
		setSearchResults([])
		searchRequestRef.current++

		if (search === '') {
			setIsLoading(false)
			setHasMore(false)
			setSearchResults([])
		} else if (search) {
			fetchSearchResults(1)
		}

		return () => {
			searchRequestRef.current++
		}
	}, [search, searchType, fetchSearchResults])

	const handleLoadMore = useCallback(() => {
		if (!isLoading && hasMore && search) {
			fetchSearchResults(page + 1)
		}
	}, [isLoading, hasMore, page, fetchSearchResults, search])

	const handleSearchTypeChange = (type: SearchType) => {
		const toValue = type === 'songs' ? 0 : SEGMENT_WIDTH
		Animated.spring(slideAnim, {
			toValue,
			useNativeDriver: true,
			tension: 100,
			friction: 10,
		}).start()
		setSearchType(type)
	}

	return (
		<SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
			<View style={styles.contentContainer}>
				<View style={styles.segmentedControlContainer}>
					<View style={styles.segmentedControl}>
						<Animated.View
							style={[
								styles.activeSegment,
								{
									position: 'absolute',
									width: SEGMENT_WIDTH,
									transform: [{ translateX: slideAnim }],
								},
							]}
						/>
						<Pressable
							style={[styles.segment, { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]}
							onPress={() => handleSearchTypeChange('songs')}
						>
							<Text
								style={[styles.segmentText, searchType === 'songs' && styles.activeSegmentText]}
							>
								{i18n.t('find.songs')}
							</Text>
						</Pressable>
						<Pressable
							style={[styles.segment, { borderTopRightRadius: 8, borderBottomRightRadius: 8 }]}
							onPress={() => handleSearchTypeChange('artists')}
						>
							<Text
								style={[styles.segmentText, searchType === 'artists' && styles.activeSegmentText]}
							>
								{i18n.t('find.artists')}
							</Text>
						</Pressable>
					</View>
				</View>
				<SearchList
					tracks={searchResults}
					id={'search'}
					onLoadMore={handleLoadMore}
					hasMore={hasMore}
					isLoading={isLoading}
				/>
			</View>
		</SafeAreaView>
	)
}

const createStyles = (colors: ThemeColors) =>
	StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: colors.background,
	},
	safeArea: {
		flex: 1,
		backgroundColor: colors.background,
	},
	contentContainer: {
		flex: 1,
		backgroundColor: colors.background,
		paddingTop: 8,
	},
	segmentedControlContainer: {
		paddingHorizontal: 16,
		marginTop: 0,
		paddingBottom: 4,
	},
	segmentedControl: {
		flexDirection: 'row',
		backgroundColor: colors.surfaceMuted,
		borderRadius: 8,
		padding: 2,
		position: 'relative',
	},
	segment: {
		flex: 1,
		paddingVertical: 6,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 1,
	},
	activeSegment: {
		backgroundColor: colors.surfaceElevated,
		borderRadius: 6,
		shadowColor: colors.shadow,
		shadowOffset: {
			width: 0,
			height: 1,
		},
		shadowOpacity: 0.15,
		shadowRadius: 2,
		elevation: 2,
		position: 'absolute',
		top: 2,
		bottom: 2,
		zIndex: 0,
	},
	segmentText: {
		fontSize: 15,
		color: colors.textMuted,
	},
	activeSegmentText: {
		color: colors.primary,
		fontWeight: '500',
	},
	})

export default SearchlistsScreen
