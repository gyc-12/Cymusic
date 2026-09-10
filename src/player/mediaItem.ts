import type { MediaItem } from '@rntp/player'
import type { Track } from './types'

export type NativeTrackIdentity = {
	id: string
	platform: string
	token: string
	placeholder: boolean
}

export function getNativeTrackIdentity(item: MediaItem | null | undefined): NativeTrackIdentity | null {
	const identity = item?.extras?.cymusic
	if (!identity || typeof identity !== 'object') return null
	const value = identity as Partial<NativeTrackIdentity>
	return typeof value.id === 'string' &&
		typeof value.platform === 'string' &&
		typeof value.token === 'string' &&
		typeof value.placeholder === 'boolean'
		? value as NativeTrackIdentity
		: null
}

function requireMediaUri(value: unknown): string {
	// Bare names become asset:// in RNTP. Missing assets can fatalError on iOS;
	// only send resolved URLs (including the bundled silent file's resolved URI).
	if (typeof value !== 'string' || !value || value.trim() !== value || /%(?![\da-f]{2})/i.test(value)) {
		throw new Error('INVALID_SOURCE')
	}
	try {
		const url = new URL(value)
		if (url.protocol === 'asset:' || (url.protocol === 'file:' && !value.startsWith('file:///'))) {
			throw new Error('INVALID_SOURCE')
		}
		return value
	} catch {
		throw new Error('INVALID_SOURCE')
	}
}

/** Keep source URL/headers in the app record; native getters do not retain headers. */
export function toMediaItem(track: Track, token: string, placeholder = false): MediaItem {
	const uri = requireMediaUri(track.url)
	const identity: NativeTrackIdentity = {
		id: String(track.id),
		platform: track.platform ?? '',
		token,
		placeholder,
	}
	const headers = { ...track.headers }
	if (track.userAgent && !Object.keys(headers).some((key) => key.toLowerCase() === 'user-agent')) {
		headers['User-Agent'] = track.userAgent
	}
	return {
		mediaId: placeholder ? `cymusic:placeholder:${token}` : `cymusic:${JSON.stringify([identity.platform, identity.id])}`,
		url: Object.keys(headers).length ? { uri, headers } : uri,
		title: track.title,
		artist: track.artist,
		albumTitle: track.album,
		artworkUrl: track.artwork?.trim() || undefined,
		duration: Number.isFinite(track.duration) && track.duration >= 0 ? track.duration : undefined,
		isLive: track.isLiveStream,
		mimeType: track.contentType,
		extras: { cymusic: identity },
	}
}
