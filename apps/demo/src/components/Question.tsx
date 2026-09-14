import '../lib/askq-config';
import { AskQuestion } from '@askq/react';

/**
 * Island wrapper. Astro serialises island props as JSON, so a question is
 * passed by id and resolved from the registry on the client.
 */
export default function Question({ id }: { id: string }) {
  return <AskQuestion id={id} />;
}
