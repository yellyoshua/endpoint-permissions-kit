import { createBrowserRouter, Link } from 'react-router-dom';
import App from './App';
import { PROJECTS } from './projects';

function ProjectIndex() {
  return (
    <main>
      <h1>endpoint-permissions-kit e2e</h1>
      <ul>
        {PROJECTS.map((project) => (
          <li key={project.slug}>
            <Link to={`/${project.slug}`}>{project.title}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

export const router = createBrowserRouter([
  { path: '/', element: <ProjectIndex /> },
  { path: '/:project/*', element: <App /> },
]);
