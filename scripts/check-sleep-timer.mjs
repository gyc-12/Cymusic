import { assert, checks, deferred, flush, loadModule } from './native-services-fixture.mjs'
import { fakeClock } from './request-fixture.mjs'

const { check, finish } = checks()

function sleepFixture({ pauseFailure = false, cancelFailure = false } = {}) {
	const clock = fakeClock()
	const listeners = new Set()
	const foreground = new Set()
	const scheduled = []
	const warnings = []
	const disposers = []
	const pauses = []
	const states = []
	const effects = []
	let stateIndex = 0
	let effectIndex = 0
	let sequence = 0
	let cancellations = 0
	const native = {
		schedule(deadline) {
			if (!Number.isFinite(deadline)) throw new Error('Sleep deadline must be finite')
			const event = { generation: `native-${++sequence}`, deadline }
			scheduled.push(event)
			return event.generation
		},
		cancel() {
			cancellations++
			if (cancelFailure) throw new Error('Cancel failed')
		},
		addListener(event, callback) {
			assert.equal(event, 'deadline')
			listeners.add(callback)
			return { remove: () => listeners.delete(callback) }
		},
	}
	class StateMapper {
		constructor(read) { this.read = read }
		notify() {}
		useMappedState() { return this.read() }
	}
	const exports = loadModule('src/utils/timingClose.ts', {
		'@/helpers/logger': { logInfo() {}, logWarn: (...args) => warnings.push(args) },
		'@/helpers/trackPlayerIndex': {
			pause() {
				const result = deferred()
				pauses.push(result)
				if (pauseFailure) result.reject(new Error('Pause failed'))
				return result.promise
			},
		},
		'@/utils/stateMapper': StateMapper,
		react: {
			useState(initial) {
				const index = stateIndex++
				if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial
				return [states[index], (value) => { states[index] = value }]
			},
			useEffect(callback, dependencies) {
				const index = effectIndex++
				const previous = effects[index]
				if (previous && dependencies.every((value, key) => Object.is(value, previous.dependencies[key]))) return
				previous?.cleanup?.()
				effects[index] = { dependencies, callback, pending: true }
			},
		},
		'react-native': {
			AppState: { addEventListener(event, callback) {
				assert.equal(event, 'change')
				foreground.add(callback)
				return { remove: () => foreground.delete(callback) }
			} },
		},
		'../../modules/cymusic-native/sleepTimer': native,
	}, {
		...clock,
		Date: class extends Date { static now() { return clock.now } },
	}, { dispose: (callback) => disposers.push(callback) })
	return {
		...exports, clock, listeners, foreground, scheduled, pauses, warnings,
		get cancellations() { return cancellations },
		emit: (event = scheduled.at(-1)) => listeners.forEach((callback) => callback(event)),
		activate: () => foreground.forEach((callback) => callback('active')),
		render() {
			stateIndex = 0
			effectIndex = 0
			const value = exports.useTimingClose()
			for (const effect of effects) if (effect.pending) {
				effect.pending = false
				effect.cleanup = effect.callback()
			}
			return value
		},
		unmount: () => effects.forEach((effect) => effect.cleanup?.()),
		dispose: () => disposers.forEach((callback) => callback()),
	}
}

await check('deadline subscriptions exist without mounting the playback screen', () => {
	const fixture = sleepFixture()
	assert.equal(fixture.listeners.size, 1)
	assert.equal(fixture.foreground.size, 1)
	fixture.dispose()
})

await check('an early event cannot pause before its wall-clock deadline', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 1000)
	fixture.emit()
	assert.equal(fixture.pauses.length, 0)
	fixture.dispose()
})

await check('duplicate native/foreground delivery pauses only once while pause is pending', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 1000)
	fixture.clock.advance(1000)
	fixture.emit()
	fixture.emit()
	fixture.activate()
	assert.equal(fixture.pauses.length, 1)
	fixture.pauses[0].resolve()
	fixture.dispose()
})

await check('cancellation rejects queued deadline events and foreground expiry', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 1000)
	fixture.setTimingClose(null)
	fixture.clock.advance(1000)
	fixture.emit()
	fixture.activate()
	assert.equal(fixture.pauses.length, 0)
	fixture.dispose()
})

await check('replacement rejects the old generation and mismatched deadline', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 1000)
	const previous = fixture.scheduled.at(-1)
	fixture.setTimingClose(fixture.clock.now + 2000)
	fixture.clock.advance(2000)
	fixture.emit(previous)
	fixture.emit({ ...fixture.scheduled.at(-1), deadline: previous.deadline })
	assert.equal(fixture.pauses.length, 0)
	fixture.emit()
	assert.equal(fixture.pauses.length, 1)
	fixture.pauses[0].resolve()
	fixture.dispose()
})

await check('a failed replacement logs the error and preserves the existing deadline', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 1000)
	const previous = fixture.scheduled.at(-1)
	assert.equal(fixture.render(), 1)
	assert.doesNotThrow(() => fixture.setTimingClose(Infinity))
	assert.equal(fixture.warnings.length, 1)
	assert.equal(fixture.warnings[0][0], 'Failed to schedule sleep timer')
	assert.equal(fixture.scheduled.length, 1)
	assert.equal(fixture.cancellations, 0)
	assert.equal(fixture.render(), 1)
	fixture.clock.advance(1000)
	fixture.emit(previous)
	fixture.activate()
	assert.equal(fixture.pauses.length, 1)
	fixture.pauses[0].resolve()
	fixture.unmount()
	fixture.dispose()
})

await check('foreground recovery fires an overdue deadline without a native event', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 500)
	fixture.clock.advance(1000)
	fixture.activate()
	fixture.emit()
	assert.equal(fixture.pauses.length, 1)
	fixture.pauses[0].resolve()
	fixture.dispose()
})

await check('an old pause completion cannot clear a replacement deadline', async () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 100)
	fixture.clock.advance(100)
	fixture.emit()
	fixture.setTimingClose(fixture.clock.now + 200)
	fixture.pauses[0].resolve()
	await flush()
	fixture.clock.advance(200)
	fixture.emit()
	assert.equal(fixture.pauses.length, 2)
	fixture.pauses[1].resolve()
	fixture.dispose()
})

await check('countdown uses seconds, reaches zero, and stops its interval', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 2000)
	assert.equal(fixture.render(), 2)
	assert.equal(fixture.clock.pending, 1)
	fixture.clock.advance(1000)
	assert.equal(fixture.render(), 1)
	fixture.clock.advance(1000)
	assert.equal(fixture.render(), 0)
	assert.equal(fixture.clock.pending, 0)
	fixture.unmount()
	fixture.dispose()
})

await check('unmount clears countdown work but keeps deadline handling active', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 2000)
	fixture.render()
	fixture.unmount()
	assert.equal(fixture.clock.pending, 0)
	assert.equal(fixture.listeners.size, 1)
	fixture.clock.advance(2000)
	fixture.emit()
	assert.equal(fixture.pauses.length, 1)
	fixture.pauses[0].resolve()
	fixture.dispose()
})

await check('deadline changes replace the countdown interval and cancellation removes it', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 2000)
	fixture.render()
	fixture.setTimingClose(fixture.clock.now + 4000)
	fixture.render()
	assert.equal(fixture.render(), 4)
	assert.equal(fixture.clock.pending, 1)
	fixture.setTimingClose(null)
	fixture.render()
	assert.equal(fixture.render(), null)
	assert.equal(fixture.clock.pending, 0)
	fixture.unmount()
	fixture.dispose()
})

await check('module disposal removes both subscriptions and rejects already queued events', () => {
	const fixture = sleepFixture()
	fixture.setTimingClose(fixture.clock.now + 1000)
	const queued = [...fixture.listeners][0]
	fixture.dispose()
	fixture.clock.advance(1000)
	queued(fixture.scheduled[0])
	assert.equal(fixture.listeners.size + fixture.foreground.size, 0)
	assert.equal(fixture.pauses.length, 0)
	assert.equal(fixture.cancellations, 1)
})

await check('pause/cancel failures are logged without duplicate expiry', async () => {
	const fixture = sleepFixture({ pauseFailure: true, cancelFailure: true })
	fixture.setTimingClose(fixture.clock.now + 100)
	fixture.clock.advance(100)
	fixture.emit()
	fixture.emit()
	await flush()
	assert.equal(fixture.pauses.length, 1)
	assert.equal(fixture.warnings.length, 2)
	fixture.dispose()
})

finish()
