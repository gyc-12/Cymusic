import CyMusicRequestTasks from '../../modules/cymusic-native/requestTasks'
import { logWarn } from './logger'

// Finite UIKit grace belongs to the operation, even when its native identifier arrives late.
export function startBackgroundTask(): () => void {
	let finished = false
	let identifier: string | null = null

	const release = async (value: string) => {
		try {
			await CyMusicRequestTasks.endTask(value)
		} catch (error) {
			logWarn('Failed to release request background task', error)
		}
	}

	void (async () => {
		try {
			const value = await CyMusicRequestTasks.beginTask()
			if (value === null) return
			if (finished) void release(value)
			else identifier = value
		} catch (error) {
			logWarn('Failed to begin request background task', error)
		}
	})()

	return () => {
		if (finished) return
		finished = true
		const value = identifier
		identifier = null
		if (value !== null) void release(value)
	}
}

export function createRequestTimeout(controller: AbortController, timeout: number) {
	const release = startBackgroundTask()
	let timer: ReturnType<typeof setTimeout> | undefined
	let finished = false

	const finish = () => {
		if (finished) return
		finished = true
		if (timer !== undefined) clearTimeout(timer)
		timer = undefined
		release()
	}
	const abort = () => {
		finish()
		controller.abort()
	}

	try {
		timer = setTimeout(abort, timeout)
	} catch (error) {
		finish()
		throw error
	}
	return { finish, abort }
}
