const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Fix monorepo setup
config.projectRoot = __dirname;
config.watchFolders = [__dirname];

// Ensure resolver knows this is the root
config.resolver.alias = {
  ...config.resolver.alias,
};

// Create a mock for react-dom
config.resolver.extraNodeModules = {
  'react-dom': path.resolve(__dirname, 'react-dom-mock.js'),
};

module.exports = config;