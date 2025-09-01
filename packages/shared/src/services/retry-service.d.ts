export interface RetryOptions {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    exponentialBase?: number;
    jitter?: boolean;
    jitterFactor?: number;
    retryCondition?: (error: any, attempt: number) => boolean;
    onRetry?: (error: any, attempt: number, nextDelay: number) => void;
}
export interface RetryResult<T> {
    result?: T;
    error?: any;
    attempts: number;
    totalTime: number;
    success: boolean;
}
export declare const defaultRetryCondition: (error: any, _attempt: number) => boolean;
export declare class RetryService {
    static executeWithRetry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
    static executeWithFallback<T>(operations: Array<() => Promise<T>>, options?: RetryOptions): Promise<T>;
    static createRetryWrapper<T extends any[], R>(operation: (...args: T) => Promise<R>, options?: RetryOptions): (...args: T) => Promise<R>;
    static executeWithDetails<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<RetryResult<T>>;
    private static calculateDelay;
    private static delay;
    static extractRetryAfter(error: any): number | null;
}
export declare function retry<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
export declare function retryWithFallback<T>(operations: Array<() => Promise<T>>, options?: RetryOptions): Promise<T>;
export declare const llmRetryCondition: (error: any, attempt: number) => boolean;
export default RetryService;
//# sourceMappingURL=retry-service.d.ts.map