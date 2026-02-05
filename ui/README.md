# MiniCluster UI

Modern dashboard interface for the MiniCluster service management platform.

## Overview

MiniCluster UI provides a real-time web interface to manage and monitor your applications and services. Built with React 19, React Router 7, and TailwindCSS.

## Features

- **Dashboard** - Real-time system metrics with CPU, memory, disk, and network charts
- **Applications** - Organize services into logical application groups
- **Services** - Start, stop, restart services with live logs
- **System Monitor** - Task manager view showing all running processes
- **File Explorer** - Browse and edit files on the server
- **Terminal** - Full PTY terminal access
- **Reverse Proxy** - Configure routing rules for services
- **Environments** - Manage environment variables and configurations

## Tech Stack

- **React 19** - Latest React with concurrent features
- **React Router 7** - File-based routing with SSR support
- **TailwindCSS 4** - Utility-first styling
- **TanStack Query** - Server state management with caching
- **Recharts** - Beautiful responsive charts
- **SignalR** - Real-time WebSocket communication
- **Monaco Editor** - Code editing capabilities
- **xterm.js** - Terminal emulation

## Getting Started

### Prerequisites

- Node.js 20+
- MiniCluster API server running (default: http://localhost:5147)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

The UI will be available at `http://localhost:5173`

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
app/
├── components/     # Reusable UI components
├── context/        # React contexts (Auth, SignalR, etc.)
├── hooks/          # Custom React hooks
├── routes/         # Page components (file-based routing)
├── services/       # API service modules
├── types/          # TypeScript type definitions
└── utils/          # Utility functions
```

## Key Routes

| Route | Description |
|-------|-------------|
| `/` | Dashboard with system metrics |
| `/apps` | Applications management |
| `/services` | All services list |
| `/dashboard/:app/:service?` | Service logs and details |
| `/monitor` | System process monitor |
| `/explorer` | Server file browser |
| `/terminal` | Interactive terminal |
| `/proxy` | Reverse proxy configuration |
| `/environments` | Environment variables |
| `/settings` | Application settings |

## Environment Variables

Create a `.env` file for custom configuration:

```env
VITE_API_URL=http://localhost:5147
```

## Docker Deployment

```bash
docker build -t minicluster-ui .
docker run -p 3000:3000 minicluster-ui
```

## License

Copyright © 2024-2026 Innovatek. All rights reserved.
