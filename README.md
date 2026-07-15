# LedgerX

LedgerX is a comprehensive Business Management Suite designed to streamline operations, featuring Point of Sale (POS), Customer Relationship Management (CRM), Inventory Management, Kanban-style workflows, and extensive transaction analytics.

## Features

- **Point of Sale (POS)**: Robust checkout panel and delivery challan management.
- **CRM**: Detailed customer profiles, interaction tracking, and list management.
- **Inventory Management**: Real-time stock tracking, automated alerts, and adjustment forms.
- **Kanban Board**: Visual job intake and progress tracking.
- **Transactions & Billing**: Statement of accounts and deep financial dashboards.
- **Analytics**: Business insights and comprehensive data visualization.
- **Shared Firebase Ecosystem**: Unified data models across workspaces.

## Project Structure

This project is a monorepo utilizing a modern web stack.

- `apps/web`: The main frontend application (React, Vite, TailwindCSS).
- `apps/api`: Backend services and API endpoints.
- `packages/firebase-shared`: Shared Firebase logic, schemas, and configurations.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://npmjs.com/) (v9 or higher)
- Firebase Account

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/skullxcode/LedgerX.git
   cd LedgerX
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Copy the example environment files and fill in your details:
   ```bash
   cp .env.example .env.local
   cp apps/web/.env.example apps/web/.env
   ```

4. **Start the Development Server:**
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev`: Starts the development servers for the web app and APIs.
- `npm run build`: Compiles the workspaces for production.
- `npm run lint`: Lints the codebase using ESLint.

## Technologies

- **Frontend**: React, TypeScript, Vite, TailwindCSS
- **Backend/Database**: Firebase, Firestore
- **Linting/Formatting**: ESLint, Prettier, oxlint

## License

This project is licensed under the MIT License.
