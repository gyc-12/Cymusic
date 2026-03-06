import { useThemeColors } from '@/hooks/useAppTheme'
import { useEffect, useRef, useState } from 'react'
import { getColors } from 'react-native-image-colors'
import { IOSImageColors } from 'react-native-image-colors/build/types'

const colorCache = new Map<string, IOSImageColors>()

export const usePlayerBackground = (imageUrl: string) => {
	const colors = useThemeColors()
	const [imageColors, setImageColors] = useState<IOSImageColors | null>(
		() => colorCache.get(imageUrl) ?? null,
	)
	const urlRef = useRef(imageUrl)

	useEffect(() => {
		urlRef.current = imageUrl

		const cached = colorCache.get(imageUrl)
		if (cached) {
			setImageColors(cached)
			return
		}

		getColors(imageUrl, {
			fallback: colors.background,
			cache: true,
			key: imageUrl,
		}).then((result) => {
			const iosColors = result as IOSImageColors
			colorCache.set(imageUrl, iosColors)
			if (colorCache.size > 50) {
				const firstKey = colorCache.keys().next().value
				if (firstKey) colorCache.delete(firstKey)
			}
			if (urlRef.current === imageUrl) {
				setImageColors(iosColors)
			}
		})
	}, [colors.background, imageUrl])

	return { imageColors }
}
