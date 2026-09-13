import { useContext } from 'react';
import { ProjectSessionContext, type ProjectSession } from './ProjectSession';

export default function useProjectSession(): ProjectSession {
  const session = useContext(ProjectSessionContext);
  if (session === undefined) throw new Error('useProjectSession requires a ProjectSessionContext provider');
  return session;
}
