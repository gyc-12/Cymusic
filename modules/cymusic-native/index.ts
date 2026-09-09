import { requireNativeModule } from 'expo'

export type NativeFileType = 'file' | 'directory' | 'symlink' | 'other'

type CyMusicFileSystem = {
	readonly documentDirectoryPath: string
	readonly libraryDirectoryPath: string
	readonly cachesDirectoryPath: string
	exists(filePath: string): Promise<boolean>
	stat(filePath: string): Promise<NativeFileType>
}

// This module is iOS-only. Other platforms must not substitute a different MMKV root.
export default requireNativeModule<CyMusicFileSystem>('CyMusicFileSystem')
