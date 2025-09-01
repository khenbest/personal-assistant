// Mock for react-dom in React Native environment
// GlueStack UI dependencies try to import react-dom which doesn't exist in React Native

export const flushSync = (fn) => fn();

export default {};