import { NativeModule, requireNativeModule } from 'expo'

export type VolumeChangeEvent = { volume: number }

type VolumeEvents = {
	volumeChanged: (event: VolumeChangeEvent) => void
}

declare class CyMusicVolume extends NativeModule<VolumeEvents> {
	getVolume(): Promise<number>
	setVolume(volume: number): Promise<void>
}

export default requireNativeModule<CyMusicVolume>('CyMusicVolume')
