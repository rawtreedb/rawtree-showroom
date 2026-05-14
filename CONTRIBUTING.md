# Contributing to RawTree Showroom

Thanks for your interest in contributing! This project showcases RawTree use cases with interactive dashboards and setup guides.

## Getting Started

```bash
git clone https://github.com/rawtreedb/rawtree-showroom.git
cd rawtree-showroom
npm install
npm run dev
```

## Development Workflow

1. Fork the repository
2. Create a feature branch from `main`
3. Make your changes
4. Run the dev server and verify your changes locally
5. Open a pull request against `main`

## Pull Request Process

- All PRs require at least one approval from a maintainer before merging
- PRs must target the `main` branch
- Keep changes focused — one feature or fix per PR
- Include a clear description of what changed and why

## Adding a New Use Case

See [docs/adding-a-dashboard.md](docs/adding-a-dashboard.md) for a step-by-step guide on adding a new use case to the showroom.

## Code Style

- This project uses Next.js with TypeScript
- UI components use [shadcn/ui](https://ui.shadcn.com/) with Tailwind CSS
- Run `npm run build` to check for type errors before submitting

## Reporting Issues

Use [GitHub Issues](https://github.com/rawtreedb/rawtree-showroom/issues) to report bugs or request features. Please use the provided templates.

## License

By contributing, you agree that your contributions will be licensed under the [Apache License 2.0](LICENSE).
