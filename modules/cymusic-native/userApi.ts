import { NativeModule, requireNativeModule } from 'expo'

export type UserApiScript = {
	id: string
	name: string
	description: string
	version: string
	author: string
	homepage: string
	script: string
}

export type UserApiEvent = {
	generation: string
	action: string
	data?: string
	type?: string
	log?: string
}

declare class UserApiModule extends NativeModule<{
	'api-action': (event: UserApiEvent) => void
}> {
	loadScript(info: UserApiScript): string
	sendAction(action: string, info: string, generation: string): void
	destroy(): string
}

export default requireNativeModule<UserApiModule>('UserApiModule')
