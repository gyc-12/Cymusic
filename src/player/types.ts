/** CyMusic's library/display record. Native MediaItem is only a transport projection. */
export interface Track extends Partial<IMusic.IMusicItem> {
	id: string
	headers?: Record<string, string>
	userAgent?: string
	isLiveStream?: boolean
	contentType?: string
}
