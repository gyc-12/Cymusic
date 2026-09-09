import myTrackPlayer from '@/helpers/trackPlayerIndex'

import StateMapper from '@/utils/stateMapper'
import { useEffect, useRef, useState } from 'react'
import BackgroundTimer from 'react-native-background-timer'

import { logInfo } from '@/helpers/logger'
import { NativeModule, NativeModules } from 'react-native'

interface INativeUtils extends NativeModule {
	exitApp: () => void
	checkStoragePermission: () => Promise<boolean>
	requestStoragePermission: () => void
}

const NativeUtils = NativeModules.NativeUtils
let deadline: number | null = null
const stateMapper = new StateMapper(() => deadline)
// let closeAfterPlayEnd = false;
// const closeAfterPlayEndStateMapper = new StateMapper(() => closeAfterPlayEnd);
let timerId: any

function setTimingClose(_deadline: number | null) {
	deadline = _deadline
	stateMapper.notify()
	timerId && BackgroundTimer.clearTimeout(timerId)
	if (_deadline) {
		logInfo('将在', (_deadline - Date.now()) / 1000 / 60, '分钟后暂停播放')
		timerId = BackgroundTimer.setTimeout(async () => {
			// todo: 播完整首歌再关闭
			await myTrackPlayer.pause()
			// NativeUtils.exitApp()
			// if(closeAfterPlayEnd) {
			//     myTrackPlayer.addEventListener()
			// } else {
			//     // 立即关闭
			//     NativeUtils.exitApp();
			// }
		}, _deadline - Date.now())
	} else {
		timerId = null
	}
}

function useTimingClose() {
	const _deadline = stateMapper.useMappedState()
	const [countDown, setCountDown] = useState(deadline ? deadline - Date.now() : null)
	const intervalRef = useRef<any>(undefined)

	useEffect(() => {
		// deadline改变时，更新定时器
		// 清除原有的定时器
		intervalRef.current && clearInterval(intervalRef.current)
		intervalRef.current = null

		// 清空定时
		if (!_deadline || _deadline <= Date.now()) {
			setCountDown(null)
			return
		} else {
			// 更新倒计时
			setCountDown(Math.max(_deadline - Date.now(), 0) / 1000)
			intervalRef.current = setInterval(() => {
				setCountDown(Math.max(_deadline - Date.now(), 0) / 1000)
			}, 1000)
		}
	}, [_deadline])

	return countDown
}

export { setTimingClose, useTimingClose }
