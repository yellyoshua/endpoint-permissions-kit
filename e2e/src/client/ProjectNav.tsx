import { NavLink } from 'react-router-dom';
import { domainOf, type VisibleScreen } from './screens';

interface ProjectNavProps {
  readonly project: string;
  readonly screens: readonly VisibleScreen[];
}

function groupByDomain(screens: readonly VisibleScreen[]): ReadonlyMap<string, readonly VisibleScreen[]> {
  const groups = new Map<string, VisibleScreen[]>();
  for (const visible of screens) {
    const domain = domainOf(visible.screen);
    const group = groups.get(domain) ?? [];
    group.push(visible);
    groups.set(domain, group);
  }
  return groups;
}

export default function ProjectNav({ project, screens }: ProjectNavProps) {
  if (screens.length === 0) return <p>No screens available for this user.</p>;
  const groups = groupByDomain(screens);
  return (
    <nav aria-label="Project screens">
      {[...groups.entries()].map(([domain, domainScreens]) => (
        <section key={domain}>
          <h3>{domain}</h3>
          <ul>
            {domainScreens.map(({ screen, methods }) => (
              <li key={screen.path}>
                <NavLink to={`/${project}/${screen.path}`}>{screen.title}</NavLink>
                <small> ({methods.join(', ')})</small>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}
