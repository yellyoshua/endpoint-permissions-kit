# Security Policy

## Supported versions

| Version | Supported |
| --- | --- |
| 0.3.x | Yes |

Only the latest release line receives security fixes.

## Reporting a vulnerability

Report vulnerabilities privately through GitHub Security Advisories:

https://github.com/yellyoshua/endpoint-permissions-kit/security/advisories/new

Do not open public issues, pull requests or discussions for security problems. A public report gives attackers a head start before a fix is available.

Include in the report:

- The affected version.
- A minimal reproduction: role catalog, registrations, the `validate()` input and the observed versus expected `{ result, errors }`.
- The impact you believe it has (for example, an authorization bypass or a denial that should have been a grant).

## What to expect

- Acknowledgement of the report within 7 days.
- A fix or a mitigation plan communicated through the advisory, followed by a patch release and a `CHANGELOG.md` entry.
- Credit in the advisory if you want it.

## Scope

The library evaluates the roles and assignments your application passes to it. Bugs in how your application authenticates users, loads assignments or maps `validate()` errors to HTTP responses are outside this policy; incorrect resolution, incorrect field trimming, hooks that are skipped, or a `validate()` call that throws instead of returning `{ result, errors }` are in scope.
