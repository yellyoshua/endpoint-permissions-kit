import { useId } from 'react';
import type { ProjectDefinition } from './projects';

export const ANONYMOUS_OPTION = '';

interface UserSelectorProps {
  readonly project: ProjectDefinition;
  readonly userId: string | undefined;
  readonly onChange: (userId: string | undefined) => void;
}

export default function UserSelector({ project, userId, onChange }: UserSelectorProps) {
  const selectId = useId();
  return (
    <div className="field">
      <label htmlFor={selectId}>Simulated user</label>
      <select
        id={selectId}
        name="user"
        value={userId ?? ANONYMOUS_OPTION}
        onChange={(event) => onChange(event.target.value === ANONYMOUS_OPTION ? undefined : event.target.value)}
      >
        {project.hasAnonymous && <option value={ANONYMOUS_OPTION}>anonymous (no header)</option>}
        {project.users.map((id) => (
          <option key={id} value={id}>{id}</option>
        ))}
      </select>
    </div>
  );
}
