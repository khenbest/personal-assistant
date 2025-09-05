/**
 * Enhanced Action Executor
 * 
 * Integrates the iOS Actions Registry with the existing action executor
 * Provides intelligent action matching and execution with fallback strategies
 */

import { Logger } from 'pino';
import { 
  actionsRegistry, 
  IOSActionsRegistry,
  ActionDefinition, 
  ActionDomain,
  ActionResult,
  Permission 
} from './ios-actions-registry';
import { IntentClassification } from './intent-classification-service';
import * as chrono from 'chrono-node';

export interface ExecutionContext {
  sessionId: string;
  userId?: string;
  deviceInfo?: {
    platform: 'ios' | 'android' | 'web';
    version: string;
  };
  preferences?: {
    language: string;
    timezone: string;
  };
}

export interface EnhancedActionResult {
  success: boolean;
  actionId?: string;
  actionName?: string;
  domain?: ActionDomain;
  result?: ActionResult;
  naturalResponse?: string;
  suggestedActions?: ActionDefinition[];
  context?: any;
}

export class EnhancedActionExecutor {
  private registry: IOSActionsRegistry;
  private permissionCache: Map<Permission, boolean> = new Map();

  constructor(private logger: Logger) {
    this.registry = actionsRegistry;
    this.initializePermissionCache();
  }

  private async initializePermissionCache() {
    // Pre-cache permission statuses for better performance
    const allActions = this.registry.getAllActions();
    const uniquePermissions = new Set<Permission>();
    
    allActions.forEach(action => {
      action.requiredPermissions.forEach(permission => {
        uniquePermissions.add(permission);
      });
    });

    // This would be checked on the mobile side
    // For now, we'll assume permissions are handled by the mobile app
  }

  /**
   * Execute an action based on intent classification
   */
  public async executeFromIntent(
    classification: IntentClassification,
    originalText: string,
    context?: ExecutionContext
  ): Promise<EnhancedActionResult> {
    this.logger.info({ 
      intent: classification.intent, 
      confidence: classification.confidence 
    }, 'Executing action from intent');

    try {
      // Map intent to action
      const action = await this.findBestAction(classification, originalText);
      
      if (!action) {
        return this.handleUnknownIntent(classification, originalText);
      }

      // Extract parameters from the original text and slots
      const params = await this.extractParameters(
        action, 
        originalText, 
        classification.slots
      );

      // Execute the action
      const result = await this.registry.executeAction(action.id, params);

      // Generate natural language response
      const naturalResponse = this.generateNaturalResponse(
        action,
        result,
        params
      );

      // Find related actions for follow-up
      const suggestedActions = this.findRelatedActions(action);

      return {
        success: result.success,
        actionId: action.id,
        actionName: action.name,
        domain: action.domain,
        result,
        naturalResponse,
        suggestedActions,
        context: {
          params,
          classification
        }
      };
    } catch (error) {
      this.logger.error({ error, classification }, 'Error executing action');
      return {
        success: false,
        naturalResponse: 'I encountered an error while trying to help with that. Could you please try again?',
        result: {
          success: false,
          error: error.message
        }
      };
    }
  }

  /**
   * Find the best matching action for an intent
   */
  private async findBestAction(
    classification: IntentClassification,
    originalText: string
  ): Promise<ActionDefinition | null> {
    // First, try direct intent mapping
    const directMapping = this.getDirectIntentMapping(classification.intent);
    if (directMapping) {
      const action = this.registry.getAction(directMapping);
      if (action && await action.availability()) {
        return action;
      }
    }

    // Search actions by the original text
    const searchResults = this.registry.searchActions(originalText);
    
    // Filter by availability
    const availableActions = [];
    for (const action of searchResults) {
      if (await action.availability()) {
        availableActions.push(action);
      }
    }

    if (availableActions.length === 0) {
      return null;
    }

    // Score actions based on intent match and slot coverage
    const scoredActions = availableActions.map(action => ({
      action,
      score: this.scoreAction(action, classification, originalText)
    }));

    // Sort by score and return the best match
    scoredActions.sort((a, b) => b.score - a.score);
    
    if (scoredActions[0].score > 0.5) {
      return scoredActions[0].action;
    }

    return null;
  }

  /**
   * Map intents to specific action IDs
   */
  private getDirectIntentMapping(intent: string): string | null {
    const mappings: Record<string, string> = {
      'create_event': 'calendar.create_event',
      'schedule_meeting': 'calendar.create_event',
      'get_events': 'calendar.get_events',
      'check_calendar': 'calendar.get_events',
      'create_reminder': 'calendar.create_reminder',
      'set_reminder': 'calendar.create_reminder',
      'find_contact': 'contacts.search',
      'search_contact': 'contacts.search',
      'add_contact': 'contacts.create',
      'create_contact': 'contacts.create',
      'get_location': 'location.current',
      'where_am_i': 'location.current',
      'schedule_notification': 'notifications.schedule',
      'set_notification': 'notifications.schedule',
      'take_photo': 'media.take_photo',
      'capture_photo': 'media.take_photo',
      'send_email': 'communication.compose_email',
      'compose_email': 'communication.compose_email',
      'send_sms': 'communication.send_sms',
      'send_text': 'communication.send_sms',
      'battery_status': 'device.battery_status',
      'check_battery': 'device.battery_status',
      'adjust_brightness': 'device.brightness',
      'set_brightness': 'device.brightness',
      'speak_text': 'audio.speak',
      'text_to_speech': 'audio.speak',
      'haptic_feedback': 'haptics.feedback',
      'vibrate': 'haptics.feedback'
    };

    return mappings[intent] || null;
  }

  /**
   * Score an action based on how well it matches the intent
   */
  private scoreAction(
    action: ActionDefinition,
    classification: IntentClassification,
    originalText: string
  ): number {
    let score = 0;

    // Check if any examples match
    const lowercaseText = originalText.toLowerCase();
    for (const example of action.examples) {
      if (this.calculateSimilarity(lowercaseText, example.toLowerCase()) > 0.7) {
        score += 0.5;
        break;
      }
    }

    // Check parameter coverage
    const requiredParams = action.parameters.filter(p => p.required);
    const slots = classification.slots || {};
    let paramCoverage = 0;

    for (const param of requiredParams) {
      if (this.canExtractParameter(param.name, slots, originalText)) {
        paramCoverage++;
      }
    }

    if (requiredParams.length > 0) {
      score += (paramCoverage / requiredParams.length) * 0.3;
    }

    // Boost score based on confidence
    score += classification.confidence * 0.2;

    return score;
  }

  /**
   * Calculate similarity between two strings
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    const intersection = words1.filter(word => words2.includes(word));
    
    return intersection.length / Math.max(words1.length, words2.length);
  }

  /**
   * Check if a parameter can be extracted
   */
  private canExtractParameter(
    paramName: string,
    slots: Record<string, any>,
    text: string
  ): boolean {
    // Check if slot exists
    if (slots[paramName]) return true;

    // Check for common patterns
    const patterns: Record<string, RegExp> = {
      email: /\b[\w._%+-]+@[\w.-]+\.[A-Z|a-z]{2,}\b/i,
      phoneNumber: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
      time: /\b\d{1,2}:\d{2}\s*(am|pm)?\b/i,
      date: /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i
    };

    if (patterns[paramName]) {
      return patterns[paramName].test(text);
    }

    return false;
  }

  /**
   * Extract parameters for an action
   */
  private async extractParameters(
    action: ActionDefinition,
    originalText: string,
    slots: Record<string, any>
  ): Promise<Record<string, any>> {
    const params: Record<string, any> = {};

    for (const paramDef of action.parameters) {
      let value = null;

      // Try to get from slots first
      if (slots[paramDef.name]) {
        value = slots[paramDef.name];
      } else {
        // Extract based on parameter type
        value = this.extractParameterFromText(
          paramDef.name,
          paramDef.type,
          originalText
        );
      }

      // Apply default value if needed
      if (value === null && paramDef.defaultValue !== undefined) {
        value = paramDef.defaultValue;
      }

      if (value !== null) {
        params[paramDef.name] = value;
      }
    }

    // Special handling for date/time parameters
    if (action.domain === ActionDomain.CALENDAR) {
      this.enrichCalendarParameters(params, originalText);
    }

    return params;
  }

  /**
   * Extract a specific parameter from text
   */
  private extractParameterFromText(
    paramName: string,
    paramType: string,
    text: string
  ): any {
    switch (paramType) {
      case 'date':
        const parsedDate = chrono.parseDate(text);
        return parsedDate;

      case 'string':
        // Extract based on parameter name
        if (paramName === 'title' || paramName === 'subject') {
          // Extract quoted text or main phrase
          const quoted = text.match(/"([^"]+)"/);
          if (quoted) return quoted[1];
          
          // Remove common words and return the main content
          const cleaned = text
            .replace(/^(create|add|schedule|set|make|new)\s+/i, '')
            .replace(/\s+(at|on|for|with|to|from)\s+.*$/i, '');
          return cleaned;
        }
        break;

      case 'number':
        const numbers = text.match(/\d+/);
        if (numbers) {
          return parseInt(numbers[0]);
        }
        break;

      case 'boolean':
        return text.includes('yes') || text.includes('true') || text.includes('enable');

      case 'array':
        // Extract comma-separated values or multiple mentions
        if (paramName === 'recipients' || paramName === 'attendees') {
          const emails = text.match(/\b[\w._%+-]+@[\w.-]+\.[A-Z|a-z]{2,}\b/gi);
          return emails || [];
        }
        break;
    }

    return null;
  }

  /**
   * Enrich calendar-specific parameters
   */
  private enrichCalendarParameters(params: Record<string, any>, text: string) {
    // Parse time expressions
    const parsed = chrono.parse(text);
    
    if (parsed.length > 0) {
      const result = parsed[0];
      
      if (!params.startDate && result.start) {
        params.startDate = result.start.date();
      }
      
      if (!params.endDate) {
        if (result.end) {
          params.endDate = result.end.date();
        } else if (params.startDate) {
          // Default to 1 hour duration
          params.endDate = new Date(params.startDate.getTime() + 60 * 60 * 1000);
        }
      }
    }

    // Extract location
    if (!params.location) {
      const locationMatch = text.match(/(?:at|in)\s+([A-Z][^,.]+)/);
      if (locationMatch) {
        params.location = locationMatch[1].trim();
      }
    }
  }

  /**
   * Generate a natural language response
   */
  private generateNaturalResponse(
    action: ActionDefinition,
    result: ActionResult,
    params: Record<string, any>
  ): string {
    if (!result.success) {
      return this.generateErrorResponse(action, result.error);
    }

    // Generate success responses based on domain
    switch (action.domain) {
      case ActionDomain.CALENDAR:
        return this.generateCalendarResponse(action, result, params);
      
      case ActionDomain.CONTACTS:
        return this.generateContactsResponse(action, result, params);
      
      case ActionDomain.LOCATION:
        return this.generateLocationResponse(action, result, params);
      
      case ActionDomain.NOTIFICATIONS:
        return this.generateNotificationResponse(action, result, params);
      
      case ActionDomain.DEVICE:
        return this.generateDeviceResponse(action, result, params);
      
      default:
        return `Successfully completed ${action.name}${result.suggestedFollowUp ? '. ' + result.suggestedFollowUp : '.'}`;
    }
  }

  /**
   * Generate error response
   */
  private generateErrorResponse(action: ActionDefinition, error?: string): string {
    const baseError = `I couldn't complete ${action.name}`;
    
    if (error?.includes('permission')) {
      return `${baseError} because I need permission to access that. Please check your settings.`;
    }
    
    if (error?.includes('not found')) {
      return `${baseError} because I couldn't find what you're looking for.`;
    }
    
    return `${baseError}. ${error || 'Please try again.'}`;
  }

  /**
   * Generate calendar-specific response
   */
  private generateCalendarResponse(
    action: ActionDefinition,
    result: ActionResult,
    params: Record<string, any>
  ): string {
    if (action.id === 'calendar.create_event') {
      const date = params.startDate ? 
        new Date(params.startDate).toLocaleDateString() : 
        'the specified time';
      return `I've added "${params.title}" to your calendar for ${date}.`;
    }
    
    if (action.id === 'calendar.get_events') {
      const events = result.data as any[];
      if (events.length === 0) {
        return 'You have no events scheduled for that time.';
      }
      if (events.length === 1) {
        return `You have "${events[0].title}" scheduled.`;
      }
      return `You have ${events.length} events scheduled, including "${events[0].title}".`;
    }
    
    if (action.id === 'calendar.create_reminder') {
      return `I've created a reminder: "${params.title}".`;
    }
    
    return `Calendar action completed successfully.`;
  }

  /**
   * Generate contacts-specific response
   */
  private generateContactsResponse(
    action: ActionDefinition,
    result: ActionResult,
    params: Record<string, any>
  ): string {
    if (action.id === 'contacts.search') {
      const contacts = result.data as any[];
      if (contacts.length === 0) {
        return `I couldn't find any contacts matching "${params.query}".`;
      }
      if (contacts.length === 1) {
        const contact = contacts[0];
        return `I found ${contact.name}${contact.phoneNumbers?.length > 0 ? 
          ` (${contact.phoneNumbers[0].number})` : ''}.`;
      }
      return `I found ${contacts.length} contacts matching your search.`;
    }
    
    if (action.id === 'contacts.create') {
      return `I've added ${params.firstName}${params.lastName ? ' ' + params.lastName : ''} to your contacts.`;
    }
    
    return `Contact action completed successfully.`;
  }

  /**
   * Generate location-specific response
   */
  private generateLocationResponse(
    action: ActionDefinition,
    result: ActionResult,
    params: Record<string, any>
  ): string {
    if (action.id === 'location.current') {
      const data = result.data as any;
      if (data.address) {
        return `You're at ${data.address.street || data.address.city || 'your current location'}.`;
      }
      return `Your coordinates are ${data.coordinates.latitude.toFixed(4)}, ${data.coordinates.longitude.toFixed(4)}.`;
    }
    
    if (action.id === 'location.geocode') {
      const locations = result.data as any[];
      if (locations.length > 0) {
        return `I found the location at coordinates ${locations[0].latitude.toFixed(4)}, ${locations[0].longitude.toFixed(4)}.`;
      }
    }
    
    return `Location action completed successfully.`;
  }

  /**
   * Generate notification-specific response
   */
  private generateNotificationResponse(
    action: ActionDefinition,
    result: ActionResult,
    params: Record<string, any>
  ): string {
    if (action.id === 'notifications.schedule') {
      return `I've scheduled a notification: "${params.title}".`;
    }
    
    if (action.id === 'notifications.cancel') {
      return params.notificationId ? 
        'I\'ve cancelled that notification.' : 
        'I\'ve cancelled all scheduled notifications.';
    }
    
    return `Notification action completed successfully.`;
  }

  /**
   * Generate device-specific response
   */
  private generateDeviceResponse(
    action: ActionDefinition,
    result: ActionResult,
    params: Record<string, any>
  ): string {
    if (action.id === 'device.battery_status') {
      const data = result.data as any;
      const charging = data.isCharging ? ' and charging' : '';
      return `Your battery is at ${data.level}%${charging}.`;
    }
    
    if (action.id === 'device.brightness') {
      const data = result.data as any;
      return params.brightness !== undefined ? 
        `I've set the brightness to ${data.brightness}%.` :
        `The current brightness is ${data.brightness}%.`;
    }
    
    if (action.id === 'device.clipboard') {
      if (params.operation === 'copy') {
        return 'I\'ve copied that to your clipboard.';
      }
      if (params.operation === 'paste') {
        const data = result.data as any;
        return data.text ? 
          `From your clipboard: "${data.text}"` : 
          'Your clipboard is empty.';
      }
    }
    
    return `Device action completed successfully.`;
  }

  /**
   * Handle unknown intents
   */
  private handleUnknownIntent(
    classification: IntentClassification,
    originalText: string
  ): EnhancedActionResult {
    // Try to find similar actions
    const suggestions = this.registry.searchActions(originalText).slice(0, 3);
    
    return {
      success: false,
      naturalResponse: suggestions.length > 0 ?
        `I'm not sure how to help with that. Did you mean to ${suggestions[0].name.toLowerCase()}?` :
        'I\'m not sure how to help with that. Could you please rephrase your request?',
      suggestedActions: suggestions
    };
  }

  /**
   * Find related actions for follow-up suggestions
   */
  private findRelatedActions(action: ActionDefinition): ActionDefinition[] {
    // Get actions from the same domain
    const domainActions = this.registry
      .getActionsByDomain(action.domain)
      .filter(a => a.id !== action.id);
    
    // Prioritize complementary actions
    const complementaryPairs: Record<string, string[]> = {
      'calendar.create_event': ['calendar.get_events', 'calendar.create_reminder'],
      'calendar.get_events': ['calendar.create_event'],
      'contacts.search': ['contacts.create', 'communication.compose_email'],
      'contacts.create': ['contacts.search'],
      'location.current': ['location.geocode'],
      'notifications.schedule': ['notifications.cancel']
    };
    
    const complementaryIds = complementaryPairs[action.id] || [];
    const complementaryActions = complementaryIds
      .map(id => this.registry.getAction(id))
      .filter(a => a !== undefined) as ActionDefinition[];
    
    // Combine and return top suggestions
    const allSuggestions = [...complementaryActions, ...domainActions];
    return allSuggestions.slice(0, 3);
  }

  /**
   * Get available actions for the current context
   */
  public async getAvailableActions(context?: ExecutionContext): Promise<ActionDefinition[]> {
    return await this.registry.getAvailableActions();
  }

  /**
   * Get action suggestions based on partial input
   */
  public getActionSuggestions(partialInput: string): ActionDefinition[] {
    return this.registry.searchActions(partialInput);
  }
}