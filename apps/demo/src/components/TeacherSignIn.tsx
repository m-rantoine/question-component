import '../lib/askq-config';
import { TeacherLogin } from '@askq/react/dashboard';
import { LOGIN_ACTION } from '../lib/dashboard-links';

/** Island wrapper — the form itself is in the package. */
export default function TeacherSignIn() {
  return <TeacherLogin action={LOGIN_ACTION} />;
}
