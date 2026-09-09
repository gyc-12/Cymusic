import { FloatingPlayer } from '@/components/FloatingPlayer'
import { BlurTint } from '@/constants/tokens'
import { useAppTheme } from '@/hooks/useAppTheme'
import i18n from '@/utils/i18n'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { Tabs } from 'expo-router/js-tabs'
import React, { useMemo } from 'react'
import { StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const TAB_BAR_HEIGHT = 49

const TabBarBackground = ({ tint }: { tint: BlurTint }) => (
	<BlurView
		intensity={90}
		tint={tint}
		style={[
			StyleSheet.absoluteFill,
			{
				overflow: 'hidden',
				borderTopLeftRadius: 20,
				borderTopRightRadius: 20,
			},
		]}
	/>
)

const TabsNavigation = () => {
	const { bottom } = useSafeAreaInsets()
	const { blurTint, colors } = useAppTheme()

	const floatingPlayerStyle = useMemo(() => ({
		position: 'absolute' as const,
		left: 8,
		right: 8,
		bottom: TAB_BAR_HEIGHT + bottom + 8,
	}), [bottom])

	return (
		<>
			<Tabs
				screenOptions={{
					tabBarActiveTintColor: colors.primary,
					tabBarInactiveTintColor: colors.textMuted,
					tabBarLabelStyle: {
						fontSize: 11,
						fontWeight: '500',
					},
					headerShown: false,
					tabBarStyle: {
						position: 'absolute',
						borderTopLeftRadius: 20,
						borderTopRightRadius: 20,
						borderTopWidth: 0,
						paddingTop: 6,
						backgroundColor: 'transparent',
					},
					tabBarBackground: () => <TabBarBackground tint={blurTint} />,
				}}
			>
				<Tabs.Screen
					name="(songs)"
					options={{
						title: i18n.t('appTab.songs'),
						tabBarIcon: ({ color, focused }) => (
							<Ionicons name={focused ? 'musical-notes' : 'musical-notes-outline'} size={24} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="radio"
					options={{
						title: i18n.t('appTab.radio'),
						tabBarIcon: ({ color, focused }) => (
							<Ionicons name={focused ? 'radio' : 'radio-outline'} size={24} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="favorites"
					options={{
						title: i18n.t('appTab.favorites'),
						tabBarIcon: ({ color, focused }) => (
							<Ionicons name={focused ? 'heart' : 'heart-outline'} size={24} color={color} />
						),
					}}
				/>
				<Tabs.Screen
					name="search"
					options={{
						title: i18n.t('appTab.search'),
						tabBarIcon: ({ color, focused }) => (
							<Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
						),
					}}
				/>
			</Tabs>

			<FloatingPlayer style={floatingPlayerStyle} />
		</>
	)
}

export default TabsNavigation
