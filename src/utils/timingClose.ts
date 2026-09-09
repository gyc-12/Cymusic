import { logInfo, logWarn } from '@/helpers/logger'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import StateMapper from '@/utils/stateMapper'
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import CyMusicSleepTimer, { SleepDeadlineEvent } from '../../modules/cymusic-native/sleepTimer'

let deadline: number | null = null
let generation: string | null = null
const stateMapper = new StateMapper(() => deadline)

function cancelNativeTimer() {
	try {
		CyMusicSleepTimer.cancel()
	} catch (error) {
		logWarn('Failed to cancel sleep timer', error)
	}
}

function pauseIfExpired(event: SleepDeadlineEvent) {
	if (
		event.generation !== generation ||
		event.deadline !== deadline ||
		deadline === null ||
		Date.now() < deadline
	) return

	// Invalidate before any asynchronous pause so native/foreground delivery settles once.
	generation = null
	cancelNativeTimer()
	void (async () => {
		try {
			await myTrackPlayer.pause()
		} catch (error) {
			logWarn('Failed to pause at sleep deadline', error)
		}
	})()
}

const nativeSubscription = CyMusicSleepTimer.addListener('deadline', pauseIfExpired)
const foregroundSubscription = AppState.addEventListener('change', (state) => {
	if (state === 'active' && generation !== null && deadline !== null) {
		pauseIfExpired({ generation, deadline })
	}
})

// These subscriptions belong to the module, independently of the player screen.
const hotModule = module as typeof module & { hot?: { dispose(callback: () => void): void } }
hotModule.hot?.dispose(() => {
	generation = null
	nativeSubscription.remove()
	foregroundSubscription.remove()
	cancelNativeTimer()
})

function setTimingClose(nextDeadline: number | null) {
	let nextGeneration: string | null = null
	if (nextDeadline) {
		try {
			nextGeneration = CyMusicSleepTimer.schedule(nextDeadline)
		} catch (error) {
			logWarn('Failed to schedule sleep timer', error)
			return
		}
	} else {
		cancelNativeTimer()
	}
	deadline = nextDeadline
	generation = nextGeneration
	stateMapper.notify()
	if (nextDeadline) {
		logInfo('将在', (nextDeadline - Date.now()) / 1000 / 60, '分钟后暂停播放')
	}
}

function useTimingClose() {
	const currentDeadline = stateMapper.useMappedState()
	const [countDown, setCountDown] = useState<number | null>(() =>
		deadline && deadline > Date.now() ? (deadline - Date.now()) / 1000 : null,
	)

	useEffect(() => {
		if (!currentDeadline || currentDeadline <= Date.now()) {
			setCountDown(null)
			return
		}
		setCountDown(Math.max(currentDeadline - Date.now(), 0) / 1000)
		const interval = setInterval(() => {
			const remaining = Math.max(currentDeadline - Date.now(), 0) / 1000
			setCountDown(remaining)
			if (remaining === 0) clearInterval(interval)
		}, 1000)
		return () => clearInterval(interval)
	}, [currentDeadline])

	return countDown
}

export { setTimingClose, useTimingClose }
