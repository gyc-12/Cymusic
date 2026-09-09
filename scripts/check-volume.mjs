import { assert, checks, deferred, flush, loadModule } from './native-services-fixture.mjs'

const { check, finish } = checks()

function mountVolume({ failSet = false } = {}) {
	const initial = deferred()
	const sharedValues = []
	const effects = []
	const listeners = new Set()
	const calls = []
	const warnings = []
	let capturedListener
	const react = {
		memo: (component) => component,
		useCallback: (callback) => callback,
		useEffect: (effect) => effects.push(effect),
		createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
	}
	const volume = {
		getVolume() {
			calls.push(['get'])
			return initial.promise
		},
		async setVolume(value) {
			calls.push(['set', value])
			if (failSet) throw new Error('Volume unavailable')
		},
		addListener(event, listener) {
			assert.equal(event, 'volumeChanged')
			calls.push(['listen'])
			listeners.add(listener)
			capturedListener = listener
			return { remove: () => listeners.delete(listener) }
		},
	}
	const reanimated = {
		View: 'Animated.View',
		useSharedValue(value) {
			const shared = { value }
			sharedValues.push(shared)
			return shared
		},
		useAnimatedStyle: (callback) => callback(),
		withSpring: (value) => value,
	}
	const { PlayerVolumeBar } = loadModule('src/components/PlayerVolumeBar.tsx', {
		'@/helpers/logger': { logWarn: (...args) => warnings.push(args) },
		'@/hooks/useAppTheme': { useThemeColors: () => ({}) },
		'@/styles': { useUtilsStyles: () => ({}) },
		'@expo/vector-icons': { Ionicons: 'Ionicons' },
		react,
		'react-native': { View: 'View' },
		'react-native-awesome-slider': { Slider: 'Slider' },
		'react-native-reanimated': reanimated,
		'../../modules/cymusic-native/volume': volume,
	})
	const tree = PlayerVolumeBar({ style: { opacity: 1 } })
	const cleanups = effects.map((effect) => effect())
	const find = (element, type) => {
		if (element.type === type) return element
		return element.props.children.map((child) => child && find(child, type)).find(Boolean)
	}
	return {
		initial,
		progress: sharedValues[0],
		listeners,
		calls,
		warnings,
		slider: find(tree, 'Slider'),
		emit: (value) => listeners.forEach((listener) => listener({ volume: value })),
		lateEvent: (value) => capturedListener({ volume: value }),
		unmount: () => cleanups.forEach((cleanup) => cleanup()),
	}
}

await check('initial system volume is read after subscribing', async () => {
	const fixture = mountVolume()
	assert.deepEqual(fixture.calls, [['listen'], ['get']])
	fixture.initial.resolve(0.4)
	await flush()
	assert.equal(fixture.progress.value, 0.4)
	fixture.unmount()
})

await check('hardware event wins over an older initial read', async () => {
	const fixture = mountVolume()
	fixture.emit(0.8)
	fixture.initial.resolve(0.2)
	await flush()
	assert.equal(fixture.progress.value, 0.8)
	fixture.unmount()
})

await check('unmount removes the subscription and discards a late read', async () => {
	const fixture = mountVolume()
	fixture.unmount()
	fixture.initial.resolve(0.7)
	await flush()
	assert.equal(fixture.listeners.size, 0)
	assert.equal(fixture.progress.value, 0)
})

await check('an already queued event cannot update an unmounted component', async () => {
	const fixture = mountVolume()
	fixture.unmount()
	fixture.lateEvent(0.9)
	fixture.initial.resolve(0.7)
	await flush()
	assert.equal(fixture.progress.value, 0)
})

await check('read errors are logged and leave live events usable', async () => {
	const fixture = mountVolume()
	fixture.initial.reject(new Error('Read failed'))
	await flush()
	assert.equal(fixture.warnings.length, 1)
	fixture.emit(0.6)
	assert.equal(fixture.progress.value, 0.6)
	fixture.unmount()
})

await check('the existing slider forwards the system-volume value', async () => {
	const fixture = mountVolume()
	await fixture.slider.props.onValueChange(0.35)
	assert.deepEqual(fixture.calls.at(-1), ['set', 0.35])
	assert.equal(fixture.slider.props.thumbWidth, 0)
	assert.equal(fixture.slider.props.renderThumb(), null)
	fixture.initial.resolve(0.35)
	fixture.unmount()
})

await check('a rejected native write is consumed and logged', async () => {
	const fixture = mountVolume({ failSet: true })
	await fixture.slider.props.onValueChange(0.35)
	assert.equal(fixture.warnings.length, 1)
	fixture.initial.resolve(0)
	fixture.unmount()
})

await check('repeated mount/unmount leaves no listeners or cross-mount writes', async () => {
	const first = mountVolume()
	first.unmount()
	const second = mountVolume()
	second.initial.resolve(0.5)
	first.initial.resolve(0.9)
	await flush()
	assert.equal(first.progress.value, 0)
	assert.equal(second.progress.value, 0.5)
	second.unmount()
	assert.equal(first.listeners.size + second.listeners.size, 0)
})

finish()
