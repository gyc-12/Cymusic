import { useEffect, useState } from 'react'
import { getColors, type ImageColorsResult } from 'react-native-image-colors'

const FALLBACK_BACKGROUND = '#191b20'
const MAX_CACHED_COLORS = 50
const MAX_BACKGROUND_LUMINANCE = 0.1

const colorCache = new Map<string, string>()

type Palette = { imageUrl: string; backgroundColor: string }

const relativeLuminance = (channels: number[]) => {
	const linear = channels.map((channel) => {
		const value = channel / 255
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
	})
	return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

const playerBackgroundFrom = (result: ImageColorsResult): string => {
	let swatch: string
	switch (result.platform) {
		case 'ios':
			// iOS primary is a contrasting foreground color, not the cover's hue.
			swatch = result.background
			break
		case 'android':
		case 'web':
			swatch = result.dominant
			break
		default:
			return FALLBACK_BACKGROUND
	}
	if (typeof swatch !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(swatch)) {
		return FALLBACK_BACKGROUND
	}
	const hex =
		swatch.length === 4
			? swatch
					.slice(1)
					.split('')
					.map((channel) => channel + channel)
					.join('')
			: swatch.slice(1)
	const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16))
	let scale = 1
	if (relativeLuminance(channels) > MAX_BACKGROUND_LUMINANCE) {
		// Scale RGB together to preserve hue while keeping white controls legible.
		let lower = 0
		let upper = 1
		for (let step = 0; step < 12; step++) {
			const candidate = (lower + upper) / 2
			if (
				relativeLuminance(channels.map((channel) => channel * candidate)) > MAX_BACKGROUND_LUMINANCE
			) {
				upper = candidate
			} else {
				lower = candidate
			}
		}
		scale = lower
	}
	return (
		'#' +
		channels
			.map((channel) =>
				Math.floor(channel * scale)
					.toString(16)
					.padStart(2, '0'),
			)
			.join('')
	)
}

export const usePlayerBackground = (imageUrl: string) => {
	const [palette, setPalette] = useState<Palette | null>(null)
	// Associate a result with its URI during render, before the next effect runs.
	const backgroundColor =
		palette?.imageUrl === imageUrl
			? palette.backgroundColor
			: colorCache.get(imageUrl) ?? FALLBACK_BACKGROUND

	useEffect(() => {
		const cached = colorCache.get(imageUrl)
		if (cached) {
			colorCache.delete(imageUrl)
			colorCache.set(imageUrl, cached)
			setPalette({ imageUrl, backgroundColor: cached })
			return
		}
		if (!imageUrl) {
			setPalette({ imageUrl, backgroundColor: FALLBACK_BACKGROUND })
			return
		}

		let active = true
		const loadPalette = async () => {
			try {
				const result = await getColors(imageUrl, {
					fallback: FALLBACK_BACKGROUND,
					// Keep a single bounded cache; the library's own cache is unbounded.
					cache: false,
				})
				if (!active) return
				const nextColor = playerBackgroundFrom(result)
				colorCache.set(imageUrl, nextColor)
				if (colorCache.size > MAX_CACHED_COLORS) {
					const oldest = colorCache.keys().next().value
					if (oldest !== undefined) colorCache.delete(oldest)
				}
				setPalette({ imageUrl, backgroundColor: nextColor })
			} catch {
				if (active) setPalette({ imageUrl, backgroundColor: FALLBACK_BACKGROUND })
			}
		}
		void loadPalette()
		return () => {
			active = false
		}
	}, [imageUrl])

	return { backgroundColor }
}
