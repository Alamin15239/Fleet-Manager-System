# Contributing to Fleet Manager System

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/fleet-manager-system.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Test your changes: `npm test`
6. Commit your changes: `git commit -m 'Add some feature'`
7. Push to the branch: `git push origin feature/your-feature-name`
8. Open a Pull Request

## Development Setup

```bash
# Install dependencies
npm install

# Start Docker services
npm run docker:up

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

## Code Standards

### TypeScript
- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types
- Use proper type definitions

### Code Style
- Follow existing code style
- Use ESLint: `npm run lint`
- Format code before committing
- Write meaningful variable names

### Testing
- Write tests for new features
- Maintain test coverage above 80%
- Run tests before committing: `npm test`
- Test edge cases

### Commits
- Use conventional commit messages
- Format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- Example: `feat(trucks): add bulk import feature`

## Pull Request Process

1. Update documentation if needed
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md
5. Request review from maintainers
6. Address review feedback
7. Squash commits if requested

## Code Review Guidelines

- Be respectful and constructive
- Focus on code, not the person
- Explain reasoning for suggestions
- Approve when satisfied

## Bug Reports

Include:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Environment details

## Feature Requests

Include:
- Clear use case
- Expected behavior
- Mockups if applicable
- Potential implementation approach

## Questions?

- Open a discussion on GitHub
- Join our Discord community
- Email: support@fleetmanager.com

Thank you for contributing!
