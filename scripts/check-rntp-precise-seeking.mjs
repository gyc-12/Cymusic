import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Quick policy checks by default. Optional decoded-content capture:
//   node scripts/check-rntp-precise-seeking.mjs --pcm /private/config.json
//     [--simulator UUID]
// Content matching is separate: scripts/fixtures/match-rntp-pcm.py. No source
// URLs, media or generated compiler files enter the repository.
const root = fileURLToPath(new URL('../', import.meta.url))
const packageRoot = path.join(root, 'node_modules/@rntp/player')
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
assert.equal(manifest.name, '@rntp/player')
assert.equal(manifest.version, '5.9.2')
assert.equal(process.platform, 'darwin', 'Native checks require macOS and Xcode')

function between(source, start, end) {
	const from = source.indexOf(start)
	assert.notEqual(from, -1, `Missing native source boundary: ${start}`)
	assert.equal(source.indexOf(start, from + start.length), -1, `Ambiguous boundary: ${start}`)
	const to = source.indexOf(end, from + start.length)
	assert.notEqual(to, -1, `Missing native source boundary: ${end}`)
	return source.slice(from, to)
}

function inject(template, marker, source) {
	assert.equal(template.split(marker).length, 2, `Missing/ambiguous fixture marker: ${marker}`)
	return template.replace(marker, () => source)
}

function run(command, args, timeout = 60000) {
	const result = spawnSync(command, args, { encoding: 'utf8', timeout })
	if (result.stdout) process.stdout.write(result.stdout)
	if (result.stderr) process.stderr.write(result.stderr)
	if (result.error) console.error(result.error.message)
	if (result.signal) console.error(`Native precise-seeking probe terminated by ${result.signal}`)
	assert.equal(result.error, undefined, 'Native command failed to execute')
	assert.equal(result.signal, null, 'Native command terminated by signal')
	assert.equal(result.status, 0, 'Native command returned a nonzero exit code')
	return result.stdout.trim()
}

const args = process.argv.slice(2)
let configPath
let simulator
for (let i = 0; i < args.length; i++) {
	const flag = args[i]
	assert.ok(['--pcm', '--simulator'].includes(flag), `Unknown argument: ${flag}`)
	const value = args[++i]
	assert.ok(value && !value.startsWith('--'), `Missing value for ${flag}`)
	if (flag === '--pcm') {
		assert.equal(configPath, undefined, 'Duplicate --pcm')
		configPath = path.resolve(value)
	} else {
		assert.equal(simulator, undefined, 'Duplicate --simulator')
		simulator = value
	}
}
assert.ok(!simulator || configPath, '--simulator requires --pcm')

const source = fs.readFileSync(path.join(packageRoot, 'ios/player/AVPlayerEngine.swift'), 'utf8')
const copyright = source.slice(0, source.indexOf('import AVFoundation'))
const context = between(
	source,
	'  /// Origin context for a one-shot direct fallback.',
	'  static func liveEdgeTarget(',
)
const loading = between(
	source,
	'  func load(url: URL,',
	'  private func prepareCachedMetadataReplay(',
)
const seek = between(source, '  func seek(to seconds:', '  func seekToLiveEdge(')
const cancelRefresh = between(source, '  private func cancelLiveRefresh()', '  func reset()')
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cymusic-rntp-precise-'))

try {
	let template = fs.readFileSync(
		path.join(
			root,
			'scripts/fixtures',
			configPath ? 'rntp-precise-pcm-probe.swift' : 'rntp-precise-policy-probe.swift',
		),
		'utf8',
	)
	template = inject(template, '// @RNTP_SOURCE_CONTEXT@', context)
	template = inject(template, '// @RNTP_LOADING_METHODS@', loading)
	template = inject(template, '// @RNTP_CANCEL_REFRESH@', cancelRefresh)
	const swiftSources = []
	if (configPath) {
		template = inject(template, '// @RNTP_SEEK_METHOD@', seek)
	} else {
		const item = fs.readFileSync(path.join(packageRoot, 'ios/models/MediaItem.swift'), 'utf8')
		const audioPlayer = fs.readFileSync(
			path.join(packageRoot, 'ios/player/AudioPlayer.swift'),
			'utf8',
		)
		template = inject(
			template,
			'// @RNTP_MEDIA_ITEM@',
			between(item, 'struct MediaItem {', '  func getArtwork(') + '}\n',
		)
		template = inject(
			template,
			'// @RNTP_ENGINE_INIT@',
			between(source, '  init(handleAudioBecomingNoisy:', '  deinit {'),
		)
		template = inject(
			template,
			'// @RNTP_REFRESH_METHODS@',
			between(source, '  private func refreshLiveSource(', '  private func cancelLiveRefresh()'),
		)
		template = inject(
			template,
			'// @RNTP_RESET_AND_FAILURE@',
			between(source, '  func reset()', '  // MARK: - Audio Interruption Handling'),
		)
		template = inject(
			template,
			'// @RNTP_PLAYER_TRANSPORT@',
			between(audioPlayer, '  func play() {', '  // MARK: - Queue: Load / Set'),
		)
		template = inject(
			template,
			'// @RNTP_PLAYER_LOAD_ITEM@',
			between(audioPlayer, '  func load(item: AudioItem)', '  func set(items newItems:'),
		)
		template = inject(
			template,
			'// @RNTP_PLAYER_LOAD_CURRENT@',
			between(
				audioPlayer,
				'  private func loadCurrentItem(',
				'  /// Check if auto preloading should trigger',
			),
		)
		for (const relative of [
			'models/MediaURL.swift',
			'player/AudioItem.swift',
			'player/PlayerEngine.swift',
			'player/PlayerState.swift',
			'player/QueueManager.swift',
		]) {
			swiftSources.push(path.join(packageRoot, 'ios', relative))
		}
	}
	assert.equal(/\/\/ @RNTP_[A-Z_]+@/.test(template), false, 'Unexpanded production-source marker')
	const generated = path.join(temporary, 'RNTPPreciseProbe.swift')
	fs.writeFileSync(generated, copyright + template)
	swiftSources.push(generated)
	const executable = path.join(temporary, 'rntp-precise-probe')
	const compilerArgs = [
		'swiftc',
		'-swift-version',
		'5',
		'-parse-as-library',
		'-module-cache-path',
		path.join(temporary, 'modules'),
	]
	if (configPath) {
		const architecture = process.arch === 'arm64' ? 'arm64' : 'x86_64'
		if (simulator) {
			const sdk = run('xcrun', ['--sdk', 'iphonesimulator', '--show-sdk-path'])
			compilerArgs.push('-sdk', sdk, '-target', `${architecture}-apple-ios18.0-simulator`)
		} else {
			compilerArgs.push('-target', `${architecture}-apple-macos15.0`)
		}
	}
	run('xcrun', [...compilerArgs, ...swiftSources, '-o', executable])
	if (configPath) {
		const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
		const maxWall = config.maxWallSeconds ?? 45
		assert.ok(Number.isFinite(maxWall) && maxWall > 0 && maxWall <= 600)
		assert.ok(typeof config.outputDirectory === 'string' && path.isAbsolute(config.outputDirectory))
		if (simulator) {
			run('codesign', ['--force', '--sign', '-', executable])
			run('xcrun', ['simctl', 'spawn', simulator, executable, configPath], (maxWall + 15) * 1000)
		} else {
			run(executable, [configPath], (maxWall + 15) * 1000)
		}
		const report = JSON.parse(
			fs.readFileSync(path.join(config.outputDirectory, 'report.json'), 'utf8'),
		)
		assert.equal(report.measurementValid, true, 'Invalid PCM capture')
		assert.ok(report.capturedFrames > 0 && report.bufferCount > 0, 'Empty PCM capture')
		console.log(
			'PCM captured through installed RNTP methods; independent content matching is still required.',
		)
	} else {
		run(executable, [])
	}
} finally {
	fs.rmSync(temporary, { recursive: true, force: true })
}
