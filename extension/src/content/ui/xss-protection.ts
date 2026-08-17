/**
 * XSS Protection Utilities - Phase 12
 * Provides safe HTML rendering and URL validation to prevent XSS attacks.
 */

/**
 * Escapes HTML special characters in a string.
 * Safe for use in text content, attributes, and URLs.
 */
export function escapeHtml(input: unknown): string {
  if (input === null || input === undefined) return "";
  const str = String(input);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;")
    .replace(/`/g, "&#x60;")
    .replace(/=/g, "&#x3D;");
}

/**
 * Escapes text for use in HTML attributes.
 * More restrictive than escapeHtml - prevents attribute breakouts.
 */
export function escapeAttribute(input: unknown): string {
  return escapeHtml(input)
    .replace(/ /g, "&nbsp;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;");
}

/**
 * Validates a URL to ensure it's safe to render as a link.
 * Only allows HTTP(S) and known-safe schemes.
 */
export function sanitizeUrl(url: unknown): string {
  if (url === null || url === undefined) return "#";

  const str = String(url).trim();
  if (str.length === 0) return "#";

  // Only allow safe URL schemes
  const safeRegex = /^(https?:\/\/|mailto:|tel:|\/|#)/i;
  if (!safeRegex.test(str)) {
    return "#";
  }

  // Reject javascript:, data: (except images), vbscript: schemes
  const dangerousRegex = /^(javascript:|vbscript:|data:(?!image\/))/i;
  if (dangerousRegex.test(str)) {
    return "#";
  }

  // Reject URLs with control characters or null bytes
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(str)) {
    return "#";
  }

  return str;
}

/**
 * Sanitizes text for display in UI components.
 * Removes control characters and null bytes.
 */
export function sanitizeText(input: unknown): string {
  if (input === null || input === undefined) return "";

  const str = String(input);

  // Remove control characters (except tab, newline, carriage return)
  const cleaned = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Remove null bytes
  return cleaned.replace(/\0/g, "");
}

/**
 * Creates a safe DOM element from text content.
 * Avoids innerHTML for untrusted data.
 */
export function createSafeElement(
  tag: string,
  textContent?: string,
  className?: string
): HTMLElement {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent !== undefined) {
    element.textContent = sanitizeText(textContent);
  }
  return element;
}

/**
 * Validates that a claim text is safe to send to backend.
 * Checks for injection patterns and oversized content.
 */
export function validateClaimText(claim: string, maxLength = 5000): {
  valid: boolean;
  error?: string;
  sanitized: string;
} {
  if (!claim || typeof claim !== "string") {
    return { valid: false, error: "Claim must be a non-empty string", sanitized: "" };
  }

  const sanitized = sanitizeText(claim).trim();

  if (sanitized.length === 0) {
    return { valid: false, error: "Claim cannot be empty", sanitized: "" };
  }

  if (sanitized.length > maxLength) {
    return {
      valid: false,
      error: `Claim exceeds maximum length of ${maxLength} characters`,
      sanitized: sanitized.substring(0, maxLength),
    };
  }

  // Check for potential prompt injection patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts?)/i,
    /disregard\s+(your|the)\s+(instructions|system\s+prompt)/i,
    /system\s*:\s*you\s+are\s+now/i,
    /\[system\]\s*ignore/i,
    /<\|im_start\|>/,
    /<\|im_end\|>/,
    /new\s+instructions?\s*:/i,
    /override\s+(your|the)\s+(safety|guidelines|instructions)/i,
  ];

  for (const pattern of injectionPatterns) {
    if (pattern.test(sanitized)) {
      return {
        valid: false,
        error: "Claim contains potentially harmful content",
        sanitized: sanitized,
      };
    }
  }

  return { valid: true, sanitized };
}
