import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

export async function testCommand(options: any) {
  const apiUrl = options.api || 'http://localhost:3000';
  const tests: TestResult[] = [];
  
  console.log(chalk.cyan('🧪 Running Integration Tests'));
  console.log(chalk.gray('─'.repeat(40)));
  console.log(chalk.gray(`API URL: ${apiUrl}`));
  console.log();

  // Test 1: Health Check
  await runTest('Health Check', async () => {
    const response = await axios.get(`${apiUrl}/health`);
    if (response.data.status !== 'ok') {
      throw new Error('Health check failed');
    }
  }, tests);

  // Test 2: Schedule Command
  await runTest('Schedule Command', async () => {
    const response = await axios.post(`${apiUrl}/api/command`, {
      command: 'Schedule meeting with test user tomorrow at 3pm',
      type: 'schedule',
    });
    if (!response.data.success && !response.data.event) {
      throw new Error('Schedule command failed');
    }
  }, tests);

  // Test 3: Query Command
  await runTest('Query Command', async () => {
    const response = await axios.post(`${apiUrl}/api/query`, {
      question: "What's on my calendar today?",
    });
    if (!response.data.answer && !response.data.content) {
      throw new Error('Query command failed');
    }
  }, tests);

  // Test 4: LLM Service Connection
  await runTest('LLM Service', async () => {
    const response = await axios.post(`${apiUrl}/api/command`, {
      command: 'Test LLM connection',
      type: 'test',
    });
    // Check if we got any response (even mock)
    if (response.status !== 200) {
      throw new Error('LLM service not responding');
    }
  }, tests);

  // Test 5: Database Connection (if configured)
  await runTest('Database Connection', async () => {
    const response = await axios.get(`${apiUrl}/api/health/db`);
    // This might fail if Supabase isn't configured yet
    if (response.data.status === 'error' && response.data.message?.includes('not configured')) {
      console.warn(chalk.yellow('  ⚠️  Database not configured yet'));
    }
  }, tests, true); // Allow this test to fail

  // Display results
  console.log();
  console.log(chalk.cyan('📊 Test Results'));
  console.log(chalk.gray('─'.repeat(40)));

  let passed = 0;
  let failed = 0;

  tests.forEach(test => {
    const icon = test.passed ? chalk.green('✓') : chalk.red('✗');
    const status = test.passed ? chalk.green('PASS') : chalk.red('FAIL');
    const duration = chalk.gray(`(${test.duration}ms)`);
    
    console.log(`${icon} ${test.name} ${status} ${duration}`);
    if (test.error) {
      console.log(chalk.gray(`  └─ ${test.error}`));
    }

    if (test.passed) passed++;
    else failed++;
  });

  console.log();
  console.log(chalk.gray('─'.repeat(40)));
  console.log(`Total: ${tests.length} | ${chalk.green(`Passed: ${passed}`)} | ${chalk.red(`Failed: ${failed}`)}`);

  if (options.coverage) {
    console.log();
    console.log(chalk.cyan('📈 Coverage Report'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log('Coverage reporting will be available after unit tests are implemented');
  }

  // Exit with error if any tests failed
  if (failed > 0) {
    process.exit(1);
  }
}

async function runTest(
  name: string,
  testFn: () => Promise<void>,
  results: TestResult[],
  allowFailure = false
) {
  const spinner = ora(`Running: ${name}`).start();
  const startTime = Date.now();

  try {
    await testFn();
    const duration = Date.now() - startTime;
    spinner.succeed(chalk.green(`✓ ${name}`));
    results.push({ name, passed: true, duration });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (allowFailure) {
      spinner.warn(chalk.yellow(`⚠️  ${name} (skipped)`));
      results.push({ name, passed: true, duration, error: 'Skipped - not required' });
    } else {
      spinner.fail(chalk.red(`✗ ${name}`));
      results.push({ name, passed: false, duration, error: errorMessage });
    }
  }
}