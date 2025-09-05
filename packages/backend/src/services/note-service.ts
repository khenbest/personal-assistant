/**
 * Note Service
 * Handles creation and management of notes
 * 
 * CLAUDE: Check context! npm run context:show
 */

// import { SlotExtractionService } from './slot-extraction-service'; // TODO: Implement when needed
import { createClient } from '@supabase/supabase-js';
// import { LLMService } from './llm-service'; // TODO: Implement when needed

export interface Note {
  id?: string;
  user_id: string;
  title?: string;
  content: string;
  tags?: string[];
  created_at?: Date;
  updated_at?: Date;
}

export interface NoteResult {
  success: boolean;
  note?: Note;
  message: string;
  spokenResponse: string;
}

export class NoteService {
  private supabase;

  constructor() {
    // TODO: Implement slot extraction for notes when needed
    // const llmService = new LLMService();
    // const slotExtractor = new SlotExtractionService(llmService);
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  /**
   * Create a note (simple interface for action-executor)
   */
  async create(noteData: any): Promise<Note> {
    const result = await this.processNoteCommand(
      noteData.text || noteData.content,
      noteData.userId || 'demo-user'
    );
    
    if (!result.success || !result.note) {
      throw new Error(result.message);
    }
    
    return result.note;
  }

  /**
   * Process note command from voice input
   */
  async processNoteCommand(command: string, userId: string = 'demo-user'): Promise<NoteResult> {
    try {
      // Extract note content
      const { title, content, tags } = this.extractNoteContent(command);
      
      if (!content) {
        return {
          success: false,
          message: 'Could not understand what note to create',
          spokenResponse: "I couldn't understand what you want to note. Please try again."
        };
      }
      
      // Create note object
      const note: Note = {
        user_id: userId,
        title: title || this.generateTitle(content),
        content,
        tags,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Save to database
      const savedNote = await this.saveNote(note);
      
      // Generate response
      const message = `✅ Note created: "${note.title}"`;
      const spokenResponse = `I've created a note titled "${note.title}".`;
      
      return {
        success: true,
        note: savedNote,
        message,
        spokenResponse
      };
      
    } catch (error: any) {
      console.error('Note service error:', error);
      return {
        success: false,
        message: 'Failed to create note',
        spokenResponse: "I'm sorry, I couldn't create the note. Please try again."
      };
    }
  }
  
  /**
   * Extract note content from command
   */
  private extractNoteContent(command: string): { title?: string; content: string; tags?: string[] } {
    // Patterns for extracting note content
    const patterns = [
      /(?:create\s+a?\s+)?note(?:\s+about)?\s+(.+)/i,
      /(?:make\s+a?\s+)?note(?:\s+that)?\s+(.+)/i,
      /(?:add\s+a?\s+)?note(?:\s+saying)?\s+(.+)/i,
      /jot\s+down\s+(.+)/i,
      /remember\s+that\s+(.+)/i,
      /write\s+down\s+(.+)/i
    ];
    
    let content = '';
    for (const pattern of patterns) {
      const match = command.match(pattern);
      if (match && match[1]) {
        content = match[1].trim();
        break;
      }
    }
    
    if (!content) {
      // Use the whole command as content
      content = command;
    }
    
    // Extract title if specified
    let title: string | undefined;
    const titleMatch = content.match(/(?:titled?|called)\s+"([^"]+)"/i);
    if (titleMatch) {
      title = titleMatch[1];
      content = content.replace(titleMatch[0], '').trim();
    }
    
    // Extract tags if specified
    const tags: string[] = [];
    const tagMatch = content.match(/(?:tag(?:ged)?|with tags?)\s+(.+?)(?:\s+and|\s*$)/i);
    if (tagMatch && tagMatch[1]) {
      const tagString = tagMatch[1];
      tags.push(...tagString.split(/[,\s]+/).filter(t => t.length > 0));
      content = content.replace(tagMatch[0], '').trim();
    }
    
    // Also check for hashtags
    const hashtagMatches = content.match(/#\w+/g);
    if (hashtagMatches) {
      tags.push(...hashtagMatches.map(t => t.substring(1)));
      content = content.replace(/#\w+/g, '').trim();
    }
    
    return { title, content, tags: tags.length > 0 ? tags : undefined };
  }
  
  /**
   * Generate a title from content
   */
  private generateTitle(content: string): string {
    // Take first 50 characters or first sentence
    const firstSentence = content.match(/^[^.!?]+/);
    const title = firstSentence ? firstSentence[0] : content;
    
    if (title.length > 50) {
      return title.substring(0, 47) + '...';
    }
    return title;
  }
  
  /**
   * Save note to database
   */
  private async saveNote(note: Note): Promise<Note> {
    if (!this.supabase) {
      // Return mock if database not configured
      return {
        ...note,
        id: `mock-${Date.now()}`
      };
    }
    
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .insert([note])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Database save failed, using mock:', error);
      return {
        ...note,
        id: `mock-${Date.now()}`
      };
    }
  }
  
  /**
   * Get notes for a user
   */
  async getNotes(userId: string, limit: number = 50): Promise<Note[]> {
    if (!this.supabase) {
      return [];
    }
    
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      return [];
    }
  }
  
  /**
   * Search notes by content or tags
   */
  async searchNotes(userId: string, query: string): Promise<Note[]> {
    if (!this.supabase) {
      return [];
    }
    
    try {
      const { data, error } = await this.supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .or(`content.ilike.%${query}%,title.ilike.%${query}%`)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to search notes:', error);
      return [];
    }
  }
  
  /**
   * Update a note
   */
  async updateNote(noteId: string, updates: Partial<Note>): Promise<boolean> {
    if (!this.supabase) {
      return true;
    }
    
    try {
      const { error } = await this.supabase
        .from('notes')
        .update({ ...updates, updated_at: new Date() })
        .eq('id', noteId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to update note:', error);
      return false;
    }
  }
  
  /**
   * Delete a note
   */
  async deleteNote(noteId: string): Promise<boolean> {
    if (!this.supabase) {
      return true;
    }
    
    try {
      const { error } = await this.supabase
        .from('notes')
        .delete()
        .eq('id', noteId);
      
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to delete note:', error);
      return false;
    }
  }
}

export const noteService = new NoteService();