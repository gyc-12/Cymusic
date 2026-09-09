// macOS Foundation/JavaScriptCore check, without Xcode builds, Pods or test packages.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { createCipheriv, createHash, generateKeyPairSync, publicEncrypt, constants } from 'node:crypto'

const root = fileURLToPath(new URL('../', import.meta.url))
const temporaryRoot = process.env.CYMUSIC_SOURCE_CHECK_OUTPUT ?? os.tmpdir()
fs.mkdirSync(temporaryRoot, { recursive: true })
const temporary = fs.mkdtempSync(path.join(temporaryRoot, 'cymusic-source-check-'))
const nativeRoot = path.join(root, 'modules/cymusic-native/ios')
const aes = (mode, input, iv) => {
	const cipher = createCipheriv(mode, '0123456789abcdef', iv)
	if (mode.endsWith('ecb')) cipher.setAutoPadding(false)
	return Buffer.concat([cipher.update(input), cipher.final()]).toString('hex')
}
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 1024 })
const keyBody = publicKey.export({ type: 'pkcs1', format: 'der' }).toString('base64')
const rsaInput = '\0'.repeat(127) + '*'
const rsa = publicEncrypt({ key: publicKey, padding: constants.RSA_NO_PADDING }, Buffer.from(rsaInput)).toString('hex')
const vectors = {
	script: `const u = lx.utils; let evalBlocked = false, functionBlocked = false;
		try { eval('1') } catch { evalBlocked = true }
		try { Function('return 1') } catch { functionBlocked = true }
		console.log('CRYPTO:' + JSON.stringify({
			version: lx.version, env: lx.env, frozen: Object.isFrozen(lx), evalBlocked, functionBlocked,
			interval: typeof setInterval,
			md5: u.crypto.md5('音源 % café'),
			base64: u.buffer.bufToString(u.buffer.from('plain fixture'), 'base64'),
			bytes: u.buffer.bufToString(u.buffer.from('AH+A/w==', 'base64'), 'hex'),
			cbc: u.buffer.bufToString(u.crypto.aesEncrypt('hello 音源', 'aes-128-cbc', '0123456789abcdef', 'abcdef0123456789'), 'hex'),
			ecb: u.buffer.bufToString(u.crypto.aesEncrypt('0123456789abcdef', 'aes-128-ecb', '0123456789abcdef'), 'hex'),
			rsa: u.buffer.bufToString(u.crypto.rsaEncrypt(${JSON.stringify(rsaInput)}, ${JSON.stringify(`-----BEGIN PUBLIC KEY-----${keyBody}-----END PUBLIC KEY-----`)}), 'hex')
		}));`,
	expected: {
		version: '2.0.0', env: 'mobile', frozen: true, evalBlocked: true, functionBlocked: true,
		interval: 'undefined', md5: createHash('md5').update('音源 % café').digest('hex'),
		base64: Buffer.from('plain fixture').toString('base64'), bytes: '007f80ff',
		cbc: aes('aes-128-cbc', 'hello 音源', 'abcdef0123456789'),
		ecb: aes('aes-128-ecb', '0123456789abcdef', null), rsa,
	},
}

try {
	const sdk = execFileSync('xcrun', ['--sdk', 'macosx', '--show-sdk-path'], { encoding: 'utf8' }).trim()
	const fixture = path.join(temporary, 'vectors.json')
	const binary = path.join(temporary, 'check-source-runtime')
	fs.writeFileSync(fixture, JSON.stringify(vectors))
	execFileSync('xcrun', ['clang', '-fobjc-arc', '-fmodules', `-fmodules-cache-path=${temporary}/ModuleCache`,
		'-Wno-deprecated-declarations', '-Wno-nullability-completeness', '-isysroot', sdk,
		'-I', nativeRoot, path.join(nativeRoot, 'CyMusicUserApiRuntime.m'), path.join(root, 'scripts/check-source-runtime.m'),
		'-framework', 'Foundation', '-framework', 'JavaScriptCore', '-framework', 'Security', '-o', binary,
	], { stdio: 'inherit' })
	execFileSync(binary, [path.join(root, 'ios/CyMusic/user-api-preload.js'), fixture], { stdio: 'inherit', timeout: 15000 })
} catch (error) {
	if (typeof error.status === 'number') process.exitCode = error.status
	else throw error
} finally {
	fs.rmSync(temporary, { recursive: true, force: true })
}
