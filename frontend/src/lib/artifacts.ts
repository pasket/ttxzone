import type { ArtifactKind, InjectArtifact } from './types'

/** The simulated artifacts an inject can be drawn as, in picker order. */
export const ARTIFACT_KINDS: ArtifactKind[] = [
  'email',
  'press_release',
  'social_post',
  'chat_message',
]

export const ARTIFACT_LABEL_KEYS = {
  email: 'artifacts.kinds.email',
  press_release: 'artifacts.kinds.press_release',
  social_post: 'artifacts.kinds.social_post',
  chat_message: 'artifacts.kinds.chat_message',
} as const satisfies Record<ArtifactKind, string>

/** A new artifact of `kind`, its sender prefilled from the inject's
 * sender (the simulated actor), keeping what was already typed. */
export function newArtifact(
  kind: ArtifactKind,
  previous: InjectArtifact | null,
  senderName: string,
): InjectArtifact {
  return {
    kind,
    sender: previous?.sender || senderName,
    sender_address: previous?.sender_address ?? '',
    recipient: previous?.recipient ?? '',
    subject: previous?.subject ?? '',
    timestamp: previous?.timestamp ?? '',
    location: previous?.location ?? '',
  }
}
