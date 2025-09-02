# README

Private, local-first system to manage personal projects.
It's basically a visual candy and convenience layer for managing YAML files.

## Getting Started

No env file is required by default. The app reads your data from the
`workspace-data/` directory in this repo. You can override the data
location via environment variables (see below).

If you want to customize env variables copy the `.env.example` in side `viewer`
directory as `.env` and fill in wanted values and remove unneeded to keep
them as default.

## Development

Run `docker compose -f viewer/docker-compose.yml up --build` to start
development with hot reloading.
