import { NativeModule, requireNativeModule } from 'expo'

export type SleepDeadlineEvent = { generation: string; deadline: number }

type SleepTimerEvents = {
	deadline: (event: SleepDeadlineEvent) => void
}

declare class CyMusicSleepTimer extends NativeModule<SleepTimerEvents> {
	// The native generation is returned before its queued timer can deliver a JS event.
	schedule(deadline: number): string
	cancel(): void
}

export default requireNativeModule<CyMusicSleepTimer>('CyMusicSleepTimer')
