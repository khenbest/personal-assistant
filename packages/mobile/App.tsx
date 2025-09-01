import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from './src/store';
import { ChatScreen } from './src/screens/ChatScreen';
import { MainScreen } from './src/screens/MainScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { CalendarScreen } from './src/screens/CalendarScreen';
import { TasksScreen } from './src/screens/TasksScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const { isInitialized, initialize } = useStore();

  React.useEffect(() => {
    initialize();
  }, []);

  if (!isInitialized) {
    // You could show a splash screen here
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Chat"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#ffffff',
            },
            headerTintColor: '#212529',
            headerTitleStyle: {
              fontWeight: '600',
            },
          }}
        >
          <Stack.Screen 
            name="Chat" 
            component={ChatScreen} 
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="Main" 
            component={MainScreen} 
            options={{ title: 'Assistant' }}
          />
          <Stack.Screen 
            name="Calendar" 
            component={CalendarScreen}
            options={{ title: 'Calendar' }}
          />
          <Stack.Screen 
            name="Tasks" 
            component={TasksScreen}
            options={{ title: 'Tasks' }}
          />
          <Stack.Screen 
            name="Settings" 
            component={SettingsScreen}
            options={{ title: 'Settings' }}
          />
        </Stack.Navigator>
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}