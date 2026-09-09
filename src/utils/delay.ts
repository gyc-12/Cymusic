import { startBackgroundTask } from '@/helpers/requestTimeout'

export default function (millsecond: number) {
	return new Promise<void>((resolve, reject) => {
		const release = startBackgroundTask()
		try {
			setTimeout(() => {
				release()
				resolve()
			}, millsecond)
		} catch (error) {
			release()
			reject(error)
		}
	})
}
