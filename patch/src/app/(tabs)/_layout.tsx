import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/tabs';

import { useColors } from '@/theme';

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.tabBar, borderTopColor: c.border },
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={String(color)} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'camera' : 'camera-outline'} color={String(color)} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="garden"
        options={{
          title: 'My Garden',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'leaf' : 'leaf-outline'} color={String(color)} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused, size }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} color={String(color)} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
