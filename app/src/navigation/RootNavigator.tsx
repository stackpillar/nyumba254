import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer, DefaultTheme, LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme/ThemeContext';
import { FONT } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { registerPush } from '../lib/push';
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import SavedScreen from '../screens/SavedScreen';
import AccountScreen from '../screens/AccountScreen';
import ListingScreen from '../screens/ListingScreen';
import ListerScreen from '../screens/ListerScreen';
import DashboardScreen from '../screens/DashboardScreen';
import PostListingScreen from '../screens/PostListingScreen';
import SupportScreen from '../screens/SupportScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();
const ICON: Record<string, string> = { Home: '⌂', Search: '⌕', Saved: '♡', Account: '☺' };

function Tabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: theme.green, tabBarInactiveTintColor: theme.text3,
      tabBarStyle: { backgroundColor: theme.card, borderTopColor: theme.border },
      tabBarLabelStyle: { fontFamily: FONT.sansMedium, fontSize: 11 },
      tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>{ICON[route.name]}</Text>,
    })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

// App Links: https://nyumba254.com/listing?id=N and https://nyumba254.com/@handle open these screens.
const linking: LinkingOptions<any> = {
  prefixes: ['https://nyumba254.com', 'https://www.nyumba254.com', 'nyumba254://'],
  config: { screens: { Listing: 'listing', Lister: 'lister/:handle', Dashboard: 'dashboard', PostListing: 'post-listing', Main: { screens: { Home: '', Search: 'listings', Saved: 'saved', Account: 'profile' } } } },
  getStateFromPath: (path, options) => {
    const m = path.match(/^\/?@([^/?#]+)/);
    if (m) return { routes: [{ name: 'Lister', params: { handle: m[1] } }] };
    const l = path.match(/^\/?listing\?(?:.*&)?id=(\d+)/);
    if (l) return { routes: [{ name: 'Main' }, { name: 'Listing', params: { id: l[1] } }] };
    return undefined as any;
  },
};

export default function RootNavigator() {
  const { theme } = useTheme();
  const { session } = useAuth();
  const [offline, setOffline] = useState(false);
  useEffect(() => NetInfo.addEventListener((s) => setOffline(s.isConnected === false)), []);
  useEffect(() => { if (session) registerPush(session.user.id); }, [session]);

  const opts = { headerStyle: { backgroundColor: theme.card }, headerTintColor: theme.green, headerTitleStyle: { fontFamily: FONT.sansSemi, color: theme.text }, contentStyle: { backgroundColor: theme.surface } };
  return (
    <NavigationContainer linking={linking} theme={{ ...DefaultTheme, dark: theme.dark, colors: { ...DefaultTheme.colors, primary: theme.green, background: theme.surface, card: theme.card, text: theme.text, border: theme.border } }}>
      {offline ? <View style={{ backgroundColor: theme.amber, padding: 6 }}><Text style={{ color: '#fff', textAlign: 'center', fontFamily: FONT.sansSemi, fontSize: 12 }}>You are offline. Showing saved results.</Text></View> : null}
      <Stack.Navigator screenOptions={opts}>
        <Stack.Screen name="Main" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Listing" component={ListingScreen} options={{ title: 'Listing' }} />
        <Stack.Screen name="Lister" component={ListerScreen} options={{ title: 'Lister Page' }} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
        <Stack.Screen name="PostListing" component={PostListingScreen} options={{ title: 'Post a listing' }} />
        <Stack.Screen name="Support" component={SupportScreen} options={{ title: 'Support chat' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
