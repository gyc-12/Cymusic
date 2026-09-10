// Run with the locked Node toolchain: node scripts/check-rntp-player.mjs
// Execute the production facade, MediaItem projection, service, hooks, UI and lyric
// owners. The native engine is a synchronous seam; audible/seek convergence is iOS acceptance.
import assert from 'node:assert/strict'
import { createFixture, deferred, deepFreeze, item } from './file-system-fixture.mjs'
import { flush, loadModule } from './native-services-fixture.mjs'

const fixture = createFixture()
const results = []
const check = async (name, action) => {
	try {
		await action()
		results.push({ name, passed: true })
	} catch (error) {
		results.push({ name, passed: false, error: error.stack })
	}
}
const song = (id, extra = {}) => item(id, `https://media.example/${id}.mp3`, extra)

function runtime() {
	const sourceCalls = []
	const delays = []
	const effects = []
	const stateWrites = []
	let resolveSource = async (track) => ({ url: track.url, wasCached: false })
	const react = {
		memo: (component) => component,
		useCallback: (callback) => callback,
		useMemo: (compute) => compute(),
		useRef: (value) => ({ current: value }),
		useState: (initial) => [typeof initial === 'function' ? initial() : initial, (value) => stateWrites.push(value)],
		useEffect: (effect) => effects.push(effect),
		createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.flat() } }),
	}
	const nativeViews = {
		Platform: { OS: 'ios' },
		Alert: { alert() {} },
		AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
		Image: { resolveAssetSource: () => ({ uri: 'file:///app/fake-audio.mp3' }) },
		StyleSheet: { create: (styles) => styles, absoluteFill: {} },
		View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', ActivityIndicator: 'ActivityIndicator',
	}
	const h = fixture.runtime({ moduleOverrides: {
		react,
		'react-native': nativeViews,
		'@/player/MusicSourceResolver': {
			resolveSource: (track, options) => {
				sourceCalls.push({ track, options })
				return resolveSource(track, options)
			},
			preloadSource: async () => {},
		},
		'@/utils/delay': (milliseconds) => {
			const pending = deferred()
			delays.push({ milliseconds, ...pending })
			return pending.promise
		},
		'@/hooks/useAppTheme': { useThemeColors: () => ({ text: 'white' }), useAppTheme: () => ({ blurTint: 'dark' }) },
		'@/styles': { useDefaultStyles: () => ({ text: {} }), useUtilsStyles: () => ({ slider: {} }) },
		'@/constants/tokens': { fontSize: { xs: 12 } },
		'@expo/vector-icons': { FontAwesome6: 'Icon' },
		'react-native-awesome-slider': { Slider: 'Slider' },
		'react-native-reanimated': {
			View: 'AnimatedView',
			useSharedValue: (value) => ({ value }),
			useAnimatedStyle: (compute) => compute(),
			withSpring: (value) => value,
			withTiming: (value) => value,
			Reanimated3DefaultSpringConfig: {},
		},
		'expo-image': { Image: 'Image' },
		'expo-blur': { BlurView: 'BlurView' },
		'expo-haptics': { impactAsync: async () => {}, ImpactFeedbackStyle: { Light: 'light' } },
		'expo-router': { useRouter: () => ({ navigate() {} }) },
		'@/components/MovingText': { MovingText: 'MovingText' },
	} })
	// Use the exact installed v5 enums, while isolating the actual native engine.
	Object.assign(h.player,
		h.load('node_modules/@rntp/player/src/events/index.ts'),
		h.load('node_modules/@rntp/player/src/interfaces/PlayerCommand.ts'),
		h.load('node_modules/@rntp/player/src/interfaces/RepeatMode.ts'),
	)
	const facade = h.load('src/helpers/trackPlayerIndex.ts').default
	return {
		...h, facade, react, nativeViews, effects, stateWrites, sourceCalls, delays,
		setResolver: (resolver) => { resolveSource = resolver },
		setup: () => facade.setupTrackPlayer(),
		emit: (event, payload) => h.player.emit(h.player.Event[event], payload),
		count: (name) => h.calls.player.filter((call) => call[0] === name).length,
	}
}

function findElement(node, type) {
	if (!node || typeof node !== 'object') return undefined
	if (node.type === type) return node
	for (const child of node.props?.children ?? []) {
		const found = findElement(child, type)
		if (found) return found
	}
}

await check('MediaItem keeps opaque app identity, metadata and source headers without mutating the library record', () => {
	const h = runtime()
	const { toMediaItem, getNativeTrackIdentity } = h.load('src/player/mediaItem.ts')
	const track = deepFreeze(song('file:///original/id#1', {
		url: 'https://media.example/audio?id=1', platform: 'tx',
		headers: { Authorization: 'fixture-token', 'user-agent': 'explicit-agent' },
		userAgent: 'fallback-agent', isLiveStream: true, contentType: 'audio/mpeg',
		source: { flac: { url: 'https://media.example/flac' } },
	}))
	const native = toMediaItem(track, 'queue-A')
	assert.deepEqual(native.url, { uri: track.url, headers: track.headers })
	assert.equal(native.artworkUrl, track.artwork)
	assert.equal(native.albumTitle, track.album)
	assert.equal(native.isLive, true)
	assert.equal(native.mimeType, 'audio/mpeg')
	assert.deepEqual(getNativeTrackIdentity(native), { id: track.id, platform: 'tx', token: 'queue-A', placeholder: false })
	assert.equal(native.source, undefined)
	assert.equal(native.id, undefined)
	assert.equal(native.mediaId, toMediaItem(track, 'queue-B').mediaId)
	assert.notEqual(native.mediaId, toMediaItem({ ...track, platform: 'wy' }, 'queue-A').mediaId)
	assert.notEqual(native.mediaId, toMediaItem(track, 'queue-A', true).mediaId)
	assert.equal(JSON.stringify(native.extras).includes('fixture-token'), false)
	assert.equal(toMediaItem(song('ua', { userAgent: 'app-agent' }), 'queue-A').url.headers['User-Agent'], 'app-agent')
})

await check('invalid source URLs are rejected before reaching the native fatalError path', () => {
	const { toMediaItem } = runtime().load('src/player/mediaItem.ts')
	for (const url of ['', 'Unknown', 'missing.mp3', 'asset://missing.mp3', 'file://wrong/path', 'https://%', 'https://host/%broken']) {
		assert.throws(() => toMediaItem(song('bad', { url }), 'invalid'), /INVALID_SOURCE/, url)
	}
	const url = 'file:///app/100%25%20%23%E6%AD%8C%E6%9B%B2.mp3'
	assert.equal(toMediaItem(song('local', { url }), 'local').url, url)
})

await check('application setup is once per runtime and configures hybrid business navigation before playback', async () => {
	const h = runtime()
	const { useSetupTrackPlayer } = h.load('src/hooks/useSetupTrackPlayer.tsx')
	let loaded = 0
	useSetupTrackPlayer({ onLoad: () => loaded++ })
	useSetupTrackPlayer({ onLoad: () => loaded++ })
	const cleanups = h.effects.splice(0).map((effect) => effect())
	await flush()
	assert.equal(loaded, 2)
	assert.equal(h.count('setup'), 1)
	assert.deepEqual(h.calls.player.find(([name]) => name === 'setup')[1], {
		progressSync: { intervalSeconds: 1 }, autoUpdateMetadataFromStream: false,
	})
	const commands = h.calls.player.find(([name]) => name === 'commands')[1]
	assert.equal(commands.handling, 'hybrid')
	assert.deepEqual(commands.perCommandHandling, { next: 'js', previous: 'js' })
	assert.deepEqual(new Set(commands.capabilities), new Set(['playPause', 'next', 'previous', 'stop', 'seek']))
	assert.deepEqual(h.calls.player.filter(([name]) => name === 'repeat' || name === 'shuffle'), [['repeat', 'off'], ['shuffle', false]])
	assert.equal(h.player.listenerCount(h.player.Event.MediaItemTransition), 1)
	cleanups.forEach((cleanup) => cleanup())
})

await check('remote handlers register once, route next/previous to business queue and never repeat native transport or seek', async () => {
	const h = runtime()
	await h.setup()
	const { playbackService } = h.load('src/constants/playbackService.ts')
	playbackService()
	playbackService()
	assert.equal(h.player.listenerCount(h.player.Event.RemoteNext), 1)
	const a = song('a'), b = song('b')
	h.facade.addAll([a, b])
	await h.facade.play(a)
	h.player.pause()
	h.emit('RemotePause', {})
	assert.equal(h.count('pause'), 1)
	assert.equal(h.stores.playbackIntentStore.getValue(), 'pause')
	h.player.play()
	h.emit('RemotePlay', {})
	assert.equal(h.count('play'), 2)
	h.player.seekTo(7)
	h.emit('RemoteSeek', { position: 7 })
	assert.equal(h.count('seek'), 1)
	h.player.stop()
	h.emit('RemoteStop', {})
	assert.equal(h.count('stop'), 1)
	h.emit('RemoteNext', {})
	await flush()
	assert.equal(h.facade.getCurrentMusic().id, b.id)
	h.emit('RemotePrevious', {})
	await flush()
	assert.equal(h.facade.getCurrentMusic().id, a.id)
})

await check('play button handles buffering intent and never passes a press event as a music item', async () => {
	const h = runtime()
	const { PlayPauseButton } = h.load('src/components/PlayerControls.tsx')
	const commands = []
	h.facade.play = async (...args) => { commands.push(['play', ...args]) }
	h.facade.pause = () => { commands.push(['pause']) }
	h.stores.playbackIntentStore.setValue('play')
	h.player.playing = false
	h.player.state = 'buffering'
	findElement(PlayPauseButton({}), 'TouchableOpacity').props.onPress({ nativeEvent: {} })
	assert.deepEqual(commands, [['pause']])
	h.stores.playbackIntentStore.setValue('pause')
	findElement(PlayPauseButton({}), 'TouchableOpacity').props.onPress({ nativeEvent: {} })
	await flush()
	assert.deepEqual(commands, [['pause'], ['play']])
})

await check('a native interruption that leaves Ready without output displays Play rather than a stale pause intent', () => {
	const h = runtime()
	const { PlayPauseButton } = h.load('src/components/PlayerControls.tsx')
	h.stores.playbackIntentStore.setValue('play')
	h.player.playing = false
	h.player.state = 'ready'
	assert.equal(findElement(PlayPauseButton({}), 'Icon').props.name, 'play')
})

await check('favorite display retains the library toggle owner\'s existing id comparison and uses the app record', () => {
	const h = runtime()
	const current = song('favorite', { platform: 'tx' })
	h.stores.currentMusicStore.setValue(current)
	const toggled = []
	const favorite = loadModule('src/hooks/useTrackPlayerFavorite.tsx', {
		'@/store/library': { useFavorites: () => ({ favorites: [song('favorite', { platform: 'wy' })], toggleTrackFavorite: (track) => toggled.push(track) }) },
		react: h.react,
		'@/player/PlayerStore': h.stores,
		'@/utils/mediaItem': { isSameMediaItem: (a, b) => a?.id === b?.id && a?.platform === b?.platform },
	}).useTrackPlayerFavorite()
	assert.equal(favorite.isFavorite, true)
	favorite.toggleFavorite()
	assert.deepEqual(toggled, [current])
})

await check('progress UI polls in seconds and a slider gesture sends one bounded seek command', async () => {
	const h = runtime()
	await h.facade.play(song('seek'))
	h.player.progress = { position: 20, duration: 100, buffered: 90, cached: 0 }
	const { PlayerProgressBar } = h.load('src/components/PlayerProgressbar.tsx')
	const seeks = []
	const slider = findElement(PlayerProgressBar({ onSeek: (position) => seeks.push(position) }), 'Slider')
	assert.equal(h.calls.player.find(([name]) => name === 'progress-hook')[1], 0.25)
	assert.equal(slider.props.onSlidingComplete(0.8), undefined)
	assert.deepEqual(seeks, [80])
	assert.deepEqual(h.calls.player.filter(([name]) => name === 'seek'), [['seek', 80]])
	slider.props.onSlidingComplete(2)
	assert.equal(seeks.at(-1), 100)
	const { FloatingPlayer } = h.load('src/components/FloatingPlayer.tsx')
	const renderFunctions = (node) => {
		if (!node || typeof node !== 'object') return
		if (typeof node.type === 'function') return renderFunctions(node.type(node.props))
		for (const child of node.props?.children ?? []) renderFunctions(child)
	}
	renderFunctions(FloatingPlayer({}))
	assert.equal(h.calls.player.filter(([name]) => name === 'progress-hook').at(-1)[1], 1)
})

await check('switching tracks before the next native progress poll uses the new duration for display and seeking', async () => {
	const h = runtime()
	let polledState, initialized = false
	// Use the installed hook: v5 retains its last sample until its next timer tick.
	const nativeHook = loadModule('node_modules/@rntp/player/src/hooks/useProgress.ts', {
		react: {
			useState(initial) {
				if (!initialized) {
					polledState = typeof initial === 'function' ? initial() : initial
					initialized = true
				}
				return [polledState, (value) => { polledState = typeof value === 'function' ? value(polledState) : value }]
			},
			useEffect() {},
		},
		'../audio': h.player,
	})
	h.player.useProgress = nativeHook.useProgress
	await h.facade.play(song('long'))
	h.player.progress = { position: 80, duration: 100, buffered: 90, cached: 0 }
	assert.equal(h.facade.useProgress(0.25).position, 80)
	await h.facade.play(song('short'))
	h.player.progress = { position: 0, duration: 10, buffered: 3, cached: 0 }
	assert.deepEqual(h.facade.useProgress(0.25), h.player.progress)
	assert.equal(polledState.duration, 100)
	const { PlayerProgressBar } = h.load('src/components/PlayerProgressbar.tsx')
	findElement(PlayerProgressBar({}), 'Slider').props.onSlidingComplete(0.5)
	assert.equal(h.calls.player.filter(([name]) => name === 'seek').at(-1)[1], 5)
	h.facade.pause()
	h.player.activeIndex = 1
	const empty = { position: 0, duration: 0, buffered: 0, cached: 0 }
	assert.deepEqual(h.facade.useProgress(0.25), empty)
	await h.facade.clear()
	assert.deepEqual(h.facade.useProgress(0.25), empty)
})

await check('same-item replacement requests reject an older result as well as a different-item result', async () => {
	const h = runtime()
	const first = deferred(), replacement = deferred(), other = deferred()
	const pending = [first, replacement, other]
	h.setResolver(() => pending.shift().promise)
	const a = song('same')
	const old = h.facade.play(a)
	const newer = h.facade.play(a, true)
	replacement.resolve({ url: 'https://media.example/new.mp3', wasCached: false })
	await newer
	first.resolve({ url: 'https://media.example/stale.mp3', wasCached: false })
	await old
	assert.equal(h.player.queue[0].url, 'https://media.example/new.mp3')
	assert.equal(h.count('items'), 1)
	const loadingOther = h.facade.play(song('other'))
	await h.facade.clear()
	other.resolve({ url: 'https://media.example/other.mp3', wasCached: false })
	await loadingOther
	assert.equal(h.player.queue.length, 0)
	assert.equal(h.facade.getCurrentMusic(), null)
	assert.equal(h.persistence.get('music.musicItem'), null)
})

await check('pause and native Stop during source resolution retain the selected source without autoplay', async () => {
	for (const intent of ['pause', 'stop']) {
		const h = runtime()
		const pending = deferred()
		h.setResolver(() => pending.promise)
		const selecting = h.facade.play(song(intent, { headers: { Authorization: 'retained' } }))
		if (intent === 'pause') h.facade.pause()
		else {
			h.player.stop()
			h.facade.observeNativeTransport('stop')
		}
		pending.resolve({ url: 'https://media.example/selected.mp3', wasCached: false })
		await selecting
		assert.equal(h.count('play'), 0)
		assert.equal(h.player.playing, false)
		assert.equal(h.facade.getCurrentMusic().id, intent)
		assert.equal(h.stores.trackSourceLoadingStore.getValue(), null)
		await h.facade.play()
		assert.equal(h.count('play'), 1)
		assert.equal(h.sourceCalls.length, 1)
		assert.equal(h.player.queue[0].url.headers.Authorization, 'retained')
	}
})

await check('the actual sleep-deadline owner pauses a pending source and its late result stays paused', async () => {
	const h = runtime()
	const pending = deferred()
	h.setResolver(() => pending.promise)
	const selecting = h.facade.play(song('sleep'))
	let callback, scheduled
	const native = {
		addListener: (_event, listener) => { callback = listener; return { remove() {} } },
		schedule: (deadline) => { scheduled = { deadline, generation: 'sleep-generation' }; return scheduled.generation },
		cancel() {},
	}
	const sleep = loadModule('src/utils/timingClose.ts', {
		'@/helpers/logger': { logInfo() {}, logWarn() {} },
		'@/helpers/trackPlayerIndex': h.facade,
		'@/utils/stateMapper': h.load('src/utils/stateMapper.ts').default,
		react: h.react,
		'react-native': h.nativeViews,
		'../../modules/cymusic-native/sleepTimer': native,
	})
	sleep.setTimingClose(Date.now() - 1)
	callback(scheduled)
	callback(scheduled)
	assert.equal(h.count('pause'), 1)
	pending.resolve({ url: 'https://media.example/sleep.mp3', wasCached: false })
	await selecting
	assert.equal(h.count('play'), 0)
	assert.equal(h.player.playing, false)
})

await check('empty, stale, duplicate and non-active placeholder transitions cannot advance twice', async () => {
	const h = runtime()
	await h.setup()
	const a = song('a'), b = song('b'), c = song('c')
	h.facade.addAll([a, b, c])
	await h.facade.play(a)
	const oldPlaceholder = h.player.queue[1]
	h.emit('MediaItemTransition', { index: -1 })
	h.emit('MediaItemTransition', { index: -1, item: null })
	h.emit('MediaItemTransition', { index: 1, item: oldPlaceholder })
	assert.equal(h.facade.getCurrentMusic().id, a.id)
	const pending = deferred()
	h.setResolver(() => pending.promise)
	h.player.activeIndex = 1
	h.emit('MediaItemTransition', { index: 1, item: oldPlaceholder })
	h.emit('MediaItemTransition', { index: 1, item: oldPlaceholder })
	assert.equal(h.facade.getCurrentMusic().id, b.id)
	assert.equal(h.sourceCalls.length, 2)
	pending.resolve({ url: b.url, wasCached: false })
	await flush()
	h.emit('MediaItemTransition', { index: 1, item: oldPlaceholder })
	assert.equal(h.facade.getCurrentMusic().id, b.id)
	assert.equal(h.sourceCalls.length, 2)
})

await check('a native resume completes a handoff whose transition arrived after Pause', async () => {
	const h = runtime()
	await h.setup()
	h.facade.addAll([song('a'), song('b')])
	await h.facade.play(song('a'))
	h.player.activeIndex = 1
	h.facade.pause()
	h.emit('MediaItemTransition', { index: 1, item: h.player.queue[1] })
	assert.equal(h.facade.getCurrentMusic().id, 'a')
	h.player.play()
	h.facade.observeNativeTransport('play')
	await flush()
	assert.equal(h.facade.getCurrentMusic().id, 'b')
	assert.equal(h.player.activeIndex, 0)
})

await check('a superseded Next request cannot block the newly selected short track from advancing', async () => {
	const h = runtime()
	await h.setup()
	h.facade.addAll(['a', 'b', 'c', 'd'].map((id) => song(id)))
	await h.facade.play(song('a'))
	const obsoleteSource = deferred()
	h.setResolver(async (track) => track.id === 'b' ? obsoleteSource.promise : { url: track.url, wasCached: false })
	const oldNext = h.facade.skipToNext()
	try {
		await h.facade.play(song('c'), true)
		h.player.activeIndex = 1
		h.emit('MediaItemTransition', { index: 1, item: h.player.queue[1] })
		await flush()
		assert.equal(h.facade.getCurrentMusic().id, 'd')
	} finally {
		obsoleteSource.resolve({ url: song('b').url, wasCached: false })
		await oldNext
	}
})

await check('single repeat makes a fresh queue token and reuses the full JS source after native getters drop headers', async () => {
	const h = runtime()
	await h.setup()
	await h.facade.play(song('one', { headers: { Authorization: 'repeat-header' } }))
	const old = h.player.queue[0]
	assert.equal(typeof h.player.getQueue()[0].url, 'string')
	h.facade.setRepeatMode('single')
	h.player.activeIndex = 1
	h.emit('MediaItemTransition', { index: 1, item: h.player.queue[1] })
	await flush()
	assert.equal(h.facade.getCurrentMusic().id, 'one')
	assert.equal(h.sourceCalls.length, 1)
	assert.notEqual(h.player.queue[0].extras.cymusic.token, old.extras.cymusic.token)
	assert.equal(h.player.queue[0].url.headers.Authorization, 'repeat-header')
	assert.equal(h.count('repeat'), 0)
	assert.equal(h.count('shuffle'), 0)
	h.facade.stop()
	await h.facade.play()
	assert.equal(h.sourceCalls.length, 1)
	assert.equal(h.player.queue[0].url.headers.Authorization, 'repeat-header')
	h.facade.reset()
	await h.facade.play()
	assert.equal(h.sourceCalls.length, 2)
	assert.equal(h.player.queue[0].url.headers.Authorization, 'repeat-header')
})

await check('error recovery requires actual current Error and is retired by selection, Pause or Stop during its delay', async () => {
	for (const intervention of ['select', 'pause', 'stop', 'native-pause', 'native-stop']) {
		const h = runtime()
		await h.setup()
		h.facade.addAll([song('a'), song('b'), song('c')])
		await h.facade.play(song('a'))
		h.emit('PlaybackError', { message: 'old error', code: 'network' })
		assert.equal(h.delays.length, 0)
		h.player.state = 'error'
		h.emit('PlaybackError', { message: 'current error', code: 'network' })
		assert.equal(h.delays.length, 1)
		assert.equal(h.delays[0].milliseconds, 500)
		if (intervention === 'select') await h.facade.play(song('c'))
		else if (intervention === 'pause') h.facade.pause()
		else if (intervention === 'stop') h.facade.stop()
		else {
			const action = intervention.slice('native-'.length)
			h.player[action]()
			h.facade.observeNativeTransport(action)
		}
		const count = h.sourceCalls.length
		h.delays[0].resolve()
		await flush()
		assert.equal(h.sourceCalls.length, count)
		assert.equal(h.facade.getCurrentMusic().id, intervention === 'select' ? 'c' : 'a')
	}
})

await check('native Play during error recovery reloads the retained item and cancels delayed Next', async () => {
	const h = runtime()
	await h.setup()
	h.facade.addAll([song('a'), song('b')])
	await h.facade.play(song('a', { headers: { Authorization: 'retry-header' } }))
	h.player.state = 'error'
	h.emit('PlaybackError', { message: 'retryable failure', code: 'network' })
	assert.equal(h.count('stop'), 1)
	assert.equal(h.count('clear'), 0)
	assert.equal(h.player.getPlaybackState(), 'idle')
	h.player.play()
	h.facade.observeNativeTransport('play')
	h.delays[0].resolve()
	await flush()
	assert.equal(h.facade.getCurrentMusic().id, 'a')
	assert.equal(h.sourceCalls.length, 1)
	assert.equal(h.player.queue[0].url.headers.Authorization, 'retry-header')
	assert.equal(h.player.isPlaying(), true)
})

await check('an invalid source without a matching native item clears safely and Pause cancels its retry', async () => {
	const h = runtime()
	await h.setup()
	h.setResolver(async () => ({ url: 'missing-bundled-asset.mp3', wasCached: false }))
	const selecting = h.facade.play(song('invalid'))
	await flush()
	assert.equal(h.count('items'), 0)
	assert.equal(h.count('clear'), 1)
	assert.equal(h.delays.length, 1)
	h.facade.pause()
	h.delays[0].resolve()
	await selecting
	assert.equal(h.sourceCalls.length, 1)
	assert.equal(h.stores.trackSourceLoadingStore.getValue(), null)
})

await check('a current unhandled playback error advances exactly once after the retained 500 ms delay', async () => {
	const h = runtime()
	await h.setup()
	h.facade.addAll([song('a'), song('b')])
	await h.facade.play(song('a'))
	h.player.state = 'error'
	h.emit('PlaybackError', { message: 'broken stream', code: 'network' })
	h.emit('PlaybackError', { message: 'duplicate', code: 'network' })
	assert.equal(h.delays.length, 1)
	h.delays[0].resolve()
	await flush()
	assert.equal(h.facade.getCurrentMusic().id, 'b')
	assert.equal(h.sourceCalls.length, 2)
})

await check('lyric/progress events reject another item, a retired queue timestamp and the silent placeholder', async () => {
	const h = runtime()
	await h.setup()
	await h.facade.play(song('lyrics'))
	const lyrics = h.load('src/helpers/lyricManager.ts')
	h.stores.nowLyricState.setValue('[00:00.00]zero\n[00:03.00]three')
	await lyrics.default.setup()
	const active = h.player.getActiveMediaItem()
	const event = { mediaId: active.mediaId, position: 4, duration: 40, timestamp: Date.now() }
	h.emit('PlaybackProgressUpdated', event)
	assert.equal(lyrics.durationStore.getValue(), 40)
	assert.equal(lyrics.default.getCurrentLyric().lrc, 'three')
	h.emit('PlaybackProgressUpdated', { ...event, duration: 999, mediaId: 'other' })
	h.emit('PlaybackProgressUpdated', { ...event, duration: 999, timestamp: 0 })
	assert.equal(lyrics.durationStore.getValue(), 40)
	const previous = active
	await h.facade.play(null, true)
	h.emit('MediaItemTransition', { index: 0, item: previous })
	assert.equal(lyrics.durationStore.getValue(), 40)
	h.facade.pause()
	h.player.activeIndex = 1
	h.emit('PlaybackProgressUpdated', { ...event, mediaId: h.player.queue[1].mediaId, duration: 15 })
	assert.equal(lyrics.durationStore.getValue(), 40)
	assert.equal(h.facade.getProgress().duration, 0)
	h.load('src/hooks/useLastActiveTrack.tsx').useLastActiveTrack()
	h.effects.splice(0).forEach((effect) => effect())
	assert.equal(h.stateWrites.at(-1).id, 'lyrics')
	assert.equal(h.stateWrites.at(-1).extras, undefined)
})

await check('queue removal and reset retain business records and never persist native placeholder data', async () => {
	const h = runtime()
	const a = song('a'), b = song('b')
	h.facade.addAll([a, b])
	await h.facade.play(a)
	h.facade.pause()
	await h.facade.remove(a)
	assert.equal(h.player.queue.length, 0)
	assert.equal(h.facade.getCurrentMusic().id, b.id)
	await h.facade.play()
	await h.facade.remove(b)
	assert.equal(h.facade.getCurrentMusic(), null)
	assert.equal(h.player.queue.length, 0)
	assert.equal(h.facade.getPlayList().length, 0)
	for (const write of h.calls.writes.filter(({ key }) => key === 'music.musicItem')) {
		assert.equal(write.value?.extras, undefined)
		assert.equal(write.value?.mediaId, undefined)
	}
})

await check('removing the current song after native interruption does not restart audio', async () => {
	const h = runtime()
	const a = song('interrupted'), b = song('next')
	h.facade.addAll([a, b])
	await h.facade.play(a)
	// Route loss/interruption pauses the native engine without a remote command.
	h.player.pause()
	assert.equal(h.player.getPlaybackState(), 'ready')
	assert.equal(h.stores.playbackIntentStore.getValue(), 'play')
	await h.facade.remove(a)
	assert.equal(h.facade.getCurrentMusic().id, b.id)
	assert.equal(h.count('play'), 1)
	assert.equal(h.player.isPlaying(), false)
	assert.equal(h.player.queue.length, 0)
})

await check('removing the current song while buffering or resolving preserves the requested playback', async () => {
	for (const scenario of ['buffering', 'resolving']) {
		const h = runtime()
		const a = song('current'), b = song('next')
		h.facade.addAll([a, b])
		const pending = deferred()
		let selecting
		if (scenario === 'resolving') {
			h.setResolver(async (track) => track.id === a.id ? pending.promise : { url: track.url, wasCached: false })
			selecting = h.facade.play(a)
		} else {
			await h.facade.play(a)
			h.player.playing = false
			h.player.state = 'buffering'
		}
		try {
			await h.facade.remove(a)
			assert.equal(h.facade.getCurrentMusic().id, b.id)
			assert.equal(h.player.isPlaying(), true)
			assert.equal(h.player.queue[0].extras.cymusic.id, b.id)
		} finally {
			pending.resolve({ url: a.url, wasCached: false })
			await selecting
		}
		assert.equal(h.player.queue[0].extras.cymusic.id, b.id)
	}
})

await check('module retirement removes service, player and lyric subscriptions', async () => {
	const h = runtime()
	await h.setup()
	h.load('src/constants/playbackService.ts').playbackService()
	h.load('src/helpers/lyricManager.ts')
	await h.facade.play(song('retained'))
	const retained = h.persistence.get('music.musicItem')
	assert.equal(h.player.listenerCount(h.player.Event.MediaItemTransition), 2)
	h.calls.disposers.forEach((dispose) => dispose())
	for (const event of Object.values(h.player.Event)) assert.equal(h.player.listenerCount(event), 0)
	assert.equal(h.player.queue.length, 0)
	assert.equal(h.player.playing, false)
	assert.deepEqual(h.persistence.get('music.musicItem'), retained)
})

await fixture.dispose()
const failed = results.filter((result) => !result.passed)
console.log(JSON.stringify({
	check: 'rntp-player', passed: results.length - failed.length, failed: failed.length,
	failures: failed,
	limitations: ['The production JavaScript owners run against controlled native/source seams. Real AVFoundation playback, remote hardware, seek convergence and background behavior require native acceptance.'],
}, null, 2))
if (failed.length) process.exitCode = 1
