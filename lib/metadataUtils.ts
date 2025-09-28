/**
 * Safely parses participant metadata with error handling
 * @param metadata - Raw metadata string from participant
 * @returns Parsed metadata object or empty object if parsing fails
 */
export function parseParticipantMetadata(metadata: string | undefined): Record<string, any> {
  if (!metadata) {
    return {};
  }

  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    console.warn('Failed to parse participant metadata:', error);
    return {};
  }
}

/**
 * Gets participant role from metadata with fallback logic
 * @param participant - LiveKit participant
 * @param localParticipant - Current user's participant
 * @param userRole - Current user's role
 * @returns Participant role string
 */
export function getParticipantRole(
  participant: any,
  localParticipant: any,
  userRole: string | null
): string {
  const metadata = parseParticipantMetadata(participant.metadata);
  return metadata.role || (participant === localParticipant ? userRole : 'student') || 'student';
}