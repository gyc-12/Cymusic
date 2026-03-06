import { useThemeColors } from '@/hooks/useAppTheme'
import { nowLanguage } from '@/utils/i18n'
import { useNavigation } from 'expo-router'
import { debounce } from 'lodash'
import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { SearchBarProps } from 'react-native-screens'

export const useNavigationSearch = ({
	searchBarOptions,
	onFocus,
	onBlur,
	onCancel,
}: {
	searchBarOptions?: SearchBarProps
	onFocus?: () => void
	onBlur?: () => void
	onCancel?: () => void
}) => {
	const [search, setSearch] = useState('')
	const navigation = useNavigation()
	const language = nowLanguage.useValue()
	const colors = useThemeColors()

	const defaultSearchOptions = useMemo<SearchBarProps>(
		() => ({
			tintColor: colors.primary,
			barTintColor: colors.background,
			backgroundColor: colors.surfaceMuted,
			textColor: colors.text,
			hintTextColor: colors.placeholder,
			hideWhenScrolling: false,
		}),
		[colors],
	)

	const debouncedSetSearch = useCallback(
		debounce((text) => {
			setSearch(text)
		}, 400),
		[],
	)

	const handleOnChangeText: SearchBarProps['onChangeText'] = ({ nativeEvent: { text } }) => {
		debouncedSetSearch(text)
	}

	useLayoutEffect(() => {
		navigation.setOptions({
			headerSearchBarOptions: {
				...defaultSearchOptions,
				...searchBarOptions,
				onChangeText: handleOnChangeText,
				onFocus: onFocus,
				onBlur: onBlur,
				onCancelButtonPress: (e) => {
					onCancel?.()
					searchBarOptions?.onCancelButtonPress?.(e)
				},
			},
		})
	}, [defaultSearchOptions, language, navigation, onBlur, onCancel, onFocus, searchBarOptions])

	return search
}
