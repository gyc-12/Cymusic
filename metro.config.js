// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro loads this config as CommonJS.
const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

config.resolver.resolveRequest = (context, moduleName, platform) => {
	if (moduleName === 'axios' && (platform === 'ios' || platform === 'android')) {
		// Keep the shared browser/XHR entry for native import and require callers.
		return context.resolveRequest(
			{ ...context, unstable_enablePackageExports: false },
			moduleName,
			platform,
		)
	}

	return context.resolveRequest(context, moduleName, platform)
}

module.exports = config
