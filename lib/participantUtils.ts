import { Participant, ParticipantKind } from 'livekit-client';

/**
 * Determines if a participant is an agent (bot) that should be filtered out from the UI.
 * Agents include translation services, recording bots, and other automated participants.
 */
export function isAgentParticipant(participant: Participant): boolean {
  // Check for official ParticipantKind.AGENT
  if (participant.kind === ParticipantKind.AGENT) {
    return true;
  }

  // Check for string variants of agent kind
  if (
    typeof participant.kind === 'string' &&
    (participant.kind === 'agent' || participant.kind === 'AGENT')
  ) {
    return true;
  }

  // Check participant name for agent patterns
  if (participant.name && participant.name.toLowerCase().includes('agent')) {
    return true;
  }

  // Check participant identity for agent/bot patterns
  if (participant.identity) {
    const identity = participant.identity.toLowerCase();
    if (identity.includes('agent') || identity.includes('bot')) {
      return true;
    }
  }

  return false;
}
