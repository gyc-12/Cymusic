import { playbackService } from '@/constants/playbackService'
import { colors } from '@/constants/tokens'
import LyricManager from '@/helpers/lyricManager'
import { useLogTrackPlayerState } from '@/hooks/useLogTrackPlayerState'
import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer'
import i18n, { setI18nConfig } from '@/utils/i18n'
import { router, SplashScreen, Stack } from 'expo-router'
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent'
import { StatusBar } from 'expo-status-bar'
import { useCallback, useEffect, useState } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import Toast, { BaseToast, ErrorToast } from 'react-native-toast-message'
import TrackPlayer from 'react-native-track-player'
SplashScreen.preventAutoHideAsync()

TrackPlayer.registerPlaybackService(() => playbackService)
setI18nConfig()
const App = () => {
	const handleTrackPlayerLoaded = useCallback(() => {
		setTimeout(SplashScreen.hideAsync, 1500)
	}, [])

	useSetupTrackPlayer({
		onLoad: handleTrackPlayerLoaded, //播放器初始化后调用这个回调函数。这里先传过去。
	})

	useLogTrackPlayerState()
	// myTrackPlayer.setupTrackPlayer()

	LyricManager.setup()
	const [isI18nReady, setIsI18nReady] = useState(false)
	const { hasShareIntent } = useShareIntentContext()

	useEffect(() => {
		if (hasShareIntent) {
			// we want to handle share intent event in a specific page
			console.log('[expo-router-index111] redirect to ShareIntent screen')
			console.log('[expo-router-index111] hasShareIntent', hasShareIntent)
			router.replace('/(modals)/cymusic')
		}
	}, [hasShareIntent])
	useEffect(() => {
		const initI18n = async () => {
			try {
				// 确保 i18n 配置已加载
				await setI18nConfig()
				setIsI18nReady(true)
			} catch (error) {
				console.error('Failed to initialize i18n:', error)
			}
		}

		initI18n()
	}, [])
	const toastConfig = {
		/*
	  Overwrite 'success' type,
	  by modifying the existing `BaseToast` component
	*/
		success: (props) => (
			<BaseToast
				{...props}
				style={{ borderLeftColor: 'rgb(252,87,59)', backgroundColor: 'rgb(251,231,227)' }}
				contentContainerStyle={{ paddingHorizontal: 15 }}
				text1Style={{
					fontSize: 15,
					fontWeight: '400',
					color: 'rgb(252,87,59)',
				}}
				text2Style={{
					fontSize: 15,
					fontWeight: '400',
					color: 'rgb(252,87,59)',
				}}
			/>
		),
		/*
	  Overwrite 'error' type,
	  by modifying the existing `ErrorToast` component
	*/
		error: (props) => (
			<ErrorToast
				{...props}
				style={{ borderLeftColor: 'rgb(252,87,59)', backgroundColor: 'rgb(251,231,227)' }}
				contentContainerStyle={{ paddingHorizontal: 15 }}
				text1Style={{
					fontSize: 15,
					fontWeight: '400',
					color: 'rgb(252,87,59)',
				}}
				text2Style={{
					fontSize: 15,
					fontWeight: '400',
					color: 'rgb(252,87,59)',
				}}
			/>
		),
		/*
	  Or create a completely new type - `tomatoToast`,
	  building the layout from scratch.
  
	  I can consume any custom `props` I want.
	  They will be passed when calling the `show` method (see below)
	*/
	}
	return (
		<ShareIntentProvider
			options={{
				debug: true,
				resetOnBackground: false,
				onResetShareIntent: () =>
					// used when app going in background and when the reset button is pressed
					router.replace({
						pathname: '/',
					}),
			}}
		>
			<SafeAreaProvider>
				<GestureHandlerRootView style={{ flex: 1 }}>
					<RootNavigation />
					<StatusBar style="auto" />
					<Toast config={toastConfig} />
				</GestureHandlerRootView>
			</SafeAreaProvider>
		</ShareIntentProvider>
	)
}

const RootNavigation = () => {
	return (
		//每个 Stack.Screen 组件定义了一个可导航的屏幕
		<Stack>
			<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
			<Stack.Screen
				name="player"
				options={{
					presentation: 'card',
					gestureEnabled: true,
					gestureDirection: 'vertical',
					animationDuration: 400,
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="(modals)/playList"
				options={{
					presentation: 'modal',
					gestureEnabled: true,
					gestureDirection: 'vertical',
					animationDuration: 400,
					headerShown: false,
				}}
			/>
			<Stack.Screen
				name="(modals)/addToPlaylist"
				options={{
					presentation: 'modal',
					headerStyle: {
						backgroundColor: colors.background,
					},
					headerTitle: i18n.t('addToPlaylist.title'),
					headerTitleStyle: {
						color: colors.text,
					},
				}}
			/>
			<Stack.Screen
				name="(modals)/settingModal"
				options={{
					presentation: 'modal',
					headerShown: false,
					gestureEnabled: true,
					gestureDirection: 'vertical',
				}}
			/>
			<Stack.Screen
				name="(modals)/importPlayList"
				options={{
					presentation: 'modal',
					headerShown: false,
					gestureEnabled: true,
					gestureDirection: 'vertical',
				}}
			/>
			<Stack.Screen
				name="(modals)/[name]"
				options={{
					presentation: 'modal',
					headerShown: false,
					gestureEnabled: true,
					gestureDirection: 'vertical',
				}}
			/>
			<Stack.Screen
				name="(modals)/logScreen"
				options={{
					presentation: 'modal',
					headerShown: true,
					gestureEnabled: true,
					gestureDirection: 'vertical',
					headerTitle: '应用日志',
					headerStyle: {
						backgroundColor: colors.background,
					},
					headerTitleStyle: {
						color: colors.text,
					},
				}}
			/>
		</Stack>
	)
}

export default App
