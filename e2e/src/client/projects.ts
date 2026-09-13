import type { Screen } from './screens';
import SMALL_SCREENS from '../project-small/client/screens';
import MEDIUM_SCREENS from '../project-medium/client/screens';
import LARGE_SCREENS from '../project-large/client/screens';
import EXTRA_LARGE_SCREENS from '../project-extra-large/client/screens';
import { SMALL_USERS } from '../project-small/client/users';
import { MEDIUM_USERS } from '../project-medium/client/users';
import { LARGE_USERS } from '../project-large/client/users';
import { EXTRA_LARGE_USERS } from '../project-extra-large/client/users';

export interface ProjectDefinition {
  readonly slug: string;
  readonly title: string;
  readonly users: readonly string[];
  readonly hasAnonymous: boolean;
  readonly screens: readonly Screen[];
}

export const PROJECTS: readonly ProjectDefinition[] = [
  { slug: 'small', title: 'Small: team notebook', users: SMALL_USERS, hasAnonymous: true, screens: SMALL_SCREENS },
  { slug: 'medium', title: 'Medium: marketing', users: MEDIUM_USERS, hasAnonymous: false, screens: MEDIUM_SCREENS },
  { slug: 'large', title: 'Large: light ERP', users: LARGE_USERS, hasAnonymous: false, screens: LARGE_SCREENS },
  { slug: 'extra-large', title: 'Extra large: multi-area platform', users: EXTRA_LARGE_USERS, hasAnonymous: true, screens: EXTRA_LARGE_SCREENS },
];

export function findProject(slug: string | undefined): ProjectDefinition | undefined {
  return PROJECTS.find((project) => project.slug === slug);
}
