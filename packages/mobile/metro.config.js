const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Create a mock for react-dom
config.resolver.extraNodeModules = {
  'react-dom': path.resolve(__dirname, 'react-dom-mock.js'),
};

module.exports = config;