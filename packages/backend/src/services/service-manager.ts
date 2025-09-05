/**
 * Service Manager - Singleton Pattern
 * Ensures single instances of all services across the application
 */

import { Logger } from 'pino';
import { LLMService } from './llm-service';
import { IntentClassificationService } from './intent-classification-service';
import { CalendarService } from './calendar-service';
import { ReminderService } from './reminder-service';
import { NoteService } from './note-service';
import { EnhancedActionExecutor } from './enhanced-action-executor';
import { LLMOrchestrator } from './llm-orchestrator';

export class ServiceManager {
  private static instance: ServiceManager;
  
  private llmService: LLMService;
  private intentService: IntentClassificationService;
  private calendarService: CalendarService;
  private reminderService: ReminderService;
  private noteService: NoteService;
  private actionExecutor: EnhancedActionExecutor;
  private orchestrator: LLMOrchestrator;
  
  private constructor(private logger: Logger) {
    // Initialize core services
    this.llmService = new LLMService();
    this.intentService = new IntentClassificationService(this.llmService);
    
    // Initialize domain services
    this.calendarService = new CalendarService(this.intentService);
    this.reminderService = new ReminderService();
    this.noteService = new NoteService();
    
    // Initialize action executor with iOS support
    this.actionExecutor = new EnhancedActionExecutor(logger);
    
    // Initialize orchestrator with all dependencies
    this.orchestrator = new LLMOrchestrator(
      this.llmService,
      this.intentService,
      this.actionExecutor,
      this.calendarService,
      this.reminderService,
      this.noteService,
      logger
    );
    
    this.logger.info('ServiceManager initialized with singleton services');
  }
  
  public static getInstance(logger: Logger): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager(logger);
    }
    return ServiceManager.instance;
  }
  
  // Service accessors
  public getLLMService(): LLMService {
    return this.llmService;
  }
  
  public getIntentService(): IntentClassificationService {
    return this.intentService;
  }
  
  public getCalendarService(): CalendarService {
    return this.calendarService;
  }
  
  public getReminderService(): ReminderService {
    return this.reminderService;
  }
  
  public getNoteService(): NoteService {
    return this.noteService;
  }
  
  public getActionExecutor(): EnhancedActionExecutor {
    return this.actionExecutor;
  }
  
  public getOrchestrator(): LLMOrchestrator {
    return this.orchestrator;
  }
  
  // Convenience method for unified processing
  public async processRequest(
    text: string,
    sessionId: string,
    userId: string = 'default',
    context?: Record<string, any>
  ) {
    return this.orchestrator.processUnifiedRequest(text, sessionId, userId, context);
  }
}

export default ServiceManager;