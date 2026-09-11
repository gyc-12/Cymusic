import { assert, checks, deferred, flush, loadModule } from './native-services-fixture.mjs'

// Exercise the actual hook with controlled native promises and effect cleanup.
// This runner cannot establish image rendering, layout or gesture behavior.
const { check, finish } = checks()

function fixture() {
	const calls = []
	let rendering
	const react = {
		useState(initial) {
			const owner = rendering
			const index = owner.index++
			if (!owner.slots.has(index)) {
				owner.slots.set(index, { value: typeof initial === 'function' ? initial() : initial })
			}
			const slot = owner.slots.get(index)
			return [
				slot.value,
				(next) => {
					owner.writes++
					slot.value = typeof next === 'function' ? next(slot.value) : next
				},
			]
		},
		useEffect(effect, dependencies) {
			const owner = rendering
			const index = owner.index++
			const previous = owner.slots.get(index)
			if (
				!previous ||
				dependencies.some((value, i) => !Object.is(value, previous.dependencies[i]))
			) {
				owner.pending.set(index, { effect, dependencies })
			}
		},
	}
	const { usePlayerBackground: executeHook } = loadModule('src/hooks/usePlayerBackground.tsx', {
		react,
		'react-native-image-colors': {
			getColors(uri, options) {
				const request = deferred()
				calls.push({ uri, options, ...request })
				return request.promise
			},
		},
	})
	return {
		calls,
		mount(imageUrl) {
			const owner = {
				index: 0,
				writes: 0,
				slots: new Map(),
				pending: new Map(),
				imageUrl,
				render(nextUrl = owner.imageUrl, commit = true) {
					owner.imageUrl = nextUrl
					owner.index = 0
					rendering = owner
					const value = executeHook(nextUrl)
					rendering = undefined
					if (commit) owner.commit()
					return value.backgroundColor
				},
				commit() {
					for (const [index, next] of owner.pending) {
						owner.slots.get(index)?.cleanup?.()
						owner.slots.set(index, { dependencies: next.dependencies, cleanup: next.effect() })
					}
					owner.pending.clear()
				},
				unmount() {
					for (const slot of owner.slots.values()) slot.cleanup?.()
					owner.pending.clear()
				},
			}
			owner.render()
			return owner
		},
	}
}

const ios = (background) => ({
	platform: 'ios',
	background,
	primary: '#ffffff',
	secondary: '#ffff00',
	detail: '#ff0000',
	quality: 'low',
})

function rgb(hex) {
	assert.match(hex, /^#[\da-f]{6}$/i)
	return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
}

function luminance(hex) {
	const linear = rgb(hex).map((channel) => {
		const value = channel / 255
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
	})
	return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

await check('iOS background is used instead of its contrasting primary swatch', async () => {
	const test = fixture()
	const view = test.mount('warm')
	test.calls[0].resolve(ios('#533619'))
	await flush()
	assert.equal(view.render(), '#533619')
	assert.equal(
		test.calls[0].options.cache,
		false,
		'Do not duplicate the bounded cache in the library',
	)
	view.unmount()
})

for (const platform of ['android', 'web']) {
	await check(`${platform} uses its dominant swatch`, async () => {
		const test = fixture()
		const view = test.mount(platform)
		test.calls[0].resolve({ platform, dominant: '#143b50', vibrant: '#ffffff' })
		await flush()
		assert.equal(view.render(), '#143b50')
		view.unmount()
	})
}

await check(
	'bright covers retain their hue while reaching readable white-text contrast',
	async () => {
		const test = fixture()
		const view = test.mount('bright-warm')
		const samples = ['#fdd090', '#90d0fd', '#b5fd90', '#ffffff', '#ff0000', '#0000ff']
		for (const [index, source] of samples.entries()) {
			view.render(`bright-${index}`)
			test.calls.at(-1).resolve(ios(source))
			await flush()
			const background = view.render()
			assert.ok(luminance(background) <= 0.1)
			assert.ok(1.05 / (luminance(background) + 0.05) >= 7)
			const before = rgb(source)
			const after = rgb(background)
			for (let channel = 0; channel < 3; channel++) {
				assert.ok(after[channel] <= before[channel])
				for (let other = 0; other < 3; other++) {
					// One shared scale preserves channel ratios, allowing 1-level rounding.
					assert.ok(
						Math.abs(after[channel] * before[other] - after[other] * before[channel]) <= 510,
					)
				}
			}
		}
		view.unmount()
	},
)

await check(
	'short hex native colors normalize to a complete color for alpha gradients',
	async () => {
		const test = fixture()
		const view = test.mount('short-hex')
		test.calls[0].resolve(ios('#234'))
		await flush()
		assert.equal(view.render(), '#223344')
		view.unmount()
	},
)

await check('missing URLs skip extraction and use a deterministic dark fallback', () => {
	const test = fixture()
	const first = test.mount('')
	const second = test.mount('')
	assert.equal(test.calls.length, 0)
	assert.equal(first.render(), second.render())
	assert.ok(luminance(first.render()) < 0.1)
	first.unmount()
	second.unmount()
})

await check('URI changes stop displaying the previous palette before the effect runs', async () => {
	const test = fixture()
	const view = test.mount('first')
	const fallback = view.render()
	test.calls[0].resolve(ios('#533619'))
	await flush()
	assert.equal(view.render(), '#533619')
	assert.equal(view.render('second', false), fallback)
	assert.equal(test.calls.length, 1)
	view.commit()
	assert.equal(test.calls.length, 2)
	view.unmount()
})

await check('an older success cannot replace the current song palette', async () => {
	const test = fixture()
	const view = test.mount('slow-warm')
	view.render('fast-blue')
	test.calls[1].resolve(ios('#143b50'))
	await flush()
	assert.equal(view.render(), '#143b50')
	const writes = view.writes
	test.calls[0].resolve(ios('#533619'))
	await flush()
	assert.equal(view.writes, writes)
	assert.equal(view.render(), '#143b50')
	view.unmount()
})

await check('returning to the same URI does not reactivate its retired request', async () => {
	const test = fixture()
	const view = test.mount('first')
	view.render('other')
	view.render('first')
	assert.equal(test.calls.length, 3)
	test.calls[2].resolve(ios('#143b50'))
	await flush()
	test.calls[0].resolve(ios('#533619'))
	test.calls[1].reject(new Error('Retired request failed'))
	await flush()
	assert.equal(view.render(), '#143b50')
	view.unmount()
})

await check(
	'rejections are consumed, keep the fallback and can retry on a later visit',
	async () => {
		const test = fixture()
		const view = test.mount('failed')
		const fallback = view.render()
		test.calls[0].reject(new Error('Artwork unavailable'))
		await flush()
		assert.equal(view.render(), fallback)
		view.unmount()
		const retry = test.mount('failed')
		assert.equal(test.calls.length, 2)
		test.calls[1].resolve(ios('#143b50'))
		await flush()
		assert.equal(retry.render(), '#143b50')
		retry.unmount()
	},
)

await check(
	'late results after unmount cannot write state or populate a retired cache entry',
	async () => {
		const test = fixture()
		const view = test.mount('late')
		view.unmount()
		const writes = view.writes
		test.calls[0].resolve(ios('#533619'))
		await flush()
		assert.equal(view.writes, writes)
		const second = test.mount('late')
		assert.equal(test.calls.length, 2)
		second.unmount()
		test.calls[1].reject(new Error('Failed after unmount'))
		await flush()
		assert.equal(second.writes, 0)
	},
)

await check('re-renders and subsequent mounts reuse a completed palette', async () => {
	const test = fixture()
	const view = test.mount('cached')
	view.render()
	view.render()
	assert.equal(test.calls.length, 1)
	test.calls[0].resolve(ios('#143b50'))
	await flush()
	view.unmount()
	const second = test.mount('cached')
	assert.equal(second.render(), '#143b50')
	assert.equal(test.calls.length, 1)
	second.unmount()
})

await check(
	'the 50-entry cache evicts old covers and refreshes recently reused covers',
	async () => {
		const test = fixture()
		const view = test.mount('cover-0')
		for (let index = 0; index < 51; index++) {
			view.render(`cover-${index}`)
			test.calls.at(-1).resolve(ios('#143b50'))
			await flush()
		}
		assert.equal(test.calls.length, 51)
		assert.equal(view.render('cover-1'), '#143b50')
		assert.equal(test.calls.length, 51)
		view.render('cover-51')
		test.calls.at(-1).resolve(ios('#533619'))
		await flush()
		view.render('cover-1')
		assert.equal(test.calls.length, 52)
		view.render('cover-0')
		assert.equal(test.calls.length, 53)
		view.render('cover-2')
		assert.equal(test.calls.length, 54)
		view.unmount()
	},
)

await check('unexpected native swatches and platforms leave a usable fallback', async () => {
	const test = fixture()
	const view = test.mount('invalid')
	const fallback = view.render()
	const samples = [ios('not-a-color'), ios(undefined), { platform: 'unexpected' }, null]
	for (const [index, result] of samples.entries()) {
		view.render(`invalid-${index}`)
		test.calls.at(-1).resolve(result)
		await flush()
		assert.equal(view.render(), fallback)
	}
	view.unmount()
})

finish()
