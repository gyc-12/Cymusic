import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { root } from './native-services-fixture.mjs'

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cymusic-volume-observation-'))
try {
	const source = fs.readFileSync(path.join(root, 'modules/cymusic-native/ios/CyMusicVolumeModule.swift'), 'utf8')
	// Keep the actual module body. Only its unavailable iOS/Expo imports are replaced for this macOS KVO probe.
	const probeSource = 'import Foundation\nimport CoreGraphics\n' + source.replace(/^import (AVFoundation|ExpoModulesCore|MediaPlayer|UIKit)\n/gm, '')
	const modulePath = path.join(temporary, 'CyMusicVolumeModule.swift')
	const executable = path.join(temporary, 'volume-observation')
	fs.writeFileSync(modulePath, probeSource)
	const compilation = spawnSync('xcrun', [
		'swiftc', '-swift-version', '5', '-module-cache-path', path.join(temporary, 'modules'),
		modulePath, path.join(root, 'scripts/fixtures/volume-observation-probe.swift'), '-o', executable,
	], { encoding: 'utf8' })
	if (compilation.stdout) process.stdout.write(compilation.stdout)
	if (compilation.stderr) process.stderr.write(compilation.stderr)
	if (compilation.error) console.error(compilation.error)
	if (compilation.signal) console.error(`Swift compilation terminated by ${compilation.signal}`)
	if (compilation.status !== 0) process.exitCode = compilation.status || 1
	else {
		const result = spawnSync(executable, { encoding: 'utf8' })
		if (result.stdout) process.stdout.write(result.stdout)
		if (result.stderr) process.stderr.write(result.stderr)
		if (result.error) console.error(result.error)
		if (result.signal) console.error(`Native probe terminated by ${result.signal}`)
		process.exitCode = result.status ?? 1
	}
} finally {
	fs.rmSync(temporary, { recursive: true, force: true })
}
