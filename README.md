[![Try Free](https://img.shields.io/badge/Try%20Free-FalkorDB%20Cloud-FF8101?labelColor=FDE900&link=https://app.falkordb.cloud)](https://app.falkordb.cloud)
[![Dockerhub](https://img.shields.io/docker/pulls/falkordb/queryweaver?label=Docker)](https://hub.docker.com/r/falkordb/queryweaver/)
[![Discord](https://img.shields.io/discord/1146782921294884966?style=flat-square)](https://discord.com/invite/6M4QwDXn2w)
[![Workflow](https://github.com/FalkorDB/QueryWeaver/actions/workflows/pylint.yml/badge.svg?branch=main)](https://github.com/FalkorDB/QueryWeaver/actions/workflows/pylint.yml)

# QueryWeaver

QueryWeaver is an open-source Text2SQL tool that converts plain-English questions into SQL using graph-powered schema understanding. It helps you ask databases natural-language questions and returns SQL and results.

![Screenshot](https://github.com/user-attachments/assets/a0be7bbd-0c99-4399-a302-2b9f7b419dd2)

TL;DR
- Try quickly with Docker: `docker run -p 5000:5000 -it falkordb/queryweaver`
- Develop locally: see "Development" section below

## Quick start — Docker (recommended for evaluation)

Run the official image locally (no local Python or Node required):

```bash
docker run -p 5000:5000 -it falkordb/queryweaver
```

Open: http://localhost:5000

### Prefer using a .env file (recommended)

Create a local `.env` by copying `.env.example` and pass it to Docker. This is the simplest way to provide all required configuration:

```bash
cp .env.example .env
# edit .env to set your values, then:
docker run -p 5000:5000 --env-file .env falkordb/queryweaver
```

### Or pass individual environment variables

If you prefer to pass variables on the command line, use `-e` flags (less convenient for many variables):

```bash
docker run -p 5000:5000 -it \
  -e FASTAPI_SECRET_KEY=your_super_secret_key_here \
  -e GOOGLE_CLIENT_ID=your_google_client_id \
  -e GOOGLE_CLIENT_SECRET=your_google_client_secret \
  -e GITHUB_CLIENT_ID=your_github_client_id \
  -e GITHUB_CLIENT_SECRET=your_github_client_secret \
  -e AZURE_API_KEY=your_azure_api_key \
  falkordb/queryweaver
```

For a full list of configuration options, consult `.env.example`.

## Development

Follow these steps to run and develop QueryWeaver from source.

### Prerequisites

- Python 3.12+
- pipenv
- A FalkorDB instance (local or remote)
- Node.js and npm (for the TypeScript frontend)

### Install and configure

Quickstart (recommended for development):

```bash
# Clone the repo
git clone https://github.com/FalkorDB/QueryWeaver.git
cd QueryWeaver

# Install dependencies (backend + frontend) and start the dev server
make install
make run-dev
```

If you prefer to set up manually or need a custom environment, use Pipenv:

```bash
# Install Python (backend) and frontend dependencies
pipenv sync --dev

# Create a local environment file
cp .env.example .env
# Edit .env with your values
```

### Run the app locally

```bash
pipenv run uvicorn api.index:app --host 0.0.0.0 --port 5000 --reload
```

The server will be available at http://localhost:5000

Alternatively, the repository provides Make targets for running the app:

```bash
make run-dev   # development server (reload, debug-friendly)
make run-prod  # production mode (ensure frontend build if needed)
```

### Frontend build (when needed)

The frontend is a TypeScript app in `app/`. Build before production runs or after frontend changes:

```bash
make install       # installs backend and frontend deps
make build-prod    # builds the frontend into app/public/js/app.js

# or manually
cd app
npm ci
npm run build
```

### OAuth configuration

QueryWeaver supports Google and GitHub OAuth. Create OAuth credentials for each provider and paste the client IDs/secrets into your `.env` file.

- Google: set authorized origin and callback `http://localhost:5000/login/google/authorized`
- GitHub: set homepage and callback `http://localhost:5000/login/github/authorized`

## Testing

> Quick note: many tests require FalkorDB to be available. Use the included helper to run a test DB in Docker if needed.

### Prerequisites

- Install dev dependencies: `pipenv sync --dev`
- Start FalkorDB (see `make docker-falkordb`)
- Install Playwright browsers: `pipenv run playwright install`

### Quick commands

Recommended: prepare the development/test environment using the Make helper (installs dependencies and Playwright browsers):

```bash
# Prepare development/test environment (installs deps and Playwright browsers)
make setup-dev
```

Alternatively, you can run the E2E-specific setup script and then run tests manually:

```bash
# Prepare E2E test environment (installs browsers and other setup)
./setup_e2e_tests.sh

# Run all tests
make test

# Run unit tests only (faster)
make test-unit

# Run E2E tests (headless)
make test-e2e

# Run E2E tests with a visible browser for debugging
make test-e2e-headed
```

### Test types

- Unit tests: focus on individual modules and utilities. Run with `make test-unit` or `pipenv run pytest tests/ -k "not e2e"`.
- End-to-end (E2E) tests: run via Playwright and exercise UI flows, OAuth, file uploads, schema processing, chat queries, and API endpoints. Use `make test-e2e`.

See `tests/e2e/README.md` for full E2E test instructions.

### CI/CD

GitHub Actions run unit and E2E tests on pushes and pull requests. Failures capture screenshots and artifacts for debugging.

## Troubleshooting

- FalkorDB connection issues: start the DB helper `make docker-falkordb` or check network/host settings.
- Playwright/browser failures: install browsers with `pipenv run playwright install` and ensure system deps are present.
- Missing environment variables: copy `.env.example` and fill required values.

## Project layout (high level)

- `api/` – FastAPI backend
- `app/` – TypeScript frontend
- `tests/` – unit and E2E tests


## License

Licensed under the GNU Affero General Public License (AGPL). See [LICENSE](LICENSE.txt).

Copyright FalkorDB Ltd. 2025

