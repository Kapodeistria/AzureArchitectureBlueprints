/**
 * Local Timezone Timestamp Utility
 *
 * Provides timezone-aware timestamp formatting using the system's local timezone
 */

/**
 * Get current timestamp in local timezone (ISO 8601 format with timezone offset)
 * Example: 2025-09-29T22:30:45.123+02:00 (Zurich)
 */
export function getLocalTimestamp(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}.${ms}${sign}${hours}:${minutes}`;
}

/**
 * Get formatted timestamp for file names (no special characters)
 * Example: 2025-09-29T22-30-45
 */
export function getLocalTimestampForFilename(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}T${hour}-${minute}-${second}`;
}

/**
 * Get human-readable timestamp with timezone name
 * Example: 2025-09-29 22:30:45 CET
 */
export function getLocalTimestampReadable(): string {
  const now = new Date();
  const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzAbbr = now.toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const second = String(now.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}:${second} ${tzAbbr}`;
}

/**
 * Get timezone name
 * Example: Europe/Zurich
 */
export function getTimezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get timezone offset string
 * Example: +02:00
 */
export function getTimezoneOffset(): string {
  const now = new Date();
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const absOffset = Math.abs(offset);
  const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const minutes = String(absOffset % 60).padStart(2, '0');

  return `${sign}${hours}:${minutes}`;
}