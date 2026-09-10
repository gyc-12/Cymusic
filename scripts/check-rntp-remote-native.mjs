import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// An optional package-root argument runs the same behavioral probe against the
// unpatched, verified 5.9.2 source. The normal check always uses the installed package.
const root = fileURLToPath(new URL('../', import.meta.url))
const packageRoot = path.resolve(process.argv[2] ?? path.join(root, 'node_modules/@rntp/player'))
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'))
assert.equal(manifest.name, '@rntp/player')
assert.equal(manifest.version, '5.9.2')

function between(source, start, end) {
	const from = source.indexOf(start)
	assert.notEqual(from, -1, `Missing native source boundary: ${start}`)
	const to = source.indexOf(end, from + start.length)
	assert.notEqual(to, -1, `Missing native source boundary: ${end}`)
	return source.slice(from, to)
}

function run(command, args) {
	const result = spawnSync(command, args, { encoding: 'utf8', timeout: 60000 })
	if (result.stdout) process.stdout.write(result.stdout)
	if (result.stderr) process.stderr.write(result.stderr)
	if (result.error) console.error(result.error)
	if (result.signal) console.error(`Native remote probe terminated by ${result.signal}`)
	return result.status ?? 1
}

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cymusic-rntp-remote-'))
try {
	const source = fs.readFileSync(path.join(packageRoot, 'ios/TrackPlayer.swift'), 'utf8')
	const controller = fs.readFileSync(
		path.join(packageRoot, 'ios/player/RemoteCommandController.swift'),
		'utf8',
	)
	// Compile the actual handlers and routing methods unchanged. Only the iOS
	// player/system boundary is replaced by Swift stand-ins; no routing is mirrored.
	const routing = between(
		source,
		'  private func makeCommandHandlers()',
		'\n}\n\nextension TrackPlayer {',
	)
	const handlers = between(controller, 'struct RemoteCommandHandlers {', '\n}') + '\n}'
	const copyright = source.slice(0, source.indexOf('import React'))
	const extracted = path.join(temporary, 'TrackPlayerRemoteCommands.swift')
	fs.writeFileSync(
		extracted,
		`${copyright}import Foundation\n${handlers}\n\nextension TrackPlayer {\n${routing}\n  func probeHandlers() -> RemoteCommandHandlers { makeCommandHandlers() }\n}\n`,
	)
	const executable = path.join(temporary, 'rntp-remote-probe')
	const compilationStatus = run('xcrun', [
		'swiftc',
		'-swift-version',
		'5',
		'-module-cache-path',
		path.join(temporary, 'modules'),
		path.join(packageRoot, 'ios/models/EmitEvent.swift'),
		path.join(packageRoot, 'ios/models/RemoteControlHandling.swift'),
		path.join(packageRoot, 'ios/player/PlayerCommand.swift'),
		path.join(packageRoot, 'ios/player/PlayerState.swift'),
		path.join(packageRoot, 'ios/player/PlayerEngine.swift'),
		extracted,
		path.join(root, 'scripts/fixtures/rntp-remote-probe.swift'),
		'-o',
		executable,
	])
	process.exitCode = compilationStatus === 0 ? run(executable, []) : compilationStatus
} finally {
	fs.rmSync(temporary, { recursive: true, force: true })
}
