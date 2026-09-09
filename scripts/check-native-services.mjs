import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { root } from './native-services-fixture.mjs'

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'cymusic-native-services-'))
try {
	const executable = path.join(temporary, 'native-services')
	const compilation = spawnSync('xcrun', [
		'swiftc', '-swift-version', '5', '-module-cache-path', path.join(temporary, 'modules'),
		path.join(root, 'modules/cymusic-native/ios/CyMusicDeadlineTimer.swift'),
		path.join(root, 'modules/cymusic-native/ios/CyMusicRequestTaskRegistry.swift'),
		path.join(root, 'scripts/fixtures/native-services-probe.swift'), '-o', executable,
	], { encoding: 'utf8' })
	if (compilation.stdout) process.stdout.write(compilation.stdout)
	if (compilation.stderr) process.stderr.write(compilation.stderr)
	if (compilation.error) console.error(compilation.error)
	if (compilation.signal) console.error(`Swift compilation terminated by ${compilation.signal}`)
	if (compilation.status !== 0) process.exitCode = compilation.status ?? 1
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
