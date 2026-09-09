// Shared native boundaries for the standalone filesystem checks. Production TypeScript
// and Expo's installed DownloadResumable implementation execute without an app runtime.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

export const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const projectRequire = createRequire(path.join(projectRoot, 'package.json'))
const fsp = fs.promises
export const uri = (filePath) => pathToFileURL(filePath).href
const rawPath = (address) => (address.startsWith('file:') ? fileURLToPath(address) : address)
export const item = (id, url, extra = {}) => ({
	id,
	url,
	platform: 'local',
	title: 'Fixture',
	artist: 'Fixture artist',
	album: 'Regression',
	duration: 15,
	artwork: 'https://example.test/cover.png',
	...extra,
})
export const deepFreeze = (value) => {
	if (value && typeof value === 'object') {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}
export const deferred = () => {
	let resolve
	const promise = new Promise((done) => {
		resolve = done
	})
	return { promise, resolve }
}
export const write = async (filePath, content = filePath) => {
	await fsp.mkdir(path.dirname(filePath), { recursive: true })
	await fsp.writeFile(filePath, content)
}
export const exists = async (filePath) => {
	try {
		await fsp.lstat(filePath)
		return true
	} catch (error) {
		if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return false
		throw error
	}
}

export function createFixture() {
	const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cymusic-file-system-'))
	const device = 'C1AE4D08-E48F-4FB1-ADD3-5519A312BA8E'
	const oldId = '7271300E-93A5-46F8-8F63-94CCA3D6D1B9'
	const newId = 'DF61442C-A0BF-4991-AD9E-59E25D117025'
	const ancestry = `${temporary}/CoreSimulator/Devices/${device}/data/Containers/Data/Application/`
	const documents = `${ancestry}${newId}/Documents`
	const library = `${ancestry}${newId}/Library`
	const oldDocuments = `${ancestry}${oldId}/Documents`
	const oldLibrary = `${ancestry}${oldId}/Library`
	fs.mkdirSync(documents, { recursive: true })
	fs.mkdirSync(`${library}/Caches`, { recursive: true })

	function runtime({ realCache = false } = {}) {
		const calls = {
			fs: [],
			deletes: [],
			moves: [],
			writes: [],
			timers: [],
			errors: [],
			info: [],
			alerts: [],
			toasts: [],
			cache: [],
			mmkv: [],
			downloads: [],
			cancellations: [],
			temporaryDeletes: [],
			text: [],
			plays: 0,
		}
		const hooks = {}
		const disk = new Map()
		const reads = new Map()
		const state = (initial = null) => {
			let value = initial
			return {
				getValue: () => value,
				setValue: (next) => {
					value = next
				},
				useValue: () => value,
			}
		}
		const storeNames = [
			'currentMusicStore',
			'playListsStore',
			'repeatModeStore',
			'qualityStore',
			'musicApiStore',
			'musicApiSelectedStore',
			'nowApiState',
			'autoCacheLocalStore',
			'isCachedIconVisibleStore',
			'songsNumsToLoadStore',
			'importedLocalMusicStore',
			'nowLyricState',
			'trackSkipLoadingStore',
			'trackSourceLoadingStore',
		]
		const stores = Object.fromEntries(storeNames.map((name) => [name, state()]))
		stores.qualityStore.setValue('128k')
		stores.repeatModeStore.setValue('queue')
		const persistence = {
			get: (key) => {
				const value = disk.has(key) ? JSON.parse(disk.get(key)) : null
				reads.set(key, value)
				return value
			},
			set: (key, value) => {
				calls.writes.push({ key, value })
				if (value === undefined) disk.delete(key)
				else disk.set(key, JSON.stringify(value))
			},
		}
		const nativeFs = {
			documentDirectoryPath: documents,
			libraryDirectoryPath: library,
			cachesDirectoryPath: `${library}/Caches`,
			exists: async (filePath) => {
				calls.fs.push({ operation: 'exists', filePath })
				if (hooks.exists) await hooks.exists(filePath)
				return exists(filePath)
			},
			stat: async (filePath) => {
				calls.fs.push({ operation: 'stat', filePath })
				if (hooks.stat) await hooks.stat(filePath)
				const info = await fsp.lstat(filePath)
				return info.isFile()
					? 'file'
					: info.isDirectory()
						? 'directory'
						: info.isSymbolicLink()
							? 'symlink'
							: 'other'
			},
		}
		const progressListeners = new Set()
		const legacyNative = {
			documentDirectory: uri(documents),
			cacheDirectory: uri(`${library}/Caches`),
			getInfoAsync: async (address) => {
				try {
					const info = await fsp.stat(rawPath(address))
					return { exists: true, isDirectory: info.isDirectory(), size: info.size }
				} catch (error) {
					if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return { exists: false }
					throw error
				}
			},
			makeDirectoryAsync: async (address, options) =>
				fsp.mkdir(rawPath(address), { recursive: options.intermediates }),
			deleteAsync: async (address, options = {}) => {
				calls.deletes.push(address)
				assert(address.startsWith('file:///'), 'Deletion must use one local URI scheme')
				if (hooks.delete) await hooks.delete(address)
				await fsp.rm(fileURLToPath(address), { recursive: true, force: !!options.idempotent })
			},
			moveAsync: async (options) => {
				calls.moves.push(options)
				await fsp.rename(rawPath(options.from), rawPath(options.to))
			},
			addListener: (event, listener) => {
				assert.equal(event, 'expo-file-system.downloadProgress')
				progressListeners.add(listener)
				return { remove: () => progressListeners.delete(listener) }
			},
			downloadResumableStartAsync: async (url, fileUri, uuid, options) => {
				const request = { url, fileUri, uuid, options }
				calls.downloads.push(request)
				assert(hooks.download, 'Unexpected native download')
				return hooks.download({
					...request,
					progress: (data) => progressListeners.forEach((listener) => listener({ uuid, data })),
				})
			},
			networkTaskCancelAsync: async (uuid) => {
				calls.cancellations.push(uuid)
				if (hooks.cancel) await hooks.cancel(uuid)
			},
		}
		class File {
			constructor(...parts) {
				this.uri = parts.map((part) => (typeof part === 'string' ? part : part.uri)).join('/')
			}
			async move(destination, options) {
				calls.moves.push({ from: this.uri, to: destination.uri, options })
				if (hooks.move) await hooks.move(this, destination)
				assert.equal(options.overwrite, true)
				if (await exists(rawPath(destination.uri))) await fsp.unlink(rawPath(destination.uri))
				await fsp.rename(rawPath(this.uri), rawPath(destination.uri))
				this.uri = destination.uri // The installed Expo File mutates this property after moving.
			}
			delete() {
				calls.temporaryDeletes.push(this.uri)
				if (hooks.temporaryDelete) hooks.temporaryDelete(this.uri)
				fs.unlinkSync(rawPath(this.uri))
			}
			async text() {
				calls.text.push(this.uri)
				if (hooks.text) return hooks.text(this.uri)
				return fsp.readFile(rawPath(this.uri), 'utf8')
			}
		}
		const expoFs = {
			File,
			Paths: {
				cache: { uri: uri(`${library}/Caches`) },
				info: (address) => ({ exists: fs.existsSync(rawPath(address)) }),
			},
		}
		let queue = []
		const sameItem = (a, b) => !!a && !!b && a.id === b.id && a.platform === b.platform
		const queueOwner = {
			getPlayList: () => queue,
			getPlayListMusicAt: (index) => queue[index],
			getMusicIndex: (track) => queue.findIndex((entry) => sameItem(entry, track)),
			isInPlayList: (track) => queue.some((entry) => sameItem(entry, track)),
			isPlayListEmpty: () => queue.length === 0,
			usePlayList: () => queue,
			setPlayList: (tracks) => {
				queue = tracks
				persistence.set('music.play-list', tracks)
			},
		}
		const player = {
			queue: [],
			setRate: async () => {},
			addEventListener: () => ({ remove() {} }),
			setQueue: async (tracks) => {
				player.queue = tracks
			},
			play: async () => {
				calls.plays++
			},
			pause: async () => {},
			getTrack: async (index) => player.queue[index],
			getActiveTrackIndex: async () => 0,
			getPlaybackState: async () => ({ state: 'paused' }),
			seekTo: async () => {},
			getProgress: async () => ({ position: 0 }),
			getRate: async () => 1,
			reset: async () => {
				player.queue = []
			},
			usePlaybackState: () => ({}),
			useProgress: () => ({}),
			Event: { PlaybackActiveTrackChanged: 'track', PlaybackError: 'error' },
			State: { Playing: 'playing', Stopped: 'stopped' },
		}
		const cache = {
			isCached: async (track) => {
				calls.cache.push(track.id)
				return false
			},
			getLocalFilePath: () => uri(`${documents}/musicCache/cache-id.mp3`),
			getCacheFileUri: (localPath) => localPath,
			ensureDirExists: async (directory) => fsp.mkdir(directory, { recursive: true }),
			ensureCacheDirExists: async () => fsp.mkdir(`${documents}/musicCache`, { recursive: true }),
			downloadToCache: async () => {
				throw new Error('Unexpected automatic download')
			},
			clearCache: async () => {
				throw new Error('Unexpected cache clearing')
			},
		}
		const logger = {
			logInfo: (...args) => calls.info.push(args),
			logError: (...args) => calls.errors.push(args),
		}
		const overrides = {
			expo: {
				requireNativeModule: (name) => {
					assert.equal(name, 'CyMusicFileSystem')
					return nativeFs
				},
			},
			'expo-modules-core': { uuid: { v4: randomUUID }, UnavailabilityError: Error },
			'expo-file-system': expoFs,
			'react-native-track-player': player,
			'@/player/PlayerStore': stores,
			'@/store/PersistStatus': persistence,
			'@/helpers/logger': logger,
			'react-native-mmkv': {
				createMMKV: (options) => {
					calls.mmkv.push(options)
					return { ...options }
				},
			},
			'@/constants/images': { fakeAudioMp3Uri: 'fixture://fake-audio.mp3' },
			'@/constants/commonConst': {
				internalFakeSoundKey: 'fake',
				sortIndexSymbol: Symbol('index'),
				timeStampSymbol: Symbol('time'),
			},
			'@/constants/constant': { SoundAsset: { fakeAudio: 1 } },
			'@/store/config': { set() {} },
			'@/utils/delay': async () => {},
			'@/utils/mediaItem': {
				isSameMediaItem: sameItem,
				mergeProps: (a, b) => ({ ...a, ...b }),
				sortByTimestampAndIndex: (tracks) => tracks,
			},
			'@/store/playList': queueOwner,
			'@/helpers/types': {
				MusicRepeatMode: { QUEUE: 'queue', SINGLE: 'single', SHUFFLE: 'shuffle' },
			},
			'@/utils/mediaIndexMap': {
				createMediaIndexMap: () => {
					throw new Error('Unused index-map boundary')
				},
			},
			'@/utils/trackUtils': { musicIsPaused: () => true },
			'react-native': {
				Platform: { OS: 'ios' },
				Alert: { alert: (...args) => calls.alerts.push(args) },
				AppState: { currentState: 'active' },
				Image: { resolveAssetSource: () => ({ uri: 'fixture://fake-audio.mp3' }) },
			},
			'@/helpers/userApi/getMusicSource': { myGetLyric: async () => ({ lyric: 'fixture' }) },
			'@/utils/i18n': { nowLanguage: state('en') },
			'@/utils/utils': { showToast: (...args) => calls.toasts.push(args) },
			'@/helpers/userApi/lxMusicSourceAdapter': {
				isLxMusicScript: () => false,
				reloadLxMusicScript: async (api) => api,
			},
		}
		if (!realCache) overrides['@/player/CacheManager'] = cache
		const modules = new Map()
		const globals = {}
		function load(relativeFile) {
			let filename = path.resolve(projectRoot, relativeFile)
			if (fs.existsSync(`${filename}.ts`)) filename += '.ts'
			else if (fs.existsSync(filename) && fs.statSync(filename).isDirectory())
				filename = path.join(filename, 'index.ts')
			if (modules.has(filename)) return modules.get(filename).exports
			const module = { exports: {} }
			modules.set(filename, module)
			const source = fs.readFileSync(filename, 'utf8')
			const compiled = ts.transpileModule(source, {
				compilerOptions: {
					target: ts.ScriptTarget.ES2022,
					module: ts.ModuleKind.CommonJS,
					esModuleInterop: true,
				},
			}).outputText
			const imported = (specifier) => {
				if (specifier === 'expo-file-system/legacy')
					return load('node_modules/expo-file-system/src/legacy/index.ts')
				const absolute = specifier.startsWith('.')
					? path.resolve(path.dirname(filename), specifier)
					: specifier.startsWith('@/')
						? path.resolve(projectRoot, 'src', specifier.slice(2))
						: undefined
				if (
					absolute ===
					path.resolve(projectRoot, 'node_modules/expo-file-system/src/legacy/ExponentFileSystem')
				)
					return legacyNative
				const key = absolute
					? `@/${path.relative(path.join(projectRoot, 'src'), absolute).replaceAll(path.sep, '/')}`
					: specifier
				if (Object.hasOwn(overrides, key)) return overrides[key]
				if (absolute) return load(absolute)
				if (specifier === 'immer' || specifier === 'lodash.shuffle')
					return projectRequire(specifier)
				throw new Error(`Unexpected import ${specifier} from ${relativeFile}`)
			}
			new Function(
				'require',
				'module',
				'exports',
				'setTimeout',
				'clearTimeout',
				'console',
				'global',
				compiled,
			)(
				imported,
				module,
				module.exports,
				(callback, delay) => {
					calls.timers.push({ callback, delay })
					return calls.timers.length
				},
				() => {},
				{ log() {}, warn() {} },
				globals,
			)
			return module.exports
		}
		return {
			calls,
			hooks,
			disk,
			reads,
			stores,
			persistence,
			nativeFs,
			player,
			cache,
			load,
			progressListeners,
			expoFs,
		}
	}
	return {
		temporary,
		device,
		oldId,
		newId,
		documents,
		library,
		oldDocuments,
		oldLibrary,
		runtime,
		dispose: () => fsp.rm(temporary, { recursive: true, force: true }),
	}
}
