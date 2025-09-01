#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
// import ora from 'ora'; // TODO: Add loading spinners
import { scheduleCommand } from './commands/schedule';
import { queryCommand } from './commands/query';
import { testCommand } from './commands/test';

const program = new Command();

program
  .name('kenny-cli')
  .description('CLI for Kenny\'s Personal AI Assistant')
  .version('0.0.0');

program
  .command('schedule <description>')
  .description('Schedule a calendar event')
  .option('-d, --date <date>', 'Event date (ISO format)')
  .option('-t, --time <time>', 'Event time')
  .action(scheduleCommand);

program
  .command('query <question>')
  .description('Query the assistant')
  .option('-c, --context <context>', 'Additional context')
  .action(queryCommand);

program
  .command('test')
  .description('Run integration tests')
  .option('--api <url>', 'API URL', 'http://localhost:3000')
  .option('--coverage', 'Generate coverage report')
  .action(testCommand);

program.addHelpText('after', `
${chalk.gray('Examples:')}
  $ kenny-cli schedule "Meeting with John tomorrow at 3pm"
  $ kenny-cli query "What's on my calendar today?"
  $ kenny-cli test --api http://localhost:3000
`);

program.parse(process.argv);