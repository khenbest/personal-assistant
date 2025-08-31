import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';

export async function scheduleCommand(description: string, options: any) {
  const spinner = ora('Processing schedule command...').start();

  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    
    const response = await axios.post(`${apiUrl}/api/command`, {
      command: description,
      type: 'schedule',
      options: {
        date: options.date,
        time: options.time,
      },
    });

    spinner.succeed(chalk.green('✓ Event scheduled successfully!'));
    
    console.log(chalk.cyan('\nEvent Details:'));
    console.log(chalk.gray('─'.repeat(40)));
    
    const event = response.data.event;
    if (event) {
      console.log(`📅 ${chalk.bold('Title:')} ${event.title}`);
      console.log(`📍 ${chalk.bold('Date:')} ${new Date(event.start_time).toLocaleDateString()}`);
      console.log(`⏰ ${chalk.bold('Time:')} ${new Date(event.start_time).toLocaleTimeString()}`);
      if (event.location) {
        console.log(`📍 ${chalk.bold('Location:')} ${event.location}`);
      }
      if (event.attendees?.length > 0) {
        console.log(`👥 ${chalk.bold('Attendees:')} ${event.attendees.join(', ')}`);
      }
    }

    if (response.data.message) {
      console.log(`\n💬 ${chalk.italic(response.data.message)}`);
    }
  } catch (error) {
    spinner.fail(chalk.red('✗ Failed to schedule event'));
    
    if (axios.isAxiosError(error)) {
      if (error.response) {
        console.error(chalk.red(`Error: ${error.response.data.message || error.response.statusText}`));
      } else if (error.code === 'ECONNREFUSED') {
        console.error(chalk.yellow('\n⚠️  Backend service is not running'));
        console.error(chalk.gray('Start it with: npm run dev --workspace=@kenny-assistant/backend'));
      } else {
        console.error(chalk.red(`Error: ${error.message}`));
      }
    } else {
      console.error(chalk.red(`Error: ${error}`));
    }
    
    process.exit(1);
  }
}