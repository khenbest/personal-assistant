import { createClient } from '@supabase/supabase-js';
import { config } from '../config';

// Database types
export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: {
          id: string;
          user_id: string;
          created_at: string;
          updated_at: string;
          title?: string;
          metadata?: Record<string, any>;
        };
        Insert: Omit<Database['public']['Tables']['conversations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['conversations']['Insert']>;
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          created_at: string;
          metadata?: Record<string, any>;
        };
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['messages']['Insert']>;
      };
      calendar_events: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description?: string;
          start_time: string;
          end_time: string;
          location?: string;
          attendees?: string[];
          reminder_minutes?: number;
          created_at: string;
          updated_at: string;
          external_id?: string; // iOS Calendar ID
          metadata?: Record<string, any>;
        };
        Insert: Omit<Database['public']['Tables']['calendar_events']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['calendar_events']['Insert']>;
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description?: string;
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
          priority: 'low' | 'medium' | 'high' | 'urgent';
          due_date?: string;
          completed_at?: string;
          created_at: string;
          updated_at: string;
          metadata?: Record<string, any>;
        };
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
      };
      memory_entries: {
        Row: {
          id: string;
          user_id: string;
          type: 'short_term' | 'long_term' | 'context';
          key: string;
          value: any;
          embedding?: number[];
          expires_at?: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['memory_entries']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['memory_entries']['Insert']>;
      };
    };
  };
}

// Initialize Supabase client
const supabaseUrl = config.supabase.url || 'https://epfclgvooboffhlxccmb.supabase.co';
const supabaseAnonKey = config.supabase.anonKey || '';

let supabaseClient: ReturnType<typeof createClient<Database>> | null = null;

if (!supabaseAnonKey || supabaseAnonKey.length < 20) {
  console.warn('⚠️ Supabase Anon Key not properly configured. Database features will be limited.');
  console.warn('   Using mock database for development.');
} else {
  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });
}

// Mock database for development when Supabase is not configured
class MockDatabaseService {
  private conversations: Map<string, any> = new Map();
  private messages: Map<string, any> = new Map();
  private events: Map<string, any> = new Map();
  private tasks: Map<string, any> = new Map();
  private memory: Map<string, any> = new Map();

  async createConversation(userId: string, title?: string) {
    const id = `conv_${Date.now()}`;
    const conversation = {
      id,
      user_id: userId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async addMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
    const id = `msg_${Date.now()}`;
    const message = {
      id,
      conversation_id: conversationId,
      role,
      content,
      created_at: new Date().toISOString(),
    };
    this.messages.set(id, message);
    return message;
  }

  async createCalendarEvent(event: any) {
    const id = `event_${Date.now()}`;
    const calendarEvent = {
      ...event,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.events.set(id, calendarEvent);
    return calendarEvent;
  }

  async getUpcomingEvents(userId: string, limit = 10) {
    const now = new Date().toISOString();
    const events = Array.from(this.events.values())
      .filter(e => e.user_id === userId && e.start_time >= now)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .slice(0, limit);
    return events;
  }

  async createTask(task: any) {
    const id = `task_${Date.now()}`;
    const newTask = {
      ...task,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.tasks.set(id, newTask);
    return newTask;
  }

  async getPendingTasks(userId: string) {
    const tasks = Array.from(this.tasks.values())
      .filter(t => t.user_id === userId && ['pending', 'in_progress'].includes(t.status))
      .sort((a, b) => {
        const priorityOrder: { [key: string]: number } = { urgent: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
        if (priorityDiff !== 0) return priorityDiff;
        return (a.due_date || '').localeCompare(b.due_date || '');
      });
    return tasks;
  }

  async saveMemory(memory: any) {
    const id = `mem_${Date.now()}`;
    const memoryEntry = {
      ...memory,
      id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.memory.set(`${memory.user_id}_${memory.key}`, memoryEntry);
    return memoryEntry;
  }

  async getMemory(userId: string, key: string) {
    return this.memory.get(`${userId}_${key}`) || null;
  }
}

export const supabase = supabaseClient as any;

// Database service with typed queries
export class DatabaseService {
  async createConversation(userId: string, title?: string) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, title })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async addMessage(conversationId: string, role: 'user' | 'assistant', content: string) {
    const { data, error } = await supabase
      .from('messages')
      .insert({ conversation_id: conversationId, role, content })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async createCalendarEvent(event: Database['public']['Tables']['calendar_events']['Insert']) {
    const { data, error } = await supabase
      .from('calendar_events')
      .insert(event)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getUpcomingEvents(userId: string, limit = 10) {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .gte('start_time', now)
      .order('start_time', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  async createTask(task: Database['public']['Tables']['tasks']['Insert']) {
    const { data, error } = await supabase
      .from('tasks')
      .insert(task)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getPendingTasks(userId: string) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['pending', 'in_progress'])
      .order('priority', { ascending: false })
      .order('due_date', { ascending: true });

    if (error) throw error;
    return data;
  }

  async saveMemory(memory: Database['public']['Tables']['memory_entries']['Insert']) {
    const { data, error } = await supabase
      .from('memory_entries')
      .insert(memory)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getMemory(userId: string, key: string) {
    const { data, error } = await supabase
      .from('memory_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('key', key)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore not found errors
    return data;
  }
}

// Use mock database if Supabase is not configured
export const db = supabaseClient ? new DatabaseService() : new MockDatabaseService() as any;