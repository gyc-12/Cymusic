import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export { assert }

export function loadModule(relativePath, mocks, globals = {}, hot) {
	const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
	const compiled = ts.transpileModule(source, {
		fileName: relativePath,
		compilerOptions: {
			module: ts.ModuleKind.CommonJS,
			jsx: ts.JsxEmit.React,
			target: ts.ScriptTarget.ES2022,
			esModuleInterop: true,
		},
	}).outputText
	const module = { exports: {}, hot }
	const context = vm.createContext({
		console,
		setTimeout,
		clearTimeout,
		setInterval,
		clearInterval,
		AbortController,
		Buffer,
		...globals,
		module,
		exports: module.exports,
		require(name) {
			if (Object.hasOwn(mocks, name)) return mocks[name]
			throw new Error(`Unexpected dependency in ${relativePath}: ${name}`)
		},
	})
	context.global = context
	new vm.Script(compiled, { filename: relativePath }).runInContext(context)
	return module.exports
}

export function deferred() {
	let resolve
	let reject
	const promise = new Promise((resolvePromise, rejectPromise) => {
		resolve = resolvePromise
		reject = rejectPromise
	})
	return { promise, resolve, reject }
}

export async function flush() {
	for (let index = 0; index < 10; index++) await Promise.resolve()
}

export function checks() {
	let passed = 0
	let failed = 0
	return {
		async check(name, run) {
			try {
				await run()
				passed++
				console.log(`PASS ${name}`)
			} catch (error) {
				failed++
				console.error(`FAIL ${name}`, error)
			}
		},
		finish() {
			console.log(`${passed} passed, ${failed} failed`)
			if (failed) process.exitCode = 1
		},
	}
}
