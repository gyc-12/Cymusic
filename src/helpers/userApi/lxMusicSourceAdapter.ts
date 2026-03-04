/**
 * lx-music 音源脚本适配器
 *
 * 将 lx-music 格式的音源脚本（JSDoc 头部 + globalThis.lx 事件系统）
 * 转换为 Cymusic 的 IMusic.MusicApi 格式（CommonJS getMusicUrl 函数）
 */

import { logError, logInfo } from '../logger'

// ============================================================
// 格式检测
// ============================================================

/**
 * 检测脚本是否为 lx-music 格式
 *
 * lx-music 脚本特征：
 * 1. 以 JSDoc 风格的块注释开头，包含 @name 等标签
 * 2. 脚本中引用 globalThis.lx / lx.on / lx.send / EVENT_NAMES
 */
export const isLxMusicScript = (script: string): boolean => {
	// 检测 JSDoc 头部注释
	const hasHeader = /^\/\*[\s\S]+?\*\//.test(script.trim())
	if (!hasHeader) return false

	// 检测 lx-music 特有的 API 调用特征
	const hasLxApi =
		/\bEVENT_NAMES\b/.test(script) ||
		/\blx\s*\.\s*(on|send)\b/.test(script) ||
		/\blxu?\s*\.\s*(on|send|request|EVENT_NAMES)\b/.test(script) ||
		/\bglobalThis\s*\.\s*lx/.test(script)

	// 排除 Cymusic 自有格式（有 module.exports.getMusicUrl）
	const isCymusicFormat = /module\s*\.\s*exports\s*\.\s*getMusicUrl/.test(script)

	return hasLxApi && !isCymusicFormat
}

// ============================================================
// 元信息解析
// ============================================================

const INFO_NAMES = {
	name: 24,
	description: 256,
	author: 56,
	homepage: 1024,
	version: 36,
} as const

type InfoKeys = keyof typeof INFO_NAMES

export const parseLxMusicScriptInfo = (
	script: string,
): Record<InfoKeys, string> => {
	const headerMatch = /^\/\*[\s\S]+?\*\//.exec(script.trim())
	const infos: Partial<Record<InfoKeys, string>> = {}

	if (headerMatch) {
		const lines = headerMatch[0].split(/\r?\n/)
		const rxp = /^\s?\*\s?@(\w+)\s(.+)$/
		for (const line of lines) {
			const result = rxp.exec(line)
			if (!result) continue
			const key = result[1] as InfoKeys
			if (INFO_NAMES[key] == null) continue
			infos[key] = result[2].trim()
		}
	}

	// 填充默认值并截断
	for (const [key, maxLen] of Object.entries(INFO_NAMES) as Array<
		[InfoKeys, number]
	>) {
		infos[key] ||= ''
		if (infos[key]!.length > maxLen)
			infos[key] = infos[key]!.substring(0, maxLen) + '...'
	}

	return infos as Record<InfoKeys, string>
}

// ============================================================
// 核心适配：构建 lx-music 运行时并提取 getMusicUrl
// ============================================================

interface LxRequestHandler {
	(params: {
		source: string
		action: string
		info: { musicInfo: any; type: string }
	}): Promise<any>
}

/**
 * 为 lx-music 脚本创建精简运行时环境，
 * 执行脚本后提取 request handler，
 * 包装为 Cymusic 的 getMusicUrl 函数。
 */
const buildLxMusicRuntime = (
	script: string,
): {
	getMusicUrl: (
		title: string,
		artist: string,
		songmid: string,
		quality: string,
	) => Promise<string>
	sources: Record<string, any> | null
} => {
	let requestHandler: LxRequestHandler | null = null
	let initSources: Record<string, any> | null = null

	// ---- 模拟 lx-music 运行时 API ----
	const EVENT_NAMES = {
		request: 'request',
		inited: 'inited',
		updateAlert: 'updateAlert',
	}

	const lxRuntime = {
		EVENT_NAMES,
		version: '2.0.0',
		env: 'mobile',

		on(eventName: string, handler: LxRequestHandler) {
			if (eventName === EVENT_NAMES.request) {
				requestHandler = handler
			}
			return Promise.resolve()
		},

		send(eventName: string, data: any) {
			if (eventName === EVENT_NAMES.inited && data?.sources) {
				initSources = data.sources
			}
			return Promise.resolve()
		},

		request(
			url: string,
			options: any,
			callback: (err: any, resp: any, body: any) => void,
		) {
			const controller = new AbortController()
			const timeoutMs =
				options?.timeout && typeof options.timeout === 'number'
					? Math.min(options.timeout, 60000)
					: 30000

			const timer = setTimeout(() => controller.abort(), timeoutMs)

			const fetchOptions: RequestInit = {
				method: options?.method?.toUpperCase() || 'GET',
				headers: options?.headers || {},
				signal: controller.signal,
			}

			if (options?.body) {
				fetchOptions.body =
					typeof options.body === 'string'
						? options.body
						: JSON.stringify(options.body)
			}

			fetch(url, fetchOptions)
				.then(async (response) => {
					clearTimeout(timer)
					let body: any
					const contentType = response.headers.get('content-type') || ''
					if (contentType.includes('json')) {
						body = await response.json()
					} else {
						body = await response.text()
					}
					const headerObj: Record<string, string> = {}
					response.headers.forEach((value: string, key: string) => {
						headerObj[key] = value
					})
					const resp = {
						statusCode: response.status,
						statusMessage: response.statusText,
						headers: headerObj,
						body,
					}
					callback(null, resp, body)
				})
				.catch((err) => {
					clearTimeout(timer)
					callback(err, null, null)
				})

			return () => {
				controller.abort()
			}
		},

		currentScriptInfo: {} as any,

		utils: {
			crypto: {
				md5(str: string) {
					return str
				},
				aesEncrypt() {
					throw new Error('aesEncrypt not supported in adapter')
				},
				rsaEncrypt() {
					throw new Error('rsaEncrypt not supported in adapter')
				},
				randomBytes(size: number) {
					const arr = new Uint8Array(size)
					for (let i = 0; i < size; i++) {
						arr[i] = Math.floor(Math.random() * 256)
					}
					return arr
				},
			},
			buffer: {
				from(input: any, encoding?: string) {
					if (typeof input === 'string') {
						if (encoding === 'base64') {
							const binaryStr = atob(input)
							const bytes = new Uint8Array(binaryStr.length)
							for (let i = 0; i < binaryStr.length; i++) {
								bytes[i] = binaryStr.charCodeAt(i)
							}
							return bytes
						}
						if (encoding === 'hex') {
							const matches = input.match(/.{1,2}/g) || []
							return new Uint8Array(
								matches.map((byte: string) => parseInt(byte, 16)),
							)
						}
						return new TextEncoder().encode(input)
					}
					if (Array.isArray(input)) return new Uint8Array(input)
					throw new Error('Unsupported input type')
				},
				bufToString(buf: any, format?: string) {
					const bytes =
						buf instanceof Uint8Array ? buf : new Uint8Array(Array.from(buf))
					if (format === 'hex') {
						return bytes.reduce(
							(str: string, byte: number) =>
								str + byte.toString(16).padStart(2, '0'),
							'',
						)
					}
					if (format === 'base64') {
						let binaryStr = ''
						bytes.forEach((byte: number) => {
							binaryStr += String.fromCharCode(byte)
						})
						return btoa(binaryStr)
					}
					return new TextDecoder().decode(bytes)
				},
			},
		},
	}

	// ---- 执行脚本 ----
	try {
		const wrappedScript = `
			var EVENT_NAMES = __lxRuntime__.EVENT_NAMES;
			var on = __lxRuntime__.on.bind(__lxRuntime__);
			var send = __lxRuntime__.send.bind(__lxRuntime__);

			var lx = __lxRuntime__;
			if (typeof globalThis !== 'undefined') {
				globalThis.lx = __lxRuntime__;
				globalThis.lxu = __lxRuntime__;
			}

			if (typeof httpFetch === 'undefined') {
				var httpFetch = function(url, options) {
					return {
						promise: new Promise(function(resolve, reject) {
							__lxRuntime__.request(url, options || {}, function(err, resp, body) {
								if (err) reject(err);
								else resolve({ statusCode: resp.statusCode, body: body, headers: resp.headers });
							});
						})
					};
				};
			}

			${script}
		`

		const scriptFn = new Function('__lxRuntime__', 'console', wrappedScript)
		scriptFn(lxRuntime, console)
	} catch (err) {
		logError('[lxMusicAdapter] Script execution error:', err)
		throw new Error(
			`lx-music 脚本执行失败: ${err instanceof Error ? err.message : String(err)}`,
		)
	}

	if (!requestHandler) {
		logInfo(
			'[lxMusicAdapter] No request handler registered via lx.on, trying direct export detection',
		)
	}

	// ---- 构造 getMusicUrl ----
	const capturedHandler = requestHandler

	const getMusicUrl = async (
		title: string,
		artist: string,
		songmid: string,
		quality: string,
	): Promise<string> => {
		if (!capturedHandler) {
			throw new Error('lx-music 脚本未注册 request handler')
		}

		// 确定音源 source：默认使用 tx (QQ音乐)
		let source = 'tx'
		if (initSources) {
			const availableSources = Object.keys(initSources)
			if (availableSources.length > 0 && !availableSources.includes('tx')) {
				source = availableSources[0]
			}
		}

		const musicInfo = {
			id: songmid,
			songmid: songmid,
			title: title,
			name: title,
			singer: artist,
			artist: artist,
			source: source,
			hash: songmid,
		}

		logInfo(
			`[lxMusicAdapter] getMusicUrl: source=${source}, title=${title}, quality=${quality}`,
		)

		try {
			const result = await capturedHandler({
				source,
				action: 'musicUrl',
				info: {
					musicInfo,
					type: quality || '128k',
				},
			})

			if (typeof result === 'string' && /^https?:/.test(result)) {
				return result
			}

			if (result && typeof result === 'object' && result.url) {
				return result.url
			}

			throw new Error('返回结果格式不正确')
		} catch (err) {
			logError('[lxMusicAdapter] getMusicUrl error:', err)
			throw err
		}
	}

	return { getMusicUrl, sources: initSources }
}

// ============================================================
// 公开适配接口
// ============================================================

/**
 * 将 lx-music 格式脚本适配为 Cymusic 的 MusicApi 对象
 */
export const adaptLxMusicScript = (script: string): IMusic.MusicApi => {
	const info = parseLxMusicScriptInfo(script)
	const { getMusicUrl } = buildLxMusicRuntime(script)

	const musicApi: IMusic.MusicApi = {
		id:
			info.name
				? `lx_${info.name.replace(/\s+/g, '_')}_${Date.now()}`
				: `lx_api_${Date.now()}`,
		platform: 'tx',
		author: info.author || '',
		name: info.name || `lx-music 音源`,
		version: info.version || '',
		srcUrl: info.homepage || '',
		script: script,
		scriptType: 'lxmusic' as const,
		isSelected: false,
		getMusicUrl,
	}

	logInfo(`[lxMusicAdapter] Adapted lx-music source: ${musicApi.name}`)
	return musicApi
}

/**
 * 重新加载一个 lx-music 格式的脚本（从已保存的 script 文本重建 getMusicUrl）
 */
export const reloadLxMusicScript = (
	musicApi: IMusic.MusicApi,
): IMusic.MusicApi => {
	try {
		const { getMusicUrl } = buildLxMusicRuntime(musicApi.script)
		return {
			...musicApi,
			getMusicUrl,
		}
	} catch (err) {
		logError(
			`[lxMusicAdapter] Failed to reload lx-music script "${musicApi.name}":`,
			err,
		)
		return musicApi
	}
}
