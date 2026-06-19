export interface SanitizationResult {
  sanitizedText: string;
  hasInjectionAttempt: boolean;
  detectedPhrases: string[];
}

export class ConversationSanitizer {
  // Common prompt override and injection keywords/phrases
  private injectionPatterns: Array<{ pattern: RegExp; description: string }> = [
    {
      pattern: /ignore\s+(?:all\s+)?(?:previous\s+)?instructions/gi,
      description: 'Ignore instructions override'
    },
    {
      pattern: /mark\s+(?:this|row)\s+(?:as\s+)?(?:supported|contradicted|approved)/gi,
      description: 'Status forcing instruction'
    },
    {
      pattern: /skip\s+(?:manual\s+)?review/gi,
      description: 'Review bypass instruction'
    },
    {
      pattern: /approve\s+(?:immediately|the\s+claim)/gi,
      description: 'Approval forcing instruction'
    },
    {
      pattern: /claim\s+approve\s+kar\s+dena/gi,
      description: 'Hinglish approval request'
    },
    {
      pattern: /system\s+reading\s+this\s+should/gi,
      description: 'System override target'
    },
    {
      pattern: /follow\s+the\s+note/gi,
      description: 'Note instruction leakage'
    },
    {
      pattern: /ignore\s+visual\s+evidence/gi,
      description: 'Evidence bypass instruction'
    }
  ];

  /**
   * Scans a conversation text for prompt injection attempts.
   * Cleans the text by removing or redacting the offending phrases to prevent VLM manipulation.
   */
  public sanitize(text: string): SanitizationResult {
    let sanitizedText = text;
    let hasInjectionAttempt = false;
    const detectedPhrases: string[] = [];

    // Evaluate each pattern against the text
    for (const { pattern, description } of this.injectionPatterns) {
      if (pattern.test(sanitizedText)) {
        hasInjectionAttempt = true;
        detectedPhrases.push(description);
        // Redact the matched pattern to prevent it from reaching the LLM/VLM context
        sanitizedText = sanitizedText.replace(pattern, '[REDACTED SYSTEM INSTRUCTION ATTEMPT]');
      }
    }

    // Secondary scan for general note-following instructions inside the text
    if (sanitizedText.toLowerCase().includes('follow') && sanitizedText.toLowerCase().includes('note')) {
      hasInjectionAttempt = true;
      if (!detectedPhrases.includes('Note instruction leakage')) {
        detectedPhrases.push('Note instruction leakage');
      }
    }

    return {
      sanitizedText,
      hasInjectionAttempt,
      detectedPhrases,
    };
  }
}
