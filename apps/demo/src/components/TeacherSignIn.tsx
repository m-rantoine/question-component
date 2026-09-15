import '../lib/askq-config';
import { TeacherLogin } from '@askq/react/dashboard';

/** Island wrapper — the form itself is in the package. */
export default function TeacherSignIn() {
  return <TeacherLogin action="/api/teacher/login" />;
}
