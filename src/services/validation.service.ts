import { z } from 'zod';

export class ValidationService {
  // Message validation schema
  static readonly messageSchema = z.object({
    message: z.string()
      .min(1, 'Message cannot be empty')
      .max(4000, 'Message cannot exceed 4000 characters')
      .refine(
        (msg) => !/<script|javascript:|data:|vbscript:/i.test(msg),
        'Message contains potentially unsafe content'
      ),
    channelId: z.string()
      .min(1, 'Channel ID is required')
      .regex(/^[C|G|D][A-Z0-9]{8,}$/, 'Invalid channel ID format'),
    teamId: z.string()
      .min(1, 'Team ID is required')
      .regex(/^T[A-Z0-9]{8,}$/, 'Invalid team ID format'),
  });

  // Scheduled message validation schema
  static readonly scheduledMessageSchema = this.messageSchema.extend({
    scheduledTime: z.string()
      .refine(
        (time) => {
          const scheduledDate = new Date(time);
          const now = new Date();
          return scheduledDate > now;
        },
        'Scheduled time must be in the future'
      ),
    channelName: z.string()
      .min(1, 'Channel name is required')
      .max(100, 'Channel name cannot exceed 100 characters'),
  });

  // Channel ID validation
  static validateChannelId(channelId: string): boolean {
    return /^[C|G|D][A-Z0-9]{8,}$/.test(channelId);
  }

  // Team ID validation
  static validateTeamId(teamId: string): boolean {
    return /^T[A-Z0-9]{8,}$/.test(teamId);
  }

  // Message content validation
  static validateMessageContent(message: string): { isValid: boolean; error?: string } {
    if (!message || message.trim().length === 0) {
      return { isValid: false, error: 'Message cannot be empty' };
    }

    if (message.length > 4000) {
      return { isValid: false, error: 'Message cannot exceed 4000 characters' };
    }

    // Check for potentially unsafe content
    const unsafePatterns = [
      /<script/i,
      /javascript:/i,
      /data:/i,
      /vbscript:/i,
      /on\w+\s*=/i, // Event handlers like onclick=
    ];

    for (const pattern of unsafePatterns) {
      if (pattern.test(message)) {
        return { isValid: false, error: 'Message contains potentially unsafe content' };
      }
    }

    return { isValid: true };
  }

  // Scheduled time validation
  static validateScheduledTime(scheduledTime: string): { isValid: boolean; error?: string } {
    const scheduledDate = new Date(scheduledTime);
    const now = new Date();

    if (isNaN(scheduledDate.getTime())) {
      return { isValid: false, error: 'Invalid date format' };
    }

    if (scheduledDate <= now) {
      return { isValid: false, error: 'Scheduled time must be in the future' };
    }

    // Check if scheduled time is not too far in the future (e.g., 1 year)
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    if (scheduledDate > oneYearFromNow) {
      return { isValid: false, error: 'Scheduled time cannot be more than 1 year in the future' };
    }

    return { isValid: true };
  }

  // Sanitize message content
  static sanitizeMessage(message: string): string {
    return message
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .trim();
  }

  // Validate and sanitize message
  static validateAndSanitizeMessage(message: string): { isValid: boolean; sanitizedMessage?: string; error?: string } {
    const validation = this.validateMessageContent(message);
    if (!validation.isValid) {
      return validation;
    }

    const sanitizedMessage = this.sanitizeMessage(message);
    return { isValid: true, sanitizedMessage };
  }
}
