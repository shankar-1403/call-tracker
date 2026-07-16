import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useColorScheme } from 'react-native';

export default function AppTabs() {
  const {logout} = useAuth();
  const pathname = usePathname();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];
  const hideTabBar = pathname === '/' || pathname === '/index';

  return (
    <NativeTabs
      hidden={hideTabBar}
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index" hidden>
        <NativeTabs.Trigger.Label>Login</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/explore.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}