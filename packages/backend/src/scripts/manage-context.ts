#!/usr/bin/env node

/**
 * Context Management CLI
 * Simple commands to manage Claude's context
 */

import { contextDocService } from '../services/context-doc-service';
import * as fs from 'fs';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  const command = process.argv[2];
  const args = process.argv.slice(3);

  switch (command) {
    case 'task':
      // Set current task
      if (args.length === 0) {
        const task = await prompt('What task are you working on? ');
        contextDocService.setCurrentTask(task);
        console.log('✅ Task set:', task);
      } else {
        const task = args.join(' ');
        contextDocService.setCurrentTask(task);
        console.log('✅ Task set:', task);
      }
      break;

    case 'working':
      // Add working item
      if (args.length === 0) {
        const item = await prompt('What are you working on? ');
        contextDocService.addWorkingOn(item);
        console.log('✅ Added to working items:', item);
      } else {
        const item = args.join(' ');
        contextDocService.addWorkingOn(item);
        console.log('✅ Added to working items:', item);
      }
      break;

    case 'decision':
      // Record a decision
      if (args.length === 0) {
        const decision = await prompt('What decision was made? ');
        contextDocService.addDecision(decision);
        console.log('✅ Decision recorded:', decision);
      } else {
        const decision = args.join(' ');
        contextDocService.addDecision(decision);
        console.log('✅ Decision recorded:', decision);
      }
      break;

    case 'action':
      // Add pending action
      if (args.length === 0) {
        const action = await prompt('What action needs to be done? ');
        contextDocService.addPendingAction(action);
        console.log('✅ Action added:', action);
      } else {
        const action = args.join(' ');
        contextDocService.addPendingAction(action);
        console.log('✅ Action added:', action);
      }
      break;

    case 'complete':
      // Complete an action
      if (args.length === 0) {
        const action = await prompt('What action was completed? ');
        contextDocService.completePendingAction(action);
        console.log('✅ Action completed:', action);
      } else {
        const action = args.join(' ');
        contextDocService.completePendingAction(action);
        console.log('✅ Action completed:', action);
      }
      break;

    case 'fact':
      // Add key fact
      if (args.length === 0) {
        const fact = await prompt('What key fact should be remembered? ');
        contextDocService.addKeyFact(fact);
        console.log('✅ Fact added:', fact);
      } else {
        const fact = args.join(' ');
        contextDocService.addKeyFact(fact);
        console.log('✅ Fact added:', fact);
      }
      break;

    case 'show':
      // Show current context
      console.log('\n📚 Current Context Files:');
      const files = contextDocService.getContextFiles();
      files.forEach(file => {
        if (fs.existsSync(file)) {
          console.log(`\n📄 ${file}:`);
          console.log('---');
          const content = fs.readFileSync(file, 'utf8');
          console.log(content.substring(0, 500) + '...\n');
        }
      });
      break;

    case 'summary':
      // Show context summary
      console.log(contextDocService.createContextSummary());
      break;

    case 'clear':
      // Clear session
      const confirm = await prompt('Clear current session and start fresh? (y/n) ');
      if (confirm.toLowerCase() === 'y') {
        contextDocService.clearSession();
        console.log('✅ Session cleared');
      }
      break;

    case 'claude':
      // Get context info for Claude
      console.log(contextDocService.getContextForClaude());
      break;

    default:
      console.log(`
Claude Context Manager

Usage: npm run context [command] [args...]

Commands:
  task [description]     - Set current task
  working [item]        - Add what you're working on
  decision [text]       - Record a decision made
  action [text]         - Add a pending action
  complete [text]       - Mark action as complete
  fact [text]          - Add a key fact to remember
  show                 - Show current context files
  summary              - Show context summary
  clear                - Clear session and start fresh
  claude               - Get context info for Claude

Examples:
  npm run context task "Implementing context management"
  npm run context working "context-doc-service.ts"
  npm run context decision "Use files instead of database"
  npm run context action "Test with Claude"
  npm run context complete "Test with Claude"
  npm run context fact "Claude needs file paths for context"
  npm run context show
  npm run context claude
`);
  }

  rl.close();
}

main().catch(console.error);