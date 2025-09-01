"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmRetryCondition = exports.RetryService = exports.defaultRetryCondition = void 0;
exports.retry = retry;
exports.retryWithFallback = retryWithFallback;
const defaultRetryCondition = (error, _attempt) => {
    if (!error)
        return false;
    if (error.status === 429 || error.statusCode === 429) {
        return true;
    }
    if (error.status >= 500 || error.statusCode >= 500) {
        return true;
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
        return true;
    }
    const message = error.message?.toLowerCase() || '';
    if (message.includes('rate limit') ||
        message.includes('too many requests') ||
        message.includes('timeout') ||
        message.includes('network') ||
        message.includes('429') ||
        message.includes('500') ||
        message.includes('502') ||
        message.includes('503') ||
        message.includes('504')) {
        return true;
    }
    if (error.status >= 400 && error.status < 500) {
        return false;
    }
    return false;
};
exports.defaultRetryCondition = defaultRetryCondition;
class RetryService {
    static async executeWithRetry(operation, options = {}) {
        const { maxAttempts = 3, baseDelay = 1000, maxDelay = 30000, exponentialBase = 2, jitter = true, jitterFactor = 0.1, retryCondition = exports.defaultRetryCondition, onRetry } = options;
        let lastError;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await operation();
                return result;
            }
            catch (error) {
                lastError = error;
                const shouldRetry = retryCondition(error, attempt);
                if (!shouldRetry || attempt === maxAttempts) {
                    throw error;
                }
                const delay = this.calculateDelay(attempt, baseDelay, maxDelay, exponentialBase, jitter, jitterFactor);
                if (onRetry) {
                    onRetry(error, attempt, delay);
                }
                await this.delay(delay);
            }
        }
        throw lastError;
    }
    static async executeWithFallback(operations, options = {}) {
        const errors = [];
        for (let i = 0; i < operations.length; i++) {
            const operation = operations[i];
            if (!operation) {
                continue;
            }
            try {
                const result = await this.executeWithRetry(operation, {
                    ...options,
                    maxAttempts: Math.max(1, (options.maxAttempts || 3) - i),
                });
                return result;
            }
            catch (error) {
                errors.push(error);
            }
        }
        const aggregateError = new Error(`All ${operations.length} operations failed`);
        aggregateError.errors = errors;
        throw aggregateError;
    }
    static createRetryWrapper(operation, options = {}) {
        return (...args) => {
            return this.executeWithRetry(() => operation(...args), options);
        };
    }
    static async executeWithDetails(operation, options = {}) {
        const startTime = Date.now();
        let attempts = 0;
        try {
            const result = await this.executeWithRetry(operation, {
                ...options,
                onRetry: (error, attempt, delay) => {
                    attempts = attempt;
                    if (options.onRetry) {
                        options.onRetry(error, attempt, delay);
                    }
                }
            });
            return {
                result,
                attempts: attempts + 1,
                totalTime: Date.now() - startTime,
                success: true
            };
        }
        catch (error) {
            return {
                error,
                attempts: attempts + 1,
                totalTime: Date.now() - startTime,
                success: false
            };
        }
    }
    static calculateDelay(attempt, baseDelay, maxDelay, exponentialBase, jitter, jitterFactor) {
        let delay = baseDelay * Math.pow(exponentialBase, attempt - 1);
        delay = Math.min(delay, maxDelay);
        if (jitter) {
            const jitterAmount = delay * jitterFactor;
            const randomJitter = (Math.random() - 0.5) * 2 * jitterAmount;
            delay += randomJitter;
        }
        return Math.max(100, Math.floor(delay));
    }
    static delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    static extractRetryAfter(error) {
        const retryAfter = error.headers?.['retry-after'] ||
            error.response?.headers?.['retry-after'] ||
            error.retryAfter;
        if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!isNaN(seconds)) {
                return seconds * 1000;
            }
            const retryDate = new Date(retryAfter);
            if (!isNaN(retryDate.getTime())) {
                return Math.max(0, retryDate.getTime() - Date.now());
            }
        }
        return null;
    }
}
exports.RetryService = RetryService;
async function retry(operation, options) {
    return RetryService.executeWithRetry(operation, options);
}
async function retryWithFallback(operations, options) {
    return RetryService.executeWithFallback(operations, options);
}
const llmRetryCondition = (error, attempt) => {
    if ((0, exports.defaultRetryCondition)(error, attempt)) {
        return true;
    }
    const message = error.message?.toLowerCase() || '';
    if (message.includes('rate_limit_exceeded') ||
        message.includes('insufficient_quota') ||
        message.includes('token limit')) {
        return true;
    }
    if (message.includes('overloaded') ||
        message.includes('capacity') ||
        message.includes('busy')) {
        return true;
    }
    if (message.includes('api error') && error.status >= 500) {
        return true;
    }
    return false;
};
exports.llmRetryCondition = llmRetryCondition;
exports.default = RetryService;
//# sourceMappingURL=retry-service.js.map