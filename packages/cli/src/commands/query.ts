import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';

export async function queryCommand(question: string, options: any) {
  const spinner = ora('Processing query...').start();

  try {
    const apiUrl = process.env.API_URL || 'http://localhost:3000';
    
    const response = await axios.post(`${apiUrl}/api/query`, {
      question,
      context: options.context,
    });

    spinner.succeed(chalk.green('✓ Query processed'));
    
    console.log(chalk.cyan('\n💬 Response:'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(response.data.answer || response.data.content);

    if (response.data.events && response.data.events.length > 0) {
      console.log(chalk.cyan('\n📅 Related Events:'));
      response.data.events.forEach((event: any) => {
        console.log(`  • ${event.title} - ${new Date(event.start_time).toLocaleString()}`);
      });
    }

    if (response.data.tasks && response.data.tasks.length > 0) {
      console.log(chalk.cyan('\n📋 Related Tasks:'));
      response.data.tasks.forEach((task: any) => {
        const status = task.status === 'completed' ? '✓' : '○';
        console.log(`  ${status} ${task.title} (${task.priority})`);
      });
    }
  } catch (error) {
    spinner.fail(chalk.red('✗ Query failed'));
    
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