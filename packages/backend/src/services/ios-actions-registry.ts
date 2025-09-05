/**
 * iOS Actions Registry
 * 
 * Comprehensive registry of all iOS native capabilities accessible through Expo SDK
 * This provides a unified interface for voice-activated personal assistant actions
 * 
 * Architecture Principles:
 * - Domain-driven organization (Calendar, Contacts, Location, etc.)
 * - Permission-aware execution
 * - Graceful degradation for unavailable features
 * - Type-safe action definitions
 * - Async-first design
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
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import * as Audio from 'expo-av';
import * as Speech from 'expo-speech';
import { DeviceMotion, Accelerometer, Gyroscope, Magnetometer, Barometer } from 'expo-sensors';
import * as Network from 'expo-network';
import * as Application from 'expo-application';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

// Type definitions for actions
export interface ActionDefinition {
  id: string;
  domain: ActionDomain;
  name: string;
  description: string;
  requiredPermissions: Permission[];
  parameters: ActionParameter[];
  execute: (params: any) => Promise<ActionResult>;
  availability: () => Promise<boolean>;
  examples: string[];
}

export enum ActionDomain {
  CALENDAR = 'calendar',
  CONTACTS = 'contacts',
  LOCATION = 'location',
  NOTIFICATIONS = 'notifications',
  MEDIA = 'media',
  COMMUNICATION = 'communication',
  DEVICE = 'device',
  SENSORS = 'sensors',
  FILES = 'files',
  SYSTEM = 'system',
  AUDIO = 'audio',
  HAPTICS = 'haptics'
}

export enum Permission {
  CALENDAR = 'calendar',
  CONTACTS = 'contacts',
  LOCATION = 'location',
  LOCATION_BACKGROUND = 'location_background',
  NOTIFICATIONS = 'notifications',
  CAMERA = 'camera',
  MICROPHONE = 'microphone',
  MEDIA_LIBRARY = 'media_library',
  MOTION = 'motion'
}

export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'object' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: (value: any) => boolean;
}

export interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
  requiresUserInteraction?: boolean;
  suggestedFollowUp?: string;
}

/**
 * Calendar Actions
 */
export const calendarActions: ActionDefinition[] = [
  {
    id: 'calendar.create_event',
    domain: ActionDomain.CALENDAR,
    name: 'Create Calendar Event',
    description: 'Creates a new event in the user\'s calendar',
    requiredPermissions: [Permission.CALENDAR],
    parameters: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Event title'
      },
      {
        name: 'startDate',
        type: 'date',
        required: true,
        description: 'Event start time'
      },
      {
        name: 'endDate',
        type: 'date',
        required: true,
        description: 'Event end time'
      },
      {
        name: 'location',
        type: 'string',
        required: false,
        description: 'Event location'
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Event notes/description'
      },
      {
        name: 'attendees',
        type: 'array',
        required: false,
        description: 'List of attendee emails'
      }
    ],
    examples: [
      'Schedule a meeting with John tomorrow at 2pm',
      'Add lunch with Sarah on Friday at 12:30',
      'Create a team standup every Monday at 9am'
    ],
    availability: async () => {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      return status === 'granted';
    },
    execute: async (params) => {
      try {
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
          alarms: [{ relativeOffset: -15 }], // 15 min reminder
        });

        return {
          success: true,
          data: { eventId },
          suggestedFollowUp: 'Would you like to add a reminder or invite someone?'
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'calendar.get_events',
    domain: ActionDomain.CALENDAR,
    name: 'Get Calendar Events',
    description: 'Retrieves events from the user\'s calendar',
    requiredPermissions: [Permission.CALENDAR],
    parameters: [
      {
        name: 'startDate',
        type: 'date',
        required: true,
        description: 'Start of date range'
      },
      {
        name: 'endDate',
        type: 'date',
        required: true,
        description: 'End of date range'
      }
    ],
    examples: [
      'What do I have scheduled tomorrow?',
      'Show my calendar for next week',
      'When is my next meeting?'
    ],
    availability: async () => {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      return status === 'granted';
    },
    execute: async (params) => {
      try {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const calendarIds = calendars.map(c => c.id);
        
        const events = await Calendar.getEventsAsync(
          calendarIds,
          params.startDate,
          params.endDate
        );

        return {
          success: true,
          data: events.map(event => ({
            title: event.title,
            startDate: event.startDate,
            endDate: event.endDate,
            location: event.location,
            organizer: event.organizer
          }))
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'calendar.create_reminder',
    domain: ActionDomain.CALENDAR,
    name: 'Create Reminder',
    description: 'Creates a reminder (iOS only)',
    requiredPermissions: [Permission.CALENDAR],
    parameters: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Reminder title'
      },
      {
        name: 'dueDate',
        type: 'date',
        required: false,
        description: 'When the reminder is due'
      },
      {
        name: 'notes',
        type: 'string',
        required: false,
        description: 'Additional notes'
      }
    ],
    examples: [
      'Remind me to call the dentist tomorrow',
      'Add a reminder to buy milk',
      'Set a reminder for my medication at 8pm'
    ],
    availability: async () => {
      if (Device.osName !== 'iOS') return false;
      const { status } = await Calendar.getRemindersPermissionsAsync();
      return status === 'granted';
    },
    execute: async (params) => {
      try {
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

        return {
          success: true,
          data: { reminderId }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

/**
 * Contact Actions
 */
export const contactActions: ActionDefinition[] = [
  {
    id: 'contacts.search',
    domain: ActionDomain.CONTACTS,
    name: 'Search Contacts',
    description: 'Search for contacts by name, email, or phone',
    requiredPermissions: [Permission.CONTACTS],
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Search query'
      }
    ],
    examples: [
      'Find John Smith\'s phone number',
      'What\'s Sarah\'s email?',
      'Show me contacts from Apple'
    ],
    availability: async () => {
      const { status } = await Contacts.getPermissionsAsync();
      return status === 'granted';
    },
    execute: async (params) => {
      try {
        const { data } = await Contacts.getContactsAsync({
          fields: [
            Contacts.Fields.Name,
            Contacts.Fields.PhoneNumbers,
            Contacts.Fields.Emails,
            Contacts.Fields.Company
          ],
          name: params.query
        });

        return {
          success: true,
          data: data.map(contact => ({
            id: contact.id,
            name: contact.name,
            phoneNumbers: contact.phoneNumbers,
            emails: contact.emails,
            company: contact.company
          }))
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'contacts.create',
    domain: ActionDomain.CONTACTS,
    name: 'Create Contact',
    description: 'Add a new contact',
    requiredPermissions: [Permission.CONTACTS],
    parameters: [
      {
        name: 'firstName',
        type: 'string',
        required: true,
        description: 'First name'
      },
      {
        name: 'lastName',
        type: 'string',
        required: false,
        description: 'Last name'
      },
      {
        name: 'phoneNumber',
        type: 'string',
        required: false,
        description: 'Phone number'
      },
      {
        name: 'email',
        type: 'string',
        required: false,
        description: 'Email address'
      },
      {
        name: 'company',
        type: 'string',
        required: false,
        description: 'Company name'
      }
    ],
    examples: [
      'Add John Smith to my contacts',
      'Save this number 555-1234 as Pizza Place',
      'Create a contact for Dr. Johnson'
    ],
    availability: async () => {
      const { status } = await Contacts.getPermissionsAsync();
      return status === 'granted';
    },
    execute: async (params) => {
      try {
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

        return {
          success: true,
          data: { contactId }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

/**
 * Location Actions
 */
export const locationActions: ActionDefinition[] = [
  {
    id: 'location.current',
    domain: ActionDomain.LOCATION,
    name: 'Get Current Location',
    description: 'Get the device\'s current location',
    requiredPermissions: [Permission.LOCATION],
    parameters: [],
    examples: [
      'Where am I?',
      'What\'s my current location?',
      'Show my GPS coordinates'
    ],
    availability: async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    },
    execute: async () => {
      try {
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
            coordinates: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              altitude: location.coords.altitude,
              accuracy: location.coords.accuracy
            },
            address: address[0] ? {
              street: address[0].street,
              city: address[0].city,
              region: address[0].region,
              country: address[0].country,
              postalCode: address[0].postalCode
            } : null,
            timestamp: location.timestamp
          }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'location.geocode',
    domain: ActionDomain.LOCATION,
    name: 'Geocode Address',
    description: 'Convert an address to coordinates',
    requiredPermissions: [],
    parameters: [
      {
        name: 'address',
        type: 'string',
        required: true,
        description: 'Address to geocode'
      }
    ],
    examples: [
      'Find the coordinates for 1 Infinite Loop, Cupertino',
      'Where is the Empire State Building?',
      'Get location of Central Park, New York'
    ],
    availability: async () => true,
    execute: async (params) => {
      try {
        const results = await Location.geocodeAsync(params.address);
        
        if (results.length === 0) {
          return { success: false, error: 'Address not found' };
        }

        return {
          success: true,
          data: results.map(result => ({
            latitude: result.latitude,
            longitude: result.longitude,
            accuracy: result.accuracy,
            altitude: result.altitude
          }))
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

/**
 * Notification Actions
 */
export const notificationActions: ActionDefinition[] = [
  {
    id: 'notifications.schedule',
    domain: ActionDomain.NOTIFICATIONS,
    name: 'Schedule Notification',
    description: 'Schedule a local notification',
    requiredPermissions: [Permission.NOTIFICATIONS],
    parameters: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Notification title'
      },
      {
        name: 'body',
        type: 'string',
        required: false,
        description: 'Notification body text'
      },
      {
        name: 'trigger',
        type: 'object',
        required: true,
        description: 'When to show the notification'
      }
    ],
    examples: [
      'Notify me in 30 minutes to take a break',
      'Set a notification for tomorrow at 9am',
      'Remind me every day at 8am to take vitamins'
    ],
    availability: async () => {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    },
    execute: async (params) => {
      try {
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: params.title,
            body: params.body,
            sound: true,
            priority: Notifications.AndroidNotificationPriority.HIGH
          },
          trigger: params.trigger
        });

        return {
          success: true,
          data: { notificationId }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'notifications.cancel',
    domain: ActionDomain.NOTIFICATIONS,
    name: 'Cancel Notification',
    description: 'Cancel a scheduled notification',
    requiredPermissions: [],
    parameters: [
      {
        name: 'notificationId',
        type: 'string',
        required: false,
        description: 'ID of notification to cancel (or cancel all)'
      }
    ],
    examples: [
      'Cancel all my notifications',
      'Remove the break reminder',
      'Clear my scheduled alerts'
    ],
    availability: async () => true,
    execute: async (params) => {
      try {
        if (params.notificationId) {
          await Notifications.cancelScheduledNotificationAsync(params.notificationId);
        } else {
          await Notifications.cancelAllScheduledNotificationsAsync();
        }

        return {
          success: true,
          data: { cancelled: true }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

/**
 * Media Actions
 */
export const mediaActions: ActionDefinition[] = [
  {
    id: 'media.take_photo',
    domain: ActionDomain.MEDIA,
    name: 'Take Photo',
    description: 'Capture a photo using the camera',
    requiredPermissions: [Permission.CAMERA],
    parameters: [
      {
        name: 'quality',
        type: 'number',
        required: false,
        description: 'Image quality (0-1)',
        defaultValue: 0.8
      },
      {
        name: 'allowsEditing',
        type: 'boolean',
        required: false,
        description: 'Allow user to edit the photo',
        defaultValue: false
      }
    ],
    examples: [
      'Take a photo',
      'Capture a picture',
      'Open the camera'
    ],
    availability: async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      return status === 'granted';
    },
    execute: async (params) => {
      try {
        const result = await ImagePicker.launchCameraAsync({
          quality: params.quality,
          allowsEditing: params.allowsEditing,
          mediaTypes: ImagePicker.MediaTypeOptions.Images
        });

        if (result.canceled) {
          return { success: false, error: 'User cancelled' };
        }

        return {
          success: true,
          data: {
            uri: result.assets[0].uri,
            width: result.assets[0].width,
            height: result.assets[0].height
          },
          requiresUserInteraction: true
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'media.pick_image',
    domain: ActionDomain.MEDIA,
    name: 'Pick Image',
    description: 'Select an image from the photo library',
    requiredPermissions: [Permission.MEDIA_LIBRARY],
    parameters: [
      {
        name: 'allowsMultiple',
        type: 'boolean',
        required: false,
        description: 'Allow selecting multiple images',
        defaultValue: false
      }
    ],
    examples: [
      'Choose a photo',
      'Select an image from my library',
      'Pick a picture'
    ],
    availability: async () => {
      const { status } = await MediaLibrary.getPermissionsAsync();
      return status === 'granted';
    },
    execute: async (params) => {
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsMultipleSelection: params.allowsMultiple
        });

        if (result.canceled) {
          return { success: false, error: 'User cancelled' };
        }

        return {
          success: true,
          data: {
            images: result.assets.map(asset => ({
              uri: asset.uri,
              width: asset.width,
              height: asset.height
            }))
          },
          requiresUserInteraction: true
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

/**
 * Communication Actions
 */
export const communicationActions: ActionDefinition[] = [
  {
    id: 'communication.compose_email',
    domain: ActionDomain.COMMUNICATION,
    name: 'Compose Email',
    description: 'Open email composer with pre-filled content',
    requiredPermissions: [],
    parameters: [
      {
        name: 'recipients',
        type: 'array',
        required: false,
        description: 'Email recipients'
      },
      {
        name: 'subject',
        type: 'string',
        required: false,
        description: 'Email subject'
      },
      {
        name: 'body',
        type: 'string',
        required: false,
        description: 'Email body'
      }
    ],
    examples: [
      'Send an email to John',
      'Compose an email about the meeting',
      'Email the team about lunch'
    ],
    availability: async () => {
      return await MailComposer.isAvailableAsync();
    },
    execute: async (params) => {
      try {
        const result = await MailComposer.composeAsync({
          recipients: params.recipients,
          subject: params.subject,
          body: params.body
        });

        return {
          success: result.status === 'sent',
          data: { status: result.status },
          requiresUserInteraction: true
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'communication.send_sms',
    domain: ActionDomain.COMMUNICATION,
    name: 'Send SMS',
    description: 'Open SMS composer with pre-filled content',
    requiredPermissions: [],
    parameters: [
      {
        name: 'recipients',
        type: 'array',
        required: false,
        description: 'Phone numbers'
      },
      {
        name: 'body',
        type: 'string',
        required: false,
        description: 'Message text'
      }
    ],
    examples: [
      'Text John that I\'m running late',
      'Send an SMS to 555-1234',
      'Message my mom'
    ],
    availability: async () => {
      return await SMS.isAvailableAsync();
    },
    execute: async (params) => {
      try {
        const result = await SMS.sendSMSAsync(
          params.recipients || [],
          params.body || ''
        );

        return {
          success: result.result === 'sent',
          data: { result: result.result },
          requiresUserInteraction: true
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

/**
 * Device Actions
 */
export const deviceActions: ActionDefinition[] = [
  {
    id: 'device.battery_status',
    domain: ActionDomain.DEVICE,
    name: 'Get Battery Status',
    description: 'Get current battery level and charging status',
    requiredPermissions: [],
    parameters: [],
    examples: [
      'What\'s my battery level?',
      'Is my phone charging?',
      'Check battery status'
    ],
    availability: async () => true,
    execute: async () => {
      try {
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
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'device.brightness',
    domain: ActionDomain.DEVICE,
    name: 'Adjust Brightness',
    description: 'Get or set screen brightness',
    requiredPermissions: [],
    parameters: [
      {
        name: 'brightness',
        type: 'number',
        required: false,
        description: 'Brightness level (0-1)',
        validation: (value) => value >= 0 && value <= 1
      }
    ],
    examples: [
      'Set brightness to 50%',
      'Dim the screen',
      'Make the screen brighter'
    ],
    availability: async () => true,
    execute: async (params) => {
      try {
        if (params.brightness !== undefined) {
          await Brightness.setBrightnessAsync(params.brightness);
        }
        
        const currentBrightness = await Brightness.getBrightnessAsync();
        
        return {
          success: true,
          data: {
            brightness: Math.round(currentBrightness * 100)
          }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'device.clipboard',
    domain: ActionDomain.DEVICE,
    name: 'Clipboard Operations',
    description: 'Copy text to or read from clipboard',
    requiredPermissions: [],
    parameters: [
      {
        name: 'text',
        type: 'string',
        required: false,
        description: 'Text to copy to clipboard'
      },
      {
        name: 'operation',
        type: 'string',
        required: true,
        description: 'copy or paste'
      }
    ],
    examples: [
      'Copy this to clipboard',
      'What\'s in my clipboard?',
      'Paste the text'
    ],
    availability: async () => true,
    execute: async (params) => {
      try {
        if (params.operation === 'copy' && params.text) {
          await Clipboard.setStringAsync(params.text);
          return {
            success: true,
            data: { copied: true }
          };
        } else if (params.operation === 'paste') {
          const text = await Clipboard.getStringAsync();
          return {
            success: true,
            data: { text }
          };
        }
        
        return { success: false, error: 'Invalid operation' };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

/**
 * Audio Actions
 */
export const audioActions: ActionDefinition[] = [
  {
    id: 'audio.speak',
    domain: ActionDomain.AUDIO,
    name: 'Text to Speech',
    description: 'Convert text to spoken audio',
    requiredPermissions: [],
    parameters: [
      {
        name: 'text',
        type: 'string',
        required: true,
        description: 'Text to speak'
      },
      {
        name: 'language',
        type: 'string',
        required: false,
        description: 'Language code (e.g., en-US)',
        defaultValue: 'en-US'
      },
      {
        name: 'pitch',
        type: 'number',
        required: false,
        description: 'Voice pitch (0.5-2)',
        defaultValue: 1
      },
      {
        name: 'rate',
        type: 'number',
        required: false,
        description: 'Speech rate (0.5-2)',
        defaultValue: 1
      }
    ],
    examples: [
      'Say hello world',
      'Read this text aloud',
      'Speak this message'
    ],
    availability: async () => true,
    execute: async (params) => {
      try {
        await Speech.speak(params.text, {
          language: params.language,
          pitch: params.pitch,
          rate: params.rate
        });

        return {
          success: true,
          data: { spoken: true }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  },
  {
    id: 'audio.stop_speaking',
    domain: ActionDomain.AUDIO,
    name: 'Stop Speaking',
    description: 'Stop text-to-speech playback',
    requiredPermissions: [],
    parameters: [],
    examples: [
      'Stop speaking',
      'Quiet',
      'Stop audio'
    ],
    availability: async () => true,
    execute: async () => {
      try {
        await Speech.stop();
        return {
          success: true,
          data: { stopped: true }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

/**
 * Haptic Actions
 */
export const hapticActions: ActionDefinition[] = [
  {
    id: 'haptics.feedback',
    domain: ActionDomain.HAPTICS,
    name: 'Haptic Feedback',
    description: 'Trigger haptic feedback',
    requiredPermissions: [],
    parameters: [
      {
        name: 'type',
        type: 'string',
        required: false,
        description: 'impact, notification, or selection',
        defaultValue: 'impact'
      },
      {
        name: 'style',
        type: 'string',
        required: false,
        description: 'light, medium, or heavy',
        defaultValue: 'medium'
      }
    ],
    examples: [
      'Vibrate',
      'Give haptic feedback',
      'Tap feedback'
    ],
    availability: async () => true,
    execute: async (params) => {
      try {
        if (params.type === 'impact') {
          await Haptics.impactAsync(
            params.style === 'light' ? Haptics.ImpactFeedbackStyle.Light :
            params.style === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
            Haptics.ImpactFeedbackStyle.Medium
          );
        } else if (params.type === 'notification') {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Success
          );
        } else {
          await Haptics.selectionAsync();
        }

        return {
          success: true,
          data: { triggered: true }
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
  }
];

/**
 * Sensor Actions
 */
export const sensorActions: ActionDefinition[] = [
  {
    id: 'sensors.device_motion',
    domain: ActionDomain.SENSORS,
    name: 'Get Device Motion',
    description: 'Get accelerometer and gyroscope data',
    requiredPermissions: [Permission.MOTION],
    parameters: [],
    examples: [
      'Check device motion',
      'Is the phone moving?',
      'Get accelerometer data'
    ],
    availability: async () => {
      return await DeviceMotion.isAvailableAsync();
    },
    execute: async () => {
      return new Promise((resolve) => {
        const subscription = DeviceMotion.addListener((data) => {
          subscription.remove();
          resolve({
            success: true,
            data: {
              acceleration: data.acceleration,
              accelerationIncludingGravity: data.accelerationIncludingGravity,
              rotation: data.rotation,
              rotationRate: data.rotationRate,
              orientation: data.orientation
            }
          });
        });

        // Timeout after 1 second
        setTimeout(() => {
          subscription.remove();
          resolve({ success: false, error: 'Timeout getting motion data' });
        }, 1000);
      });
    }
  }
];

/**
 * Main Action Registry
 */
export class IOSActionsRegistry {
  private actions: Map<string, ActionDefinition> = new Map();
  private domainActions: Map<ActionDomain, ActionDefinition[]> = new Map();

  constructor() {
    this.registerActions();
  }

  private registerActions() {
    const allActions = [
      ...calendarActions,
      ...contactActions,
      ...locationActions,
      ...notificationActions,
      ...mediaActions,
      ...communicationActions,
      ...deviceActions,
      ...audioActions,
      ...hapticActions,
      ...sensorActions
    ];

    for (const action of allActions) {
      this.actions.set(action.id, action);
      
      if (!this.domainActions.has(action.domain)) {
        this.domainActions.set(action.domain, []);
      }
      this.domainActions.get(action.domain)!.push(action);
    }
  }

  public getAction(id: string): ActionDefinition | undefined {
    return this.actions.get(id);
  }

  public getActionsByDomain(domain: ActionDomain): ActionDefinition[] {
    return this.domainActions.get(domain) || [];
  }

  public getAllActions(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }

  public async getAvailableActions(): Promise<ActionDefinition[]> {
    const allActions = this.getAllActions();
    const availabilityChecks = await Promise.all(
      allActions.map(async (action) => ({
        action,
        available: await action.availability()
      }))
    );

    return availabilityChecks
      .filter(check => check.available)
      .map(check => check.action);
  }

  public async executeAction(actionId: string, params: any): Promise<ActionResult> {
    const action = this.getAction(actionId);
    
    if (!action) {
      return { 
        success: false, 
        error: `Action ${actionId} not found` 
      };
    }

    // Check availability
    const isAvailable = await action.availability();
    if (!isAvailable) {
      return {
        success: false,
        error: `Action ${actionId} is not available. Required permissions may not be granted.`
      };
    }

    // Validate required parameters
    for (const param of action.parameters) {
      if (param.required && params[param.name] === undefined) {
        return {
          success: false,
          error: `Required parameter '${param.name}' is missing`
        };
      }

      if (param.validation && params[param.name] !== undefined) {
        if (!param.validation(params[param.name])) {
          return {
            success: false,
            error: `Parameter '${param.name}' failed validation`
          };
        }
      }
    }

    // Execute the action
    try {
      return await action.execute(params);
    } catch (error) {
      return {
        success: false,
        error: `Execution error: ${error.message}`
      };
    }
  }

  public searchActions(query: string): ActionDefinition[] {
    const lowercaseQuery = query.toLowerCase();
    
    return this.getAllActions().filter(action => {
      return (
        action.name.toLowerCase().includes(lowercaseQuery) ||
        action.description.toLowerCase().includes(lowercaseQuery) ||
        action.examples.some(example => 
          example.toLowerCase().includes(lowercaseQuery)
        )
      );
    });
  }
}

// Export singleton instance
export const actionsRegistry = new IOSActionsRegistry();