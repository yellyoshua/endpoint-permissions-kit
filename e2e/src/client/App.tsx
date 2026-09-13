import { useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';
import { apiFetch } from './api';
import ErrorNotice from './ErrorNotice';
import Loading from './Loading';
import ProjectNav from './ProjectNav';
import { ProjectSessionContext, createProjectSession } from './ProjectSession';
import UserSelector from './UserSelector';
import { findProject, type ProjectDefinition } from './projects';
import { visibleScreens } from './screens';
import useApiQuery from './useApiQuery';
import type { MeResponse } from '../server/meRoute';

interface ProjectShellProps {
  readonly project: ProjectDefinition;
  readonly userId: string | undefined;
}

function ProjectShell({ project, userId }: ProjectShellProps) {
  const me = useApiQuery<MeResponse>(() => apiFetch({ project: project.slug, userId, path: '/me' }), [project.slug, userId]);
  if (me.state.status === 'loading') return <Loading />;
  if (me.state.status === 'error') return <ErrorNotice code={me.state.code} message={me.state.message} />;
  const session = createProjectSession(project.slug, userId, me.state.data);
  const screens = visibleScreens(project.screens, me.state.data.role, me.state.data.access);
  return (
    <ProjectSessionContext.Provider value={session}>
      <p>
        Signed in as <strong>{me.state.data.user}</strong> with role <strong>{me.state.data.role}</strong>
      </p>
      <div className="layout">
        <ProjectNav project={project.slug} screens={screens} />
        <main>
          <Routes>
            <Route index element={<p>Select a screen from the navigation.</p>} />
            {screens.map(({ screen }) => (
              <Route key={screen.path} path={screen.path} element={<screen.Component />} />
            ))}
            <Route path="*" element={<p>This screen is not available for the current user.</p>} />
          </Routes>
        </main>
      </div>
    </ProjectSessionContext.Provider>
  );
}

export default function App() {
  const { project: slug } = useParams();
  const project = findProject(slug);
  const [userId, setUserId] = useState<string | undefined>(project?.hasAnonymous ? undefined : project?.users[0]);
  if (project === undefined) return <p>Unknown project. <Link to="/">Back to the index</Link></p>;
  return (
    <>
      <header>
        <h1>{project.title}</h1>
        <Link to="/">All projects</Link>
        <UserSelector project={project} userId={userId} onChange={setUserId} />
      </header>
      <ProjectShell project={project} userId={userId} />
    </>
  );
}
