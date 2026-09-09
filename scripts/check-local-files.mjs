// Run: node scripts/check-local-files.mjs
// Retains the useful resolver/deletion matrix from the prior task fixture, without
// its SDK checkpoint, playback/quality and playlist-hydration checks.
import assert from 'node:assert/strict'
import fsp from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import {
	createFixture,
	deferred,
	deepFreeze,
	exists,
	item,
	projectRoot,
	uri,
	write,
} from './file-system-fixture.mjs'

const fixture = createFixture()
const { temporary, device, oldId, newId, documents, library, oldDocuments, oldLibrary, runtime } =
	fixture

const checks = []
const test = async (name, action) => {
	try {
		await action()
		checks.push({ name, passed: true })
	} catch (error) {
		checks.push({ name, passed: false, error: error.stack })
	}
}

async function main() {
	await fsp.mkdir(documents, { recursive: true })
	await fsp.mkdir(library, { recursive: true })
	const h = runtime()
	const { resolveLocalFile } = h.load('src/helpers/localFile.ts')
	const expectResolved = async (address, expectedPath, relocated, options) => {
		const result = await resolveLocalFile(address, options)
		assert.deepEqual(result, {
			status: 'resolved',
			filePath: expectedPath,
			fileUri: uri(expectedPath),
			relocated,
		})
		assert.equal(
			await fsp.readFile(fileURLToPath(result.fileUri), 'utf8'),
			await fsp.readFile(expectedPath, 'utf8'),
		)
	}
	for (const name of [
		'ascii.mp3',
		'升级 café #1?.mp3',
		'100%.mp3',
		'literal%23.mp3',
		'literal%2523.mp3',
	]) {
		const current = `${documents}/importedLocalMusic/${name}`
		const old = `${oldDocuments}/importedLocalMusic/${name}`
		await write(current, `bytes:${name}`)
		for (const [form, address, moved] of [
			['current raw', current, false],
			['current encoded URI', uri(current), false],
			['relocated raw', old, true],
			['relocated encoded URI', uri(old), true],
		])
			await test(`${form}: ${name}`, () => expectResolved(address, current, moved))
	}
	await test('known duplicate prefix and legacy literal hash URI', async () => {
		const relative = '/importedLocalMusic/升级 café #1?.mp3'
		await expectResolved(
			`file://file://${oldDocuments}${relative}`,
			`${documents}${relative}`,
			true,
		)
	})
	await test('file URI schemes are case-insensitive and return canonical lowercase', async () => {
		await expectResolved(
			`FILE://${oldDocuments}/importedLocalMusic/ascii.mp3`,
			`${documents}/importedLocalMusic/ascii.mp3`,
			true,
		)
	})
	await test('raw percent path never falls back to decoded filename', async () => {
		await write(`${documents}/importedLocalMusic/raw-only#.mp3`)
		assert.equal(
			(await resolveLocalFile(`${oldDocuments}/importedLocalMusic/raw-only%23.mp3`)).status,
			'unresolved',
		)
	})
	await test('legacy literal URI percent fallback decodes only once', async () => {
		await write(`${documents}/importedLocalMusic/legacy%41.mp3`, 'literal percent')
		await expectResolved(
			`file://${oldDocuments}/importedLocalMusic/legacy%41.mp3`,
			`${documents}/importedLocalMusic/legacy%41.mp3`,
			true,
		)
		await write(`${documents}/importedLocalMusic/once#.mp3`, 'must not be selected')
		assert.equal(
			(await resolveLocalFile(`file://${oldDocuments}/importedLocalMusic/once%2523.mp3`)).status,
			'unresolved',
		)
	})
	await test('original existing file wins over a distinct relocated interpretation', async () => {
		await write(`${oldDocuments}/importedLocalMusic/prefer#.mp3`, 'original')
		await write(`${documents}/importedLocalMusic/prefer%23.mp3`, 'relocated literal')
		await expectResolved(
			`file://${oldDocuments}/importedLocalMusic/prefer%23.mp3`,
			`${oldDocuments}/importedLocalMusic/prefer#.mp3`,
			false,
		)
		assert.equal(
			(
				await resolveLocalFile(`file://${oldDocuments}/importedLocalMusic/prefer%23.mp3`, {
					requireOwnedMedia: true,
				})
			).reason,
			'unowned',
		)
	})
	for (const root of [oldDocuments, documents]) {
		await test(`ambiguous URI interpretations in ${root === documents ? 'current' : 'original'} container`, async () => {
			await write(`${root}/importedLocalMusic/collision#.mp3`, 'hash')
			await write(`${root}/importedLocalMusic/collision%23.mp3`, 'percent')
			assert.deepEqual(
				await resolveLocalFile(`file://${root}/importedLocalMusic/collision%23.mp3`),
				{ status: 'unresolved', reason: 'ambiguous' },
			)
		})
	}
	await test('ambiguous relocated URI interpretations', async () => {
		await write(`${documents}/importedLocalMusic/moved-collision#.mp3`)
		await write(`${documents}/importedLocalMusic/moved-collision%23.mp3`)
		assert.equal(
			(await resolveLocalFile(`file://${oldDocuments}/importedLocalMusic/moved-collision%23.mp3`))
				.reason,
			'ambiguous',
		)
	})
	await test('raw percent collision selects the literal raw file without decoding', async () => {
		await expectResolved(
			`${oldDocuments}/importedLocalMusic/moved-collision%23.mp3`,
			`${documents}/importedLocalMusic/moved-collision%23.mp3`,
			true,
		)
	})
	await test('complete Documents suffix and Library ImagePicker domain are preserved', async () => {
		await write(`${documents}/regression/nested/Documents/fixture.mp3`, 'fixture')
		await expectResolved(
			`${oldDocuments}/regression/nested/Documents/fixture.mp3`,
			`${documents}/regression/nested/Documents/fixture.mp3`,
			true,
		)
		await write(`${library}/Caches/ImagePicker/cover #é.png`, 'cover')
		await expectResolved(
			uri(`${oldLibrary}/Caches/ImagePicker/cover #é.png`),
			`${library}/Caches/ImagePicker/cover #é.png`,
			true,
		)
	})
	await write(`${documents}/importedLocalMusic/foreign.mp3`, 'must not be borrowed')
	const rejectedRoots = [
		oldDocuments.replace(device, 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE'),
		oldDocuments.replace(temporary, `${temporary}/different-host`),
		oldDocuments.replace('/Data/Application/', '/Shared/AppGroup/'),
		oldDocuments.replace('/Data/Application/', '/Bundle/Application/'),
		oldDocuments.replace(oldId, 'not-a-uuid'),
		`${temporary}/unrelated/Documents`,
		oldDocuments.replace('/Documents', '/tmp'),
	]
	for (const root of rejectedRoots)
		await test(`foreign/root mismatch: ${root.replace(temporary, '<fixture>')}`, async () => {
			const before = h.calls.fs.length
			assert.equal(
				(await resolveLocalFile(`${root}/importedLocalMusic/foreign.mp3`)).status,
				'unresolved',
			)
			assert(
				!h.calls.fs
					.slice(before)
					.some((call) => call.filePath === `${documents}/importedLocalMusic/foreign.mp3`),
			)
		})
	await test('unrecognized Library locations do not rebase', async () => {
		await write(`${library}/Preferences/foreign.png`)
		assert.equal(
			(await resolveLocalFile(`${oldLibrary}/Preferences/foreign.png`)).reason,
			'outside-container',
		)
	})
	for (const address of [
		'file://host/a.mp3',
		'file://localhost/a.mp3',
		'file:relative.mp3',
		'file://file://file:///a.mp3',
		`file://${oldDocuments}/importedLocalMusic/%2e%2e/foreign.mp3`,
		`file://${oldDocuments}/importedLocalMusic/a%2fb.mp3`,
		`file://${oldDocuments}/importedLocalMusic/a%5cb.mp3`,
		`file://${oldDocuments}/importedLocalMusic/bad%ZZ.mp3`,
		`file://${oldDocuments}/importedLocalMusic/bad%E9.mp3`,
		`${oldDocuments}/../Documents/importedLocalMusic/foreign.mp3`,
		`${oldDocuments}//importedLocalMusic/foreign.mp3`,
		'/',
		'//host/path',
		`${documents}/`,
		`${documents}/bad\u0000.mp3`,
	])
		await test(`reject malformed/traversal path: ${JSON.stringify(address.replace(temporary, '<fixture>'))}`, async () => {
			assert.equal((await resolveLocalFile(address)).reason, 'invalid')
		})
	await test('nonlocal and absent values do not touch the filesystem', async () => {
		const before = h.calls.fs.length
		for (const value of [
			undefined,
			null,
			'',
			1,
			{},
			'https://example.test/a%23.mp3',
			'content://provider/file',
			'data:audio/mp3;base64,AAA',
			'asset:/sound',
		]) {
			assert.deepEqual(await resolveLocalFile(value), { status: 'nonlocal' })
		}
		assert.equal(h.calls.fs.length, before)
	})
	await test('directories, linked files and linked relocation ancestry are not regular targets', async () => {
		await fsp.mkdir(`${documents}/importedLocalMusic/directory.mp3`, { recursive: true })
		assert.equal(
			(await resolveLocalFile(`${oldDocuments}/importedLocalMusic/directory.mp3`)).reason,
			'not-file',
		)
		await fsp.symlink(
			`${documents}/importedLocalMusic/ascii.mp3`,
			`${documents}/importedLocalMusic/link.mp3`,
		)
		assert.equal(
			(await resolveLocalFile(`${documents}/importedLocalMusic/link.mp3`)).reason,
			'not-file',
		)
		await write(`${temporary}/external/redirected.mp3`, 'external')
		await fsp.symlink(`${temporary}/external`, `${documents}/importedLocalMusic/linked-directory`)
		assert.equal(
			(await resolveLocalFile(`${oldDocuments}/importedLocalMusic/linked-directory/redirected.mp3`))
				.reason,
			'unsafe-path',
		)
		assert.equal(
			(
				await resolveLocalFile(`${documents}/importedLocalMusic/linked-directory/redirected.mp3`, {
					requireOwnedMedia: true,
				})
			).reason,
			'unsafe-path',
		)
	})
	await test('no positive existence cache and I/O errors cannot select another candidate', async () => {
		const filename = `${documents}/importedLocalMusic/ephemeral.mp3`
		await write(filename)
		await expectResolved(filename, filename, false)
		await fsp.unlink(filename)
		assert.equal((await resolveLocalFile(filename)).reason, 'missing')
		h.hooks.stat = async () => {
			throw new Error('Injected I/O error')
		}
		assert.equal(
			(await resolveLocalFile(`${documents}/importedLocalMusic/ascii.mp3`)).reason,
			'unreadable',
		)
		delete h.hooks.stat
	})
	await test('helper passes raw filesystem paths to the native module', async () => {
		assert(h.calls.fs.every((call) => !call.filePath.startsWith('file://')))
	})
	await test('physical-device /var and /private/var aliases retain exact iOS ancestry', async () => {
		const physical = runtime()
		physical.nativeFs.documentDirectoryPath = `/var/mobile/Containers/Data/Application/${newId}/Documents`
		physical.nativeFs.libraryDirectoryPath = `/var/mobile/Containers/Data/Application/${newId}/Library`
		const target = `${physical.nativeFs.documentDirectoryPath}/download/music/device.mp3`
		const parents = [
			physical.nativeFs.documentDirectoryPath,
			`${physical.nativeFs.documentDirectoryPath}/download`,
			`${physical.nativeFs.documentDirectoryPath}/download/music`,
		]
		physical.nativeFs.exists = async (filePath) => filePath === target
		physical.nativeFs.stat = async (filePath) =>
			filePath === target ? 'file' : parents.includes(filePath) ? 'directory' : 'other'
		const resolver = physical.load('src/helpers/localFile.ts').resolveLocalFile
		assert.deepEqual(
			await resolver(
				`file:///private/var/mobile/Containers/Data/Application/${oldId}/Documents/download/music/device.mp3`,
			),
			{ status: 'resolved', filePath: target, fileUri: uri(target), relocated: true },
		)
		assert.equal(
			(
				await resolver(
					`/var/other/Containers/Data/Application/${oldId}/Documents/download/music/device.mp3`,
				)
			).status,
			'unresolved',
		)
	})

	await test('real source resolver covers current/preload and preserves URI-shaped IDs', async () => {
		const sourceRuntime = runtime()
		const source = sourceRuntime.load('src/player/MusicSourceResolver.ts')
		const saved = deepFreeze(
			item(
				uri(`${oldDocuments}/picker/identity.mp3`),
				`${oldDocuments}/importedLocalMusic/ascii.mp3`,
			),
		)
		const snapshot = JSON.stringify(saved)
		const expected = { url: uri(`${documents}/importedLocalMusic/ascii.mp3`), wasCached: false }
		assert.deepEqual(await source.resolveSource(saved, { requestType: 'current' }), expected)
		assert.deepEqual(await source.resolveSource(saved, { requestType: 'preload' }), expected)
		await source.preloadSource(saved)
		assert.equal(source.getPreloadedUrl(saved), expected.url)
		await source.resolveSource(saved)
		assert.equal(source.getPreloadedUrl(saved), undefined)
		assert.equal(JSON.stringify(saved), snapshot)
		assert.equal(sourceRuntime.calls.cache.length, 0)
		assert.equal(sourceRuntime.calls.writes.length, 0)
		const missing = item('missing', `${oldDocuments}/importedLocalMusic/absent.mp3`)
		assert.equal(
			(await source.resolveSource(missing, { requestType: 'preload' })).url,
			'fixture://fake-audio.mp3',
		)
		assert.equal(sourceRuntime.calls.toasts.length, 0)
		assert.equal((await source.resolveSource(missing)).url, 'fixture://fake-audio.mp3')
		assert.equal(sourceRuntime.calls.toasts.length, 1)
		assert.equal(sourceRuntime.calls.cache.length, 0)
	})
	await test('selected owned import deletes before playback; URI-shaped ID is never a path', async () => {
		const deletion = runtime()
		const facade = deletion.load('src/helpers/trackPlayerIndex.ts').default
		const target = `${documents}/importedLocalMusic/delete #1%.mp3`
		const identityPath = `${documents}/importedLocalMusic/identity-only.mp3`
		await write(target, 'selected')
		await write(identityPath, 'identity is not an address')
		const selected = deepFreeze(
			item(
				uri(`${oldDocuments}/importedLocalMusic/identity-only.mp3`),
				uri(`${oldDocuments}/importedLocalMusic/delete #1%.mp3`),
			),
		)
		const other = deepFreeze(item('keep', `${documents}/importedLocalMusic/ascii.mp3`))
		deletion.stores.importedLocalMusicStore.setValue([other, selected])
		await facade.deleteImportedLocalMusic(selected.id)
		assert.deepEqual(deletion.calls.deletes, [uri(target)])
		assert.equal(await exists(target), false)
		assert.equal(await fsp.readFile(identityPath, 'utf8'), 'identity is not an address')
		assert.deepEqual(deletion.stores.importedLocalMusicStore.getValue(), [other])
		assert.equal(deletion.calls.plays, 0)
	})
	await test('unknown and duplicate selected IDs do not write or delete', async () => {
		const deletion = runtime()
		const facade = deletion.load('src/helpers/trackPlayerIndex.ts').default
		const selected = item('duplicate', `${documents}/importedLocalMusic/ascii.mp3`)
		deletion.stores.importedLocalMusicStore.setValue([selected, { ...selected }])
		await facade.deleteImportedLocalMusic('unknown')
		await facade.deleteImportedLocalMusic('duplicate')
		assert.equal(deletion.calls.deletes.length, 0)
		assert.equal(deletion.calls.writes.length, 0)
		assert.equal(deletion.calls.fs.length, 0)
	})
	await test('missing, empty, unowned, directory, foreign and ambiguous selections never delete a file', async () => {
		const deletion = runtime()
		const facade = deletion.load('src/helpers/trackPlayerIndex.ts').default
		const addresses = [
			'',
			`${oldDocuments}/importedLocalMusic/missing.mp3`,
			`${documents}/importedLocalMusic/directory.mp3`,
			`${documents}/regression/nested/Documents/fixture.mp3`,
			`${library}/Caches/ImagePicker/cover #é.png`,
			`${oldDocuments.replace(device, 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')}/importedLocalMusic/foreign.mp3`,
			`file://${oldDocuments}/importedLocalMusic/moved-collision%23.mp3`,
			'https://example.test/audio.mp3',
		]
		for (const [index, address] of addresses.entries()) {
			const selected = deepFreeze(item(`rejected-${index}`, address))
			const survivor = deepFreeze(item('survivor', `${documents}/importedLocalMusic/ascii.mp3`))
			deletion.stores.importedLocalMusicStore.setValue([selected, survivor])
			await facade.deleteImportedLocalMusic(selected.id)
			assert.deepEqual(deletion.stores.importedLocalMusicStore.getValue(), [survivor])
		}
		assert.equal(deletion.calls.deletes.length, 0)
		assert.equal(await exists(`${documents}/importedLocalMusic/moved-collision#.mp3`), true)
		assert.equal(await exists(`${documents}/importedLocalMusic/moved-collision%23.mp3`), true)
	})
	await test('native deletion errors are awaited, logged and retain the selected record', async () => {
		const deletion = runtime()
		const facade = deletion.load('src/helpers/trackPlayerIndex.ts').default
		const selected = item('cannot-delete', `${documents}/importedLocalMusic/ascii.mp3`)
		deletion.stores.importedLocalMusicStore.setValue([selected])
		deletion.hooks.delete = async () => {
			await Promise.resolve()
			throw new Error('Native deletion rejected')
		}
		await facade.deleteImportedLocalMusic(selected.id)
		assert.equal(deletion.calls.errors.length, 1)
		assert.deepEqual(deletion.stores.importedLocalMusicStore.getValue(), [selected])
		assert.equal(deletion.calls.writes.length, 0)
	})
	await test('async deletion preserves concurrent list additions', async () => {
		const deletion = runtime()
		const facade = deletion.load('src/helpers/trackPlayerIndex.ts').default
		await write(`${documents}/importedLocalMusic/concurrent.mp3`)
		const selected = item('concurrent', `${oldDocuments}/importedLocalMusic/concurrent.mp3`)
		const added = item('added', 'https://example.test/added.mp3')
		deletion.stores.importedLocalMusicStore.setValue([selected])
		const entered = deferred()
		const finish = deferred()
		deletion.hooks.delete = async () => {
			entered.resolve()
			await finish.promise
		}
		const pending = facade.deleteImportedLocalMusic(selected.id)
		await entered.promise
		deletion.stores.importedLocalMusicStore.setValue([selected, added])
		finish.resolve()
		await pending
		assert.deepEqual(deletion.stores.importedLocalMusicStore.getValue(), [added])
	})
	await test('replaced selected record is rechecked after file resolution', async () => {
		const deletion = runtime()
		const facade = deletion.load('src/helpers/trackPlayerIndex.ts').default
		const selected = item('replaced', `${documents}/importedLocalMusic/ascii.mp3`)
		const replacement = { ...selected, title: 'Changed during resolution' }
		deletion.stores.importedLocalMusicStore.setValue([selected])
		deletion.hooks.stat = async () => {
			deletion.stores.importedLocalMusicStore.setValue([replacement])
		}
		await facade.deleteImportedLocalMusic(selected.id)
		assert.equal(deletion.calls.deletes.length, 0)
		assert.deepEqual(deletion.stores.importedLocalMusicStore.getValue(), [replacement])
	})
	await test('fresh import retains destination naming and the original picker URI ID', async () => {
		const importing = runtime()
		const facade = importing.load('src/helpers/trackPlayerIndex.ts').default
		const pickerPath = `${temporary}/picker/selected.mp3`
		await write(pickerPath, 'picked bytes')
		const selected = item(uri(pickerPath), uri(pickerPath), { title: '升级 #1', artist: 'A/B' })
		await facade.addImportedLocalMusic([selected], true)
		const saved = importing.stores.importedLocalMusicStore.getValue()[0]
		const expected = `${documents}/importedLocalMusic/升级 #1-A-B.mp3`
		assert.equal(saved.id, uri(pickerPath))
		assert.equal(saved.url, expected)
		assert.equal(await fsp.readFile(expected, 'utf8'), 'picked bytes')
		assert.equal(
			(await importing.load('src/player/MusicSourceResolver.ts').resolveSource(saved)).url,
			uri(expected),
		)
	})
	await test('already-cached import produces exactly one scheme with the same path', async () => {
		const importing = runtime()
		const facade = importing.load('src/helpers/trackPlayerIndex.ts').default
		const expected = `${documents}/musicCache/cache-id.mp3`
		await write(expected, 'cached bytes')
		await facade.cacheAndImportMusic(item('cache-id', 'https://example.test/music.mp3'))
		assert.equal(importing.stores.importedLocalMusicStore.getValue()[0].url, uri(expected))
		assert.equal(await fsp.readFile(expected, 'utf8'), 'cached bytes')
	})
	await test('dangling links remain links and cannot select another URI interpretation', async () => {
		const dangling = `${documents}/importedLocalMusic/dangling.mp3`
		await fsp.symlink(`${temporary}/absent`, dangling)
		assert.equal((await resolveLocalFile(dangling, { requireOwnedMedia: true })).reason, 'not-file')
		await write(`${documents}/importedLocalMusic/dangling-collision#.mp3`)
		await fsp.symlink(
			`${temporary}/absent`,
			`${documents}/importedLocalMusic/dangling-collision%23.mp3`,
		)
		assert.equal(
			(await resolveLocalFile(`file://${documents}/importedLocalMusic/dangling-collision%23.mp3`))
				.reason,
			'ambiguous',
		)
	})
	await test('existence errors remain unreadable rather than selecting another candidate', async () => {
		h.hooks.exists = async (filePath) => {
			if (filePath.endsWith('collision%23.mp3')) throw new Error('Injected existence error')
		}
		try {
			assert.equal(
				(await resolveLocalFile(`file://${documents}/importedLocalMusic/collision%23.mp3`)).reason,
				'unreadable',
			)
		} finally {
			delete h.hooks.exists
		}
	})
	await test('synchronous native roots reach the unchanged MMKV factory verbatim', async () => {
		const storage = runtime()
		const roots = storage.load('src/store/pathConst.ts')
		assert.equal(roots.basePath, documents)
		assert.equal(roots.default.mmkvPath, `${documents}/mmkv`)
		assert.equal(roots.default.mmkvCachePath, `${documents}/cache/mmkv`)
		assert.equal(roots.default.musicCachePath, `${library}/Caches/TrackPlayer`)
		const factory = storage.load('src/store/getOrCreateMMKV.ts').default
		const primary = factory('appPersistStatus')
		const cached = factory('MediaExtra.local', true)
		assert.equal(factory('appPersistStatus'), primary)
		assert.equal(factory('MediaExtra.local', true), cached)
		assert.deepEqual(storage.calls.mmkv, [
			{ id: 'appPersistStatus', path: `${documents}/mmkv` },
			{ id: 'MediaExtra.local', path: `${documents}/cache/mmkv` },
		])
		assert.equal(storage.calls.writes.length, 0)
	})
}

main()
	.catch((error) => {
		checks.push({ name: 'fixture setup', passed: false, error: error.stack })
	})
	.finally(async () => {
		await fixture.dispose()
		const failed = checks.filter((check) => !check.passed)
		console.log(
			JSON.stringify(
				{
					check: 'local-files',
					projectRoot,
					passed: checks.length - failed.length,
					failed: failed.length,
					failures: failed,
					limitations: [
						'Production TypeScript helper/resolver/facade executed against real dedicated temporary files; native APIs, RNTP, persistence and unrelated state owners are mocked.',
						'Physical-device root aliases use exact path fixtures, not a physical filesystem.',
						'No native playback, sharing, MMKV/AsyncStorage compatibility, simulator data, or first/second native launch is established by this script.',
					],
				},
				null,
				2,
			),
		)
		if (failed.length) process.exitCode = 1
	})
