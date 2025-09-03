const path = require('path');
const fs = require('fs');

console.log('__dirname:', __dirname);
console.log('process.cwd():', process.cwd());

const possiblePaths = [
  path.join(process.cwd(), '../../data/overview_data/intent_training.csv'),
  path.join(__dirname, '../../../data/overview_data/intent_training.csv'),
  path.join(__dirname, '../../../../data/overview_data/intent_training.csv'),
  '/Users/kenny/repos/personal-assistant/data/overview_data/intent_training.csv'
];

possiblePaths.forEach(p => {
  console.log(`Checking ${p}: ${fs.existsSync(p) ? '✅ EXISTS' : '❌ NOT FOUND'}`);
});