import { assert, checks, deferred, flush, loadModule } from './native-services-fixture.mjs'
import { assertClean, pendingFetch, requestFixture, response, timeoutFixture } from './request-fixture.mjs'

const { check, finish } = checks()
const expoCancellationMessage = 'fetch failed: FetchRequestCanceledException: Fetch request has been canceled (at Expo/NativeResponse.swift:63)'

for (const owner of ['src/components/utils/request.js', 'src/helpers/userApi/request.js']) {
	await check(`${owner}: successful JSON response retains fields and releases its timeout/lease`, async () => {
		const fixture = requestFixture(owner)
		const result = await fixture.start().promise
		await flush()
		assert.equal(result.body.ok, true)
		assert.equal(result.statusCode, 200)
		assert.equal(result.headers['x-response'], 'retained')
		assert.equal(result.url, 'https://fixture.test/audio')
		assertClean(fixture)
	})

	await check(`${owner}: HTTP errors remain response results`, async () => {
		const fixture = requestFixture(owner, () => Promise.resolve(response({ status: 500, body: '{"error":"server"}' })))
		const result = await fixture.start().promise
		await flush()
		assert.equal(result.statusCode, 500)
		assert.equal(result.ok, false)
		assert.equal(result.body.error, 'server')
		assertClean(fixture)
	})

	await check(`${owner}: caller headers and JSON/form serialization are retained`, async () => {
		const fixture = requestFixture(owner)
		await fixture.start({ method: 'post', body: { name: '中文' }, headers: { 'X-Custom': 'value' } }).promise
		assert.equal(fixture.calls[0].options.body, '{"name":"中文"}')
		assert.equal(fixture.calls[0].options.headers['X-Custom'], 'value')
		assert.equal(fixture.calls[0].options.headers['Content-Type'], 'application/json')
		await fixture.start({ method: 'post', form: { name: 'a b' } }).promise
		assert.equal(fixture.calls[1].options.body, 'name=a%20b')
		await flush()
		assertClean(fixture)
	})

	await check(`${owner}: binary body conversion retains exact bytes`, async () => {
		const bytes = Buffer.from([0, 1, 127, 128, 255])
		const fixture = requestFixture(owner, () => Promise.resolve(response({ binary: bytes })))
		const result = await fixture.start({ binary: true }).promise
		await flush()
		assert.deepEqual(result.body, bytes)
		assertClean(fixture)
	})

	await check(`${owner}: preparation rejection cleans up before fetch starts`, async () => {
		const body = {}
		body.circular = body
		const fixture = requestFixture(owner)
		await assert.rejects(fixture.start({ method: 'post', body }).promise, /circular/i)
		await flush()
		assert.equal(fixture.calls.length, 0)
		assertClean(fixture)
	})

	await check(`${owner}: transport failure retains error mapping and cleanup`, async () => {
		const fixture = requestFixture(owner, () => Promise.reject(new Error('Network request failed')))
		await assert.rejects(fixture.start().promise, owner.includes('components') ? /NETWORK/ : /Network request failed/)
		await flush()
		assertClean(fixture)
	})

	await check(`${owner}: manual cancellation immediately clears timer and lease`, async () => {
		const fixture = requestFixture(owner, pendingFetch)
		const request = fixture.start()
		const error = request.promise.catch((failure) => failure)
		await flush()
		request.cancel()
		request.cancel()
		assert.equal(fixture.clock.pending, 0)
		assert.equal(fixture.calls[0].options.signal.aborted, true)
		await error
		await flush()
		assertClean(fixture)
	})

	await check(`${owner}: the default 15-second timeout aborts once`, async () => {
		const fixture = requestFixture(owner, pendingFetch)
		const request = fixture.start()
		const error = request.promise.catch((failure) => failure)
		await flush()
		fixture.clock.advance(14999)
		assert.equal(fixture.calls[0].options.signal.aborted, false)
		fixture.clock.advance(1)
		assert.equal(fixture.calls[0].options.signal.aborted, true)
		assert.match((await error).message, owner.includes('components') ? /TIMEOUT/ : /Aborted/)
		await flush()
		assertClean(fixture)
	})

	for (const cancellation of ['timeout', 'manual']) {
		await check(`${owner}: Expo ${cancellation} cancellation retains the existing abort mapping`, async () => {
			const failure = new Error(expoCancellationMessage)
			const pending = deferred()
			const fixture = requestFixture(owner, (_url, { signal }) => {
				signal.addEventListener('abort', () => pending.reject(failure), { once: true })
				return pending.promise
			})
			const request = fixture.start({ timeout: 600 })
			const error = request.promise.catch((value) => value)
			await flush()
			if (cancellation === 'timeout') fixture.clock.advance(600)
			else request.cancel()
			assert.equal(fixture.calls[0].options.signal.aborted, true)
			assert.equal((await error).message, owner.includes('components') ? 'TIMEOUT' : 'Aborted')
			await flush()
			assertClean(fixture)
		})
	}

	await check(`${owner}: an uncancelled request preserves transport error identity`, async () => {
		for (const message of ['Connection reset by peer', expoCancellationMessage]) {
			const failure = new Error(message)
			const fixture = requestFixture(owner, () => Promise.reject(failure))
			const error = await fixture.start().promise.catch((value) => value)
			assert.equal(fixture.calls[0].options.signal.aborted, false)
			assert.equal(error, failure)
			await flush()
			assertClean(fixture)
		}
	})

	await check(`${owner}: body-read failure releases resources after headers arrive`, async () => {
		const body = deferred()
		const fixture = requestFixture(owner, () => Promise.resolve(response({ read: body.promise })))
		const request = fixture.start()
		const error = request.promise.catch((failure) => failure)
		await flush()
		assert.equal(fixture.native.active.size, 1)
		assert.equal(fixture.clock.pending, 1)
		body.reject(new Error('Body failed'))
		assert.match((await error).message, /Body failed/)
		await flush()
		assertClean(fixture)
	})

	await check(`${owner}: cancel-before-fetch releases a late native lease`, async () => {
		const fixture = requestFixture(owner, pendingFetch, { delayed: true })
		const request = fixture.start()
		const error = request.promise.catch((failure) => failure)
		request.cancel()
		assert.equal(fixture.clock.pending, 0)
		fixture.native.resolve()
		await error
		await flush()
		assert.equal(fixture.native.ended.length, 1)
		assertClean(fixture)
	})
}

await check('completed request releases a native lease that arrives later', async () => {
	const fixture = requestFixture('src/helpers/userApi/request.js', undefined, { delayed: true })
	await fixture.start().promise
	assert.equal(fixture.clock.pending, 0)
	assert.equal(fixture.native.ended.length, 0)
	fixture.native.resolve()
	await flush()
	assert.equal(fixture.native.ended.length, 1)
	assertClean(fixture)
})

await check('concurrent requests release only their own native lease', async () => {
	const pending = [deferred(), deferred()]
	let index = 0
	const fixture = requestFixture('src/helpers/userApi/request.js', () => pending[index++].promise)
	const first = fixture.start()
	const second = fixture.start()
	await flush()
	pending[1].resolve(response())
	await second.promise
	await flush()
	assert.equal(fixture.clock.pending, 1)
	assert.equal(fixture.native.active.size, 1)
	assert.deepEqual(fixture.native.ended, ['lease-2'])
	pending[0].resolve(response())
	await first.promise
	await flush()
	assertClean(fixture)
})

await check('OS denial leaves ordinary request completion usable', async () => {
	const fixture = requestFixture('src/helpers/userApi/request.js', undefined, { denied: true })
	assert.equal((await fixture.start().promise).statusCode, 200)
	await flush()
	assert.equal(fixture.native.ended.length, 0)
	assertClean(fixture)
})

await check('native begin/release failures do not replace a successful request', async () => {
	for (const options of [{ beginFailure: true }, { endFailure: true }]) {
		const fixture = requestFixture('src/helpers/userApi/request.js', undefined, options)
		assert.equal((await fixture.start().promise).statusCode, 200)
		await flush()
		assert.equal(fixture.clock.pending, 0)
		assert.equal(fixture.warnings.length, 1)
	}
})

await check('httpGet cancellation preserves one callback and releases its resources', async () => {
	const fixture = requestFixture('src/components/utils/request.js', pendingFetch)
	const callbacks = []
	const cancel = fixture.exports.httpGet('https://fixture.test/audio', (...args) => callbacks.push(args))
	await flush()
	cancel()
	await flush()
	assert.equal(callbacks.length, 1)
	assert.match(callbacks[0][0].message, /Aborted/)
	assert.equal(callbacks[0][1], null)
	assertClean(fixture)
})

await check('finishing a timeout is idempotent and clears timer identifier zero', async () => {
	const fixture = timeoutFixture()
	const controller = new AbortController()
	const timeout = fixture.helper.createRequestTimeout(controller, 10)
	await flush()
	timeout.finish()
	timeout.finish()
	fixture.clock.advance(10)
	await flush()
	assert.equal(controller.signal.aborted, false)
	assert.equal(fixture.native.ended.length, 1)
	assertClean(fixture)
})

for (const delayed of [false, true]) {
	await check(`delay preserves milliseconds and releases its ${delayed ? 'late' : 'current'} lease`, async () => {
		const fixture = timeoutFixture({ delayed })
		const delay = loadModule('src/utils/delay.ts', {
			'@/helpers/requestTimeout': fixture.helper,
		}, fixture.clock).default
		let completed = false
		const promise = delay(500).then((value) => {
			assert.equal(value, undefined)
			completed = true
		})
		await flush()
		fixture.clock.advance(499)
		await flush()
		assert.equal(completed, false)
		fixture.clock.advance(1)
		await promise
		assert.equal(completed, true)
		if (delayed) fixture.native.resolve()
		await flush()
		assert.equal(fixture.native.ended.length, 1)
		assertClean(fixture)
	})
}

finish()
