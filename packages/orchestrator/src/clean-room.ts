export interface ScrubberConfig {
    sensitivityLevel: 'low' | 'medium' | 'high';
    patterns?: RegExp[];
}

export const cleanRoomScrub = (text: string, config?: ScrubberConfig): string => {
    let scrubbed = text;

    // Basic PII patterns (example)
    const defaultPatterns = [
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, // Email
        /\b\d{3}-\d{2}-\d{4}\b/g, // SSN like
        /\b\d{3}-\d{3}-\d{4}\b/g, // Phone
    ];

    const patterns = config?.patterns || defaultPatterns;

    patterns.forEach(p => {
        scrubbed = scrubbed.replace(p, '[REDACTED]');
    });

    return scrubbed;
}
