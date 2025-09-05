/**
 * iOS Actions Bridge
 * 
 * Handles communication between React Native and native iOS actions
 * Manages permissions, executes native functions, and returns results
 */

import * as Calendar from 'expo-calendar';
import * as Contacts from 'expo-contacts';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import * as Device from 'expo-device';
import * as Battery from 'expo-battery';
import * as Brightness from 'expo-brightness';
import * as Clipboard from 'expo-clipboard';
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import * as Speech from 'expo-speech';
import { DeviceMotion } from 'expo-sensors';
import { Alert, Platform } from 'react-native';

interface ActionRequest {
  actionId: string;
  params: any;
  requiresConfirmation?: boolean;
}

interface ActionResponse {
  success: boolean;
  data?: any;
  error?: string;
  requiresPermission?: string;
}

export class IOSActionsBridge {
  private permissionStatus: Map<string, boolean> = new Map();
  private notificationHandler: any = null;

  constructor() {
    this.initializeNotificationHandler();
    this.checkInitialPermissions();
  }

  /**
   * Initialize notification handler for displaying in-app notifications
   */
  private initializeNotificationHandler() {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }

  /**
   * Check and cache initial permission statuses
   */
  private async checkInitialPermissions() {
    if (Platform.OS !== 'ios') return;

    try {
      // Check calendar permissions
      const calendarStatus = await Calendar.getCalendarPermissionsAsync();
      this.permissionStatus.set('calendar', calendarStatus.status === 'granted');

      // Check reminders permissions (iOS only)
      const remindersStatus = await Calendar.getRemindersPermissionsAsync();
      this.permissionStatus.set('reminders', remindersStatus.status === 'granted');

      // Check contacts permissions
      const contactsStatus = await Contacts.getPermissionsAsync();
      this.permissionStatus.set('contacts', contactsStatus.status === 'granted');

      // Check location permissions
      const locationStatus = await Location.getForegroundPermissionsAsync();
      this.permissionStatus.set('location', locationStatus.status === 'granted');

      // Check notification permissions
      const notificationStatus = await Notifications.getPermissionsAsync();
      this.permissionStatus.set('notifications', notificationStatus.status === 'granted');

      // Check camera permissions
      const cameraStatus = await Camera.getCameraPermissionsAsync();
      this.permissionStatus.set('camera', cameraStatus.status === 'granted');

      // Check media library permissions
      const mediaStatus = await MediaLibrary.getPermissionsAsync();
      this.permissionStatus.set('mediaLibrary', mediaStatus.status === 'granted');
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  }

  /**
   * Request permission for a specific feature
   */
  public async requestPermission(permissionType: string): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    try {
      let result: any;
      
      switch (permissionType) {
        case 'calendar':
          result = await Calendar.requestCalendarPermissionsAsync();
          break;
        case 'reminders':
          result = await Calendar.requestRemindersPermissionsAsync();
          break;
        case 'contacts':
          result = await Contacts.requestPermissionsAsync();
          break;
        case 'location':
          result = await Location.requestForegroundPermissionsAsync();
          break;
        case 'notifications':
          result = await Notifications.requestPermissionsAsync();
          break;
        case 'camera':
          result = await Camera.requestCameraPermissionsAsync();
          break;
        case 'mediaLibrary':
          result = await MediaLibrary.requestPermissionsAsync();
          break;
        default:
          return false;
      }

      const granted = result.status === 'granted';
      this.permissionStatus.set(permissionType, granted);
      return granted;
    } catch (error) {
      console.error(`Error requesting ${permissionType} permission:`, error);
      return false;
    }
  }

  /**
   * Execute an action from the backend
   */
  public async executeAction(request: ActionRequest): Promise<ActionResponse> {
    console.log('Executing action:', request.actionId);

    // Show confirmation dialog if required
    if (request.requiresConfirmation) {
      const confirmed = await this.showConfirmationDialog(request);
      if (!confirmed) {
        return { success: false, error: 'User cancelled' };
      }
    }

    // Route to appropriate handler based on action ID
    const [domain, action] = request.actionId.split('.');
    
    try {
      switch (domain) {
        case 'calendar':
          return await this.executeCalendarAction(action, request.params);
        case 'contacts':
          return await this.executeContactsAction(action, request.params);
        case 'location':
          return await this.executeLocationAction(action, request.params);
        case 'notifications':
          return await this.executeNotificationAction(action, request.params);
        case 'media':
          return await this.executeMediaAction(action, request.params);
        case 'communication':
          return await this.executeCommunicationAction(action, request.params);
        case 'device':
          return await this.executeDeviceAction(action, request.params);
        case 'audio':
          return await this.executeAudioAction(action, request.params);
        case 'haptics':
          return await this.executeHapticsAction(action, request.params);
        default:
          return { success: false, error: `Unknown domain: ${domain}` };
      }
    } catch (error: any) {
      console.error('Action execution error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Show confirmation dialog for sensitive actions
   */
  private showConfirmationDialog(request: ActionRequest): Promise<boolean> {
    return new Promise((resolve) => {
      Alert.alert(
        'Confirm Action',
        `Do you want to ${this.getActionDescription(request.actionId)}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false)
          },
          {
            text: 'Confirm',
            style: 'default',
            onPress: () => resolve(true)
          }
        ]
      );
    });
  }

  /**
   * Get human-readable action description
   */
  private getActionDescription(actionId: string): string {
    const descriptions: Record<string, string> = {
      'calendar.create_event': 'create a calendar event',
      'calendar.create_reminder': 'create a reminder',
      'contacts.create': 'add a new contact',
      'communication.compose_email': 'compose an email',
      'communication.send_sms': 'send a text message',
      'media.take_photo': 'take a photo',
      'device.brightness': 'adjust screen brightness'
    };
    
    return descriptions[actionId] || actionId;
  }

  /**
   * Execute calendar actions
   */
  private async executeCalendarAction(action: string, params: any): Promise<ActionResponse> {
    // Check permission
    if (!this.permissionStatus.get('calendar')) {
      const granted = await this.requestPermission('calendar');
      if (!granted) {
        return { 
          success: false, 
          error: 'Calendar permission required',
          requiresPermission: 'calendar'
        };
      }
    }

    switch (action) {
      case 'create_event': {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const defaultCalendar = calendars.find(cal => cal.isPrimary) || calendars[0];
        
        if (!defaultCalendar) {
          return { success: false, error: 'No calendar available' };
        }

        const eventId = await Calendar.createEventAsync(defaultCalendar.id, {
          title: params.title,
          startDate: params.startDate,
          endDate: params.endDate,
          location: params.location,
          notes: params.notes,
          alarms: [{ relativeOffset: -15 }]
        });

        return { success: true, data: { eventId } };
      }

      case 'get_events': {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calendarIds = calendars.map(c => c.id);
        
        const events = await Calendar.getEventsAsync(
          calendarIds,
          params.startDate,
          params.endDate
        );

        return { success: true, data: events };
      }

      case 'create_reminder': {
        if (Platform.OS !== 'ios') {
          return { success: false, error: 'Reminders are iOS only' };
        }

        if (!this.permissionStatus.get('reminders')) {
          const granted = await this.requestPermission('reminders');
          if (!granted) {
            return { 
              success: false, 
              error: 'Reminders permission required',
              requiresPermission: 'reminders'
            };
          }
        }

        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
        const defaultCalendar = calendars[0];
        
        if (!defaultCalendar) {
          return { success: false, error: 'No reminder list available' };
        }

        const reminderId = await Calendar.createReminderAsync(defaultCalendar.id, {
          title: params.title,
          dueDate: params.dueDate,
          notes: params.notes,
          completed: false
        });

        return { success: true, data: { reminderId } };
      }

      default:
        return { success: false, error: `Unknown calendar action: ${action}` };
    }
  }

  /**
   * Execute contacts actions
   */
  private async executeContactsAction(action: string, params: any): Promise<ActionResponse> {
    if (!this.permissionStatus.get('contacts')) {
      const granted = await this.requestPermission('contacts');
      if (!granted) {
        return { 
          success: false, 
          error: 'Contacts permission required',
          requiresPermission: 'contacts'
        };
      }
    }

    switch (action) {
      case 'search': {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails
          ],
          name: params.query
        });

        return { success: true, data };
      }

      case 'create': {
        const contact = {
          [Contacts.Fields.FirstName]: params.firstName,
          [Contacts.Fields.LastName]: params.lastName,
          [Contacts.Fields.Company]: params.company,
          [Contacts.Fields.PhoneNumbers]: params.phoneNumber ? [{
            label: 'mobile',
            number: params.phoneNumber
          }] : [],
          [Contacts.Fields.Emails]: params.email ? [{
            label: 'work',
            email: params.email
          }] : []
        };

        const contactId = await Contacts.addContactAsync(contact);
        return { success: true, data: { contactId } };
      }

      default:
        return { success: false, error: `Unknown contacts action: ${action}` };
    }
  }

  /**
   * Execute location actions
   */
  private async executeLocationAction(action: string, params: any): Promise<ActionResponse> {
    switch (action) {
      case 'current': {
        if (!this.permissionStatus.get('location')) {
          const granted = await this.requestPermission('location');
          if (!granted) {
            return { 
              success: false, 
              error: 'Location permission required',
              requiresPermission: 'location'
            };
          }
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High
        });

        const address = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        return {
          success: true,
          data: {
            coordinates: location.coords,
            address: address[0] || null,
            timestamp: location.timestamp
          }
        };
      }

      case 'geocode': {
        const results = await Location.geocodeAsync(params.address);
        return { success: true, data: results };
      }

      default:
        return { success: false, error: `Unknown location action: ${action}` };
    }
  }

  /**
   * Execute notification actions
   */
  private async executeNotificationAction(action: string, params: any): Promise<ActionResponse> {
    if (!this.permissionStatus.get('notifications')) {
      const granted = await this.requestPermission('notifications');
      if (!granted) {
        return { 
          success: false, 
          error: 'Notifications permission required',
          requiresPermission: 'notifications'
        };
      }
    }

    switch (action) {
      case 'schedule': {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: params.title,
            body: params.body,
            sound: true
          },
          trigger: params.trigger
        });

        return { success: true, data: { notificationId } };
      }

      case 'cancel': {
        if (params.notificationId) {
          await Notifications.cancelScheduledNotificationAsync(params.notificationId);
        } else {
          await Notifications.cancelAllScheduledNotificationsAsync();
        }
        return { success: true, data: { cancelled: true } };
      }

      default:
        return { success: false, error: `Unknown notification action: ${action}` };
    }
  }

  /**
   * Execute media actions
   */
  private async executeMediaAction(action: string, params: any): Promise<ActionResponse> {
    switch (action) {
      case 'take_photo': {
        if (!this.permissionStatus.get('camera')) {
          const granted = await this.requestPermission('camera');
          if (!granted) {
            return { 
              success: false, 
              error: 'Camera permission required',
              requiresPermission: 'camera'
            };
          }
        }

        const result = await ImagePicker.launchCameraAsync({
          quality: params.quality || 0.8,
          allowsEditing: params.allowsEditing || false
        });

        if (result.canceled) {
          return { success: false, error: 'User cancelled' };
        }

        return { success: true, data: result.assets[0] };
      }

      case 'pick_image': {
        if (!this.permissionStatus.get('mediaLibrary')) {
          const granted = await this.requestPermission('mediaLibrary');
          if (!granted) {
            return { 
              success: false, 
              error: 'Media library permission required',
              requiresPermission: 'mediaLibrary'
            };
          }
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: params.allowsMultiple || false
        });

        if (result.canceled) {
          return { success: false, error: 'User cancelled' };
        }

        return { success: true, data: { images: result.assets } };
      }

      default:
        return { success: false, error: `Unknown media action: ${action}` };
    }
  }

  /**
   * Execute communication actions
   */
  private async executeCommunicationAction(action: string, params: any): Promise<ActionResponse> {
    switch (action) {
      case 'compose_email': {
        const isAvailable = await MailComposer.isAvailableAsync();
        if (!isAvailable) {
          return { success: false, error: 'Email not available' };
        }

        const result = await MailComposer.composeAsync({
          recipients: params.recipients,
          subject: params.subject,
          body: params.body
        });

        return { 
          success: result.status === 'sent',
          data: { status: result.status }
        };
      }

      case 'send_sms': {
        const isAvailable = await SMS.isAvailableAsync();
        if (!isAvailable) {
          return { success: false, error: 'SMS not available' };
        }

        const result = await SMS.sendSMSAsync(
          params.recipients || [],
          params.body || ''
        );

        return { 
          success: result.result === 'sent',
          data: { result: result.result }
        };
      }

      default:
        return { success: false, error: `Unknown communication action: ${action}` };
    }
  }

  /**
   * Execute device actions
   */
  private async executeDeviceAction(action: string, params: any): Promise<ActionResponse> {
    switch (action) {
      case 'battery_status': {
        const batteryLevel = await Battery.getBatteryLevelAsync();
        const batteryState = await Battery.getBatteryStateAsync();
        const isLowPowerMode = await Battery.isLowPowerModeEnabledAsync();

        return {
          success: true,
          data: {
            level: Math.round(batteryLevel * 100),
            state: Battery.BatteryState[batteryState],
            isCharging: batteryState === Battery.BatteryState.CHARGING,
            isLowPowerMode
          }
        };
      }

      case 'brightness': {
        if (params.brightness !== undefined) {
          await Brightness.setBrightnessAsync(params.brightness);
        }
        
        const currentBrightness = await Brightness.getBrightnessAsync();
        
        return {
          success: true,
          data: { brightness: Math.round(currentBrightness * 100) }
        };
      }

      case 'clipboard': {
        if (params.operation === 'copy' && params.text) {
          await Clipboard.setStringAsync(params.text);
          return { success: true, data: { copied: true } };
        } else if (params.operation === 'paste') {
          const text = await Clipboard.getStringAsync();
          return { success: true, data: { text } };
        }
        return { success: false, error: 'Invalid clipboard operation' };
      }

      default:
        return { success: false, error: `Unknown device action: ${action}` };
    }
  }

  /**
   * Execute audio actions
   */
  private async executeAudioAction(action: string, params: any): Promise<ActionResponse> {
    switch (action) {
      case 'speak': {
        await Speech.speak(params.text, {
          language: params.language || 'en-US',
          pitch: params.pitch || 1,
          rate: params.rate || 1
        });
        return { success: true, data: { spoken: true } };
      }

      case 'stop_speaking': {
        await Speech.stop();
        return { success: true, data: { stopped: true } };
      }

      default:
        return { success: false, error: `Unknown audio action: ${action}` };
    }
  }

  /**
   * Execute haptic actions
   */
  private async executeHapticsAction(action: string, params: any): Promise<ActionResponse> {
    switch (action) {
      case 'feedback': {
        if (params.type === 'impact') {
          await Haptics.impactAsync(
            params.style === 'light' ? Haptics.ImpactFeedbackStyle.Light :
            params.style === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
            Haptics.ImpactFeedbackStyle.Medium
          );
        } else if (params.type === 'notification') {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else {
          await Haptics.selectionAsync();
        }
        return { success: true, data: { triggered: true } };
      }

      default:
        return { success: false, error: `Unknown haptics action: ${action}` };
    }
  }

  /**
   * Get current permission status for all features
   */
  public getPermissionStatus(): Map<string, boolean> {
    return this.permissionStatus;
  }

  /**
   * Check if a specific permission is granted
   */
  public hasPermission(permissionType: string): boolean {
    return this.permissionStatus.get(permissionType) || false;
  }
}

// Export singleton instance
export const iosActionsBridge = new IOSActionsBridge();