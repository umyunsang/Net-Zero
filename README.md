<div align="center">
  <img src="./docs/assets/wordmark.svg" width="360" alt="Net-Zero Thailand" />
</div>
<br/>

# 🌱 Net-Zero Thailand

[![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-Vite_PWA-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![NestJS](https://img.shields.io/badge/NestJS-Fastify-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17_%2F_PostGIS-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)

Net-Zero Thailand is an MVP platform that lets users log everyday low-carbon activities — taking the bus, recycling, and planting trees — and rewards them with voucher points, backed by a real API, state machines, PostgreSQL transactions, an idempotent ledger, RBAC, and full-stack calculation logic.

> **Note:** All data, identities, and provider integrations in this repository are **mock/synthetic — for demo purposes only**. See [Disclaimer](#️-disclaimer) below for the full scope.

## 🌟 Key Features

- **Activity logging** — Submit bus, recycling, and tree-planting activities with photo/GPS evidence via a responsive PWA
- **Review workflow** — Reviewer role checks submitted evidence through a real state machine before approval
- **CO2e calculation** — Versioned, source-referenced factor catalog with a fail-closed resolver (no factor/approval → no CO2e or points)
- **Voucher ledger** — Idempotent, transactional point accounting redeemable at demo merchants
- **Role-based access** — JWT auth with `user`, `reviewer`, `merchant`, and `admin` roles
- **Dashboards** — Consumer and operations views for tracking activity, points, and review status

## Tech Stack

- Node.js 24, TypeScript, pnpm
- Responsive React/Vite PWA
- Modular monolith NestJS/Fastify
- PostgreSQL 17/PostGIS and Graphile Worker
- S3-compatible object storage; MinIO for local development

## Project Structure

```
apps/
  api/       # NestJS/Fastify backend — auth, claims, evidence, rewards, community
  web/       # React/Vite PWA — consumer and operations UI
  worker/    # Graphile Worker background jobs
packages/
  domain/    # Core calculation logic (bus, carbon, claims, rewards)
  contracts/ # Shared API contracts/types
seed/        # Demo fixtures and approved factor data
migrations/  # Database migrations
```

## Getting Started

```sh
cp .env.example .env
pnpm install
docker compose up -d postgres minio
docker compose run --rm minio-init
pnpm demo:reset
pnpm dev
```

Web app: `http://localhost:5173`
API operational status: `http://localhost:3000/health/ready` (not a production-readiness gate)

`pnpm demo:reset` deterministically resets data and creates review fixtures for `bus`, `recycling`, and `tree` under the `mock_demo` scope without requiring real people, devices, or external providers.

Demo data commands are rejected unless `MOCK_DEMO_ENABLED=true`. Both resource scopes are `mock_demo`, the database/object storage/web URLs are loopback addresses, and the database contains a matching persistent `mock_demo` marker. `demo:reset` creates the marker only for a newly created database when all business tables are empty. `db:seed-demo` cannot create the marker itself.

The demo accounts use JWTs and real RBAC roles: `user`, `reviewer`, `merchant`, and `admin`.

Single-use demo QR tokens:

```text
DEMO-BIN-BKK-01:TOKEN-0001
DEMO-BIN-BKK-01:TOKEN-0002
DEMO-BIN-BKK-01:TOKEN-0003
```

## Disclaimer

The CO2e displayed is an **estimated CO2e value derived from TGO factors/methods with versioning**. The factors are only source-referenced candidate data, and mock approval is limited to the `mock_demo` scope for demo purposes only. This is not certification, endorsement, or support from TGO, carbon credits, or offsets. It does not claim fraud prevention or proof that a real activity occurred.

Identity data, evidence, timestamps, locations, and provider responses are all mock/synthetic/demo-only. There is no real connection to TGO, transport systems, AI, OIDC, stores, payments, or partner systems, and there is no deployment or claim of production readiness.

The factor catalog and resolver operate in fail-closed mode: if scope, labeling, provenance, or approval is incomplete, the system must not create CO2e or score values. Bus results are a heuristic of the MVP; recycling evidence refers to proof of material delivery, not proof that recycling succeeded; tree results are expected one-year sequestration estimates, not proof that the tree will survive.
