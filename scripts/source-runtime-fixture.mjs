import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')
export const sourceRoot = fileURLToPath(new URL('../', import.meta.url))
// While preparing this small patch in an ignored task directory, unchanged
// consumers are read from the checkout that owns the installed compiler.
const checkout = path.dirname(path.dirname(path.dirname(require.resolve('typescript/package.json'))))

export const deferred = () => {
	let resolve, reject
	const promise = new Promise((yes, no) => { resolve = yes; reject = no })
	return { promise, resolve, reject }
}

export const flush = () => new Promise(resolve => setImmediate(resolve))
export const script = name => `/**\n * @name ${name}\n * @description source fixture\n * @version 1.2.3\n * @author CyMusic\n * @homepage https://example.test\n */\nlx.on(lx.EVENT_NAMES.request, () => Promise.resolve('https://example.test/audio'))`

export function createSourceFixture({ fetch: fetchImpl = globalThis.fetch } = {}) {
	let now = 0
	let nextTimer = 0
	const timers = new Map()
	const clock = {
		timers,
		setTimeout(callback, delay) {
			const id = ++nextTimer
			timers.set(id, { callback, due: now + Number(delay), delay })
			return id
		},
		clearTimeout(id) { timers.delete(id) },
		advance(milliseconds) {
			const end = now + milliseconds
			for (;;) {
				const next = [...timers.entries()].filter(([, timer]) => timer.due <= end)
					.sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0]
				if (!next) break
				now = next[1].due
				timers.delete(next[0])
				next[1].callback()
			}
			now = end
		},
	}

	let nextGeneration = 0
	const listeners = new Set()
	const native = {
		listeners,
		loads: [],
		sent: [],
		destroys: [],
		generation: null,
		loadScript(info) {
			this.generation = `native-${++nextGeneration}`
			this.loads.push({ info, generation: this.generation })
			return this.generation
		},
		sendAction(action, data, generation) {
			this.sent.push({ action, data: JSON.parse(data), generation })
		},
		destroy() {
			this.generation = `native-${++nextGeneration}`
			this.destroys.push(this.generation)
			return this.generation
		},
		addListener(event, callback) {
			assert.equal(event, 'api-action')
			listeners.add(callback)
			return { remove: () => listeners.delete(callback) }
		},
		emit(action, data, generation = this.generation) {
			this.raw({ action, data: JSON.stringify(data), generation })
		},
		raw(event) {
			for (const callback of [...listeners]) callback(event)
		},
		queue(event) {
			// Model callbacks already captured for final host delivery, including a
			// subscription that will be removed before that delivery occurs.
			const callbacks = [...listeners]
			return () => { for (const callback of callbacks) callback(event) }
		},
		init(generation = this.generation, data = {}) {
			this.emit('init', { status: true, info: { sources: {} }, ...data }, generation)
		},
	}
	const logs = []
	const modules = new Map()
	function load(relative) {
		const key = relative.replaceAll(path.sep, '/').replace(/\.ts$/, '')
		if (modules.has(key)) return modules.get(key).exports
		const candidates = [path.join(sourceRoot, `${key}.ts`), path.join(checkout, `${key}.ts`)]
		const filename = candidates.find(candidate => fs.existsSync(candidate))
		if (!filename) throw new Error(`No fixture source for ${relative}`)
		const module = { exports: {} }
		modules.set(key, module)
		let source = fs.readFileSync(filename, 'utf8')
		if (key === 'src/helpers/userApi/lxMusicSourceAdapter') {
			// Test-only access to the actual owner's maps; no replacement model or
			// production debug API. Retired objects remain inspectable by a test.
			source += '\nexports.inspectRuntime = () => activeRuntime\n'
		}
		const compiled = ts.transpileModule(source, {
			compilerOptions: {
				module: ts.ModuleKind.CommonJS,
				target: ts.ScriptTarget.ES2022,
				esModuleInterop: true,
			},
		}).outputText
		const imported = specifier => {
			if (specifier === 'expo') return { requireNativeModule(name) {
				assert.equal(name, 'UserApiModule')
				return native
			} }
			if (specifier === 'buffer') return require('buffer')
			const target = specifier.startsWith('@/') ? `src/${specifier.slice(2)}`
				: path.posix.normalize(path.posix.join(path.posix.dirname(key), specifier))
			if (target === 'src/helpers/logger') return {
				logInfo: (...args) => logs.push({ level: 'info', args }),
				logError: (...args) => logs.push({ level: 'error', args }),
			}
			return load(target)
		}
		new Function('require', 'module', 'exports', 'setTimeout', 'clearTimeout', 'fetch', compiled)(
			imported, module, module.exports, clock.setTimeout, clock.clearTimeout, fetchImpl,
		)
		return module.exports
	}
	const facade = load('src/components/utils/nativeModules/userApi')
	const adapter = load('src/helpers/userApi/lxMusicSourceAdapter')
	const initialized = async name => {
		const ready = adapter.adaptLxMusicScript(script(name))
		native.init()
		return ready
	}
	return { clock, native, logs, load, facade, adapter, initialized }
}

export const assertRetired = (fixture, runtime) => {
	assert.equal(runtime.disposed, true)
	assert.equal(runtime.inited, false)
	assert.equal(runtime.init, null)
	assert.equal(runtime.removeListener, null)
	assert.equal(runtime.pendingRequests.size, 0)
	assert.equal(runtime.settledRequestTypes.size, 0)
	assert.equal(runtime.pendingHttpRequests.size, 0)
	if (!fixture.adapter.inspectRuntime()) {
		assert.equal(fixture.clock.timers.size, 0)
		assert.equal(fixture.native.listeners.size, 0)
	}
}
