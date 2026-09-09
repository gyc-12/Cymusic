import { assert, deferred, loadModule } from './native-services-fixture.mjs'

export function fakeClock(start = 100000) {
	let now = start
	let identifier = 0
	const timers = new Map()
	const schedule = (callback, milliseconds, repeat) => {
		const id = identifier++
		timers.set(id, { callback, at: now + milliseconds, repeat })
		return id
	}
	return {
		get now() { return now },
		get pending() { return timers.size },
		setTimeout: (callback, milliseconds) => schedule(callback, milliseconds, 0),
		clearTimeout: (id) => timers.delete(id),
		setInterval: (callback, milliseconds) => schedule(callback, milliseconds, milliseconds),
		clearInterval: (id) => timers.delete(id),
		advance(milliseconds) {
			const target = now + milliseconds
			for (let count = 0; count < 10000; count++) {
				const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0]
				if (!next) break
				const [id, timer] = next
				now = timer.at
				if (timer.repeat) timer.at += timer.repeat
				else timers.delete(id)
				timer.callback()
			}
			now = target
		},
	}
}

export function backgroundTasks({ delayed = false, denied = false, beginFailure = false, endFailure = false } = {}) {
	const pending = []
	const active = new Set()
	const ended = []
	let sequence = 0
	return {
		pending, active, ended,
		async beginTask() {
			if (beginFailure) throw new Error('Background begin failed')
			if (denied) return null
			const identifier = `lease-${++sequence}`
			if (delayed) {
				const result = deferred()
				pending.push({ result, identifier })
				await result.promise
			}
			active.add(identifier)
			return identifier
		},
		async endTask(identifier) {
			ended.push(identifier)
			if (endFailure) throw new Error('Background end failed')
			active.delete(identifier)
		},
		resolve(index = 0) {
			pending[index].result.resolve()
		},
	}
}

export function timeoutFixture(options = {}) {
	const clock = fakeClock()
	const native = backgroundTasks(options)
	const warnings = []
	const helper = loadModule('src/helpers/requestTimeout.ts', {
		'../../modules/cymusic-native/requestTasks': native,
		'./logger': { logWarn: (...args) => warnings.push(args) },
	}, clock)
	return { clock, native, warnings, helper }
}

export function response({ body = '{"ok":true}', status = 200, read, binary } = {}) {
	return {
		headers: { map: { 'x-response': 'retained' } },
		status,
		statusText: status === 200 ? 'OK' : 'Other',
		url: 'https://fixture.test/audio',
		ok: status >= 200 && status < 300,
		text: () => read || Promise.resolve(body),
		blob: () => Promise.resolve(new Blob([binary || Buffer.from('audio')])),
	}
}

export function requestFixture(owner, fetchImplementation = () => Promise.resolve(response()), leaseOptions = {}) {
	const fixture = timeoutFixture(leaseOptions)
	const calls = []
	class FileReader {
		async readAsDataURL(blob) {
			try {
				this.result = `data:audio/mpeg;base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`
				this.onload()
			} catch (error) {
				this.onerror(error)
			}
		}
	}
	const exports = loadModule(owner, {
		'@/helpers/requestTimeout': fixture.helper,
		'./message': { requestMsg: { timeout: 'TIMEOUT', notConnectNetwork: 'NETWORK', unachievable: 'UNREACHABLE' } },
		'./musicSdk/options': {},
		buffer: { Buffer },
	}, {
		...fixture.clock,
		console: { log() {}, error() {} },
		FileReader,
		fetch(url, options) {
			calls.push({ url, options })
			return fetchImplementation(url, options)
		},
	})
	return {
		...fixture, calls, exports,
		start(options = {}) {
			if (exports.httpFetch) {
				const result = exports.httpFetch('https://fixture.test/audio', options)
				return { promise: result.promise, cancel: result.cancelHttp }
			}
			const result = exports.fetchData('https://fixture.test/audio', options)
			return { promise: result.request, cancel: result.abort }
		},
	}
}

export function pendingFetch(_url, { signal }) {
	return new Promise((_resolve, reject) => {
		if (signal.aborted) reject(new Error('Aborted'))
		else signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true })
	})
}

export function assertClean(fixture) {
	assert.equal(fixture.clock.pending, 0)
	assert.equal(fixture.native.active.size, 0)
	assert.equal(new Set(fixture.native.ended).size, fixture.native.ended.length)
}
