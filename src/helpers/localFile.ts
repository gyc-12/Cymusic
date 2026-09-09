import RNFS from 'react-native-fs'

type UnresolvedReason =
	| 'invalid'
	| 'missing'
	| 'ambiguous'
	| 'not-file'
	| 'outside-container'
	| 'unowned'
	| 'unsafe-path'
	| 'unreadable'

export type LocalFileResult =
	| { status: 'nonlocal' }
	| { status: 'unresolved'; reason: UnresolvedReason }
	| { status: 'resolved'; filePath: string; fileUri: string; relocated: boolean }

type LocalRoot = {
	filePath: string
	domain: 'Documents' | 'Library'
	ancestry?: string
}

const uuid = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}'
const containerRoot = new RegExp(`^(.*/Containers/Data/Application/)${uuid}/(Documents|Library)$`)
const containerFile = new RegExp(`^${uuid}/(Documents|Library)/(.+)$`)
const ownedMediaDirectories = ['importedLocalMusic/', 'download/music/', 'musicCache/']

// iOS exposes both aliases. Keep the native spelling for I/O and normalize only comparisons.
const comparablePath = (filePath: string) => filePath.replace(/^\/private\/var\//, '/var/')

const isFilePath = (filePath: string) =>
	filePath.startsWith('/') &&
	!filePath.includes('\\') &&
	![...filePath].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) &&
	filePath
		.slice(1)
		.split('/')
		.every((part) => part.length > 0 && part !== '.' && part !== '..')

const fileUriFromPath = (filePath: string) =>
	`file://${filePath.split('/').map(encodeURIComponent).join('/')}`

function parseLocalFile(
	value: unknown,
):
	| { status: 'paths'; paths: string[] }
	| { status: 'nonlocal' }
	| { status: 'unresolved'; reason: 'invalid' } {
	if (typeof value !== 'string' || !value) return { status: 'nonlocal' }
	if (value.startsWith('/')) {
		// A raw filesystem path containing %23 names a literal %23 file, never a # file.
		return isFilePath(value)
			? { status: 'paths', paths: [value] }
			: { status: 'unresolved', reason: 'invalid' }
	}
	if (!/^file:/i.test(value)) return { status: 'nonlocal' }

	// Only this duplicate scheme was produced by the existing cache-import branch.
	const uri = /^file:\/\/file:\/\/\//i.test(value) ? value.slice('file://'.length) : value
	if (!/^file:\/\/\//i.test(uri)) return { status: 'unresolved', reason: 'invalid' }
	const literalPath = uri.slice('file://'.length)
	if (/%2f|%5c/i.test(literalPath)) return { status: 'unresolved', reason: 'invalid' }
	try {
		// Legacy URIs were sometimes made by concatenation. Check both interpretations;
		// do not parse away raw #/? filenames or decode a percent escape a second time.
		const decodedPath = decodeURIComponent(literalPath)
		const paths = [...new Set([decodedPath, literalPath])]
		return paths.every(isFilePath)
			? { status: 'paths', paths }
			: { status: 'unresolved', reason: 'invalid' }
	} catch {
		return { status: 'unresolved', reason: 'invalid' }
	}
}

function getNativeRoot(directory: string, domain: LocalRoot['domain']): LocalRoot | undefined {
	if (typeof directory !== 'string') return undefined
	const filePath = directory.replace(/\/+$/, '')
	if (!isFilePath(filePath)) return undefined
	const match = comparablePath(filePath).match(containerRoot)
	return { filePath, domain, ancestry: match?.[2] === domain ? match[1] : undefined }
}

function getRelativePath(filePath: string, root: LocalRoot): string | undefined {
	const prefix = `${comparablePath(root.filePath)}/`
	const path = comparablePath(filePath)
	return path.startsWith(prefix) ? path.slice(prefix.length) : undefined
}

function getRelocatedPath(filePath: string, roots: LocalRoot[]): string | undefined {
	const path = comparablePath(filePath)
	for (const root of roots) {
		if (!root.ancestry || !path.startsWith(root.ancestry)) continue
		const match = path.slice(root.ancestry.length).match(containerFile)
		if (!match || match[1] !== root.domain) continue
		const suffix = match[2]
		// ImagePicker is the known persisted Library cover producer. Audio/fixture
		// addresses may use the complete Documents tree; deletion is narrower below.
		if (root.domain === 'Library' && !suffix.startsWith('Caches/ImagePicker/')) continue
		return `${root.filePath}/${suffix}`
	}
	return undefined
}

async function existingFiles(paths: string[]) {
	const files = await Promise.all(
		paths.map(async (filePath) => {
			if (!(await RNFS.exists(filePath))) return null
			const stat = await RNFS.stat(filePath)
			return { filePath, isFile: stat.isFile() }
		}),
	)
	return files.filter((file): file is NonNullable<typeof file> => file !== null)
}

async function hasPlainDirectories(filePath: string, root: LocalRoot): Promise<boolean> {
	const relativePath = getRelativePath(filePath, root)
	if (!relativePath) return false
	let directory = root.filePath
	// RNFS's iOS stat distinguishes directories from symbolic links. Check the
	// ancestry inside our root so a linked subdirectory cannot redirect deletion.
	for (const part of ['', ...relativePath.split('/').slice(0, -1)]) {
		if (part) directory += `/${part}`
		if (!(await RNFS.stat(directory)).isDirectory()) return false
	}
	return true
}

/** Resolve a persisted media address without moving files or changing stored records. */
export async function resolveLocalFile(
	value: unknown,
	options: { requireOwnedMedia?: boolean } = {},
): Promise<LocalFileResult> {
	const parsed = parseLocalFile(value)
	if (parsed.status !== 'paths') return parsed
	try {
		const roots = [
			getNativeRoot(RNFS.DocumentDirectoryPath, 'Documents'),
			getNativeRoot(RNFS.LibraryDirectoryPath, 'Library'),
		].filter((root): root is LocalRoot => root !== undefined)
		let files = await existingFiles(parsed.paths)
		let relocated = false
		if (!files.length) {
			const candidates = [
				...new Set(
					parsed.paths
						.map((filePath) => getRelocatedPath(filePath, roots))
						.filter((filePath): filePath is string => filePath !== undefined),
				),
			]
			if (!candidates.length) return { status: 'unresolved', reason: 'outside-container' }
			files = await existingFiles(candidates)
			relocated = true
		}
		if (!files.length) return { status: 'unresolved', reason: 'missing' }
		if (files.length > 1) return { status: 'unresolved', reason: 'ambiguous' }
		const file = files[0]
		if (!file.isFile) return { status: 'unresolved', reason: 'not-file' }
		const root = roots.find((candidate) => getRelativePath(file.filePath, candidate) !== undefined)
		if (options.requireOwnedMedia) {
			const suffix = root && getRelativePath(file.filePath, root)
			if (
				root?.domain !== 'Documents' ||
				!ownedMediaDirectories.some((directory) => suffix?.startsWith(directory))
			) {
				return { status: 'unresolved', reason: 'unowned' }
			}
		}
		if (
			(relocated || options.requireOwnedMedia) &&
			(!root || !(await hasPlainDirectories(file.filePath, root)))
		) {
			return { status: 'unresolved', reason: 'unsafe-path' }
		}
		return {
			status: 'resolved',
			filePath: file.filePath,
			fileUri: fileUriFromPath(file.filePath),
			relocated,
		}
	} catch {
		// An I/O failure cannot establish absence or disambiguate filename semantics.
		return { status: 'unresolved', reason: 'unreadable' }
	}
}
