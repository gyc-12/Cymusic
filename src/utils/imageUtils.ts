/**
 * Rewrite QQ Music artwork URL to use a smaller resolution for list thumbnails.
 * Original URLs use T002R800x800M000 or T002R500x500M000 which are overkill for 50x50pt cells.
 */
export function getThumbnailArtwork(artworkUrl: string | undefined, size: 150 | 300 = 150): string | undefined {
	if (!artworkUrl) return artworkUrl
	return artworkUrl
		.replace(/T002R800x800M000/, `T002R${size}x${size}M000`)
		.replace(/T002R500x500M000/, `T002R${size}x${size}M000`)
}

export function getFullArtwork(artworkUrl: string | undefined): string | undefined {
	if (!artworkUrl) return artworkUrl
	return artworkUrl
		.replace(/T002R150x150M000/, 'T002R500x500M000')
		.replace(/T002R300x300M000/, 'T002R500x500M000')
}
