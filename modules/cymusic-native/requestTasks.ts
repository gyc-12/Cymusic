import { requireNativeModule } from 'expo'

type CyMusicRequestTasks = {
	beginTask(): Promise<string | null>
	endTask(identifier: string): Promise<void>
}

export default requireNativeModule<CyMusicRequestTasks>('CyMusicRequestTasks')
