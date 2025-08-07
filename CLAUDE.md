# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development Commands
- `npm run dev` or `npm start` - Start development server with Wrangler
- `npm run format` - Format code using Biome
- `npm run lint:fix` - Lint and auto-fix issues using Biome
- `npm run type-check` - Run TypeScript type checking
- `npm run deploy` - Deploy to Cloudflare Workers

### Other Commands
- `npm run cf-typegen` - Generate Cloudflare Worker types

## Repository Structure

This is an MCP (Model Context Protocol) server workshop repository containing three example use cases:

- `use-cases/travel-planner/` - Real-time travel planning with calendar integration, flight and hotel search/booking
- `use-cases/meeting-summary/` - AI-powered meeting summarization and task creation from Google Docs
- `use-cases/restaurant-reservation/` - Restaurant booking platform integration

Each use case is a complete MCP server built with:
- **Cloudflare Workers** for serverless deployment
- **@modelcontextprotocol/sdk** for MCP server implementation
- **agents** library for MCP agent creation
- **Zod** for schema validation
- **TypeScript** for type safety
- **Biome** for linting and formatting

## MCP Server Architecture

MCP servers extend `McpAgent` class and define:

1. **Server Configuration** - Name, version in `McpServer` constructor
2. **Tool Registration** - Using `this.server.tool()` with Zod schemas for validation
3. **Request Routing** - Handler functions for `/sse`, `/mcp` endpoints

### Tool Structure
Tools are defined with:
- Name and description
- Zod input schema for parameter validation  
- Async handler function returning MCP content format

### Deployment Architecture
- Uses Cloudflare Durable Objects for state management
- SSE (Server-Sent Events) endpoint for real-time communication
- Standard MCP endpoint for protocol compliance

## Key Dependencies

- `@modelcontextprotocol/sdk` - Core MCP functionality
- `agents` - MCP agent framework
- `zod` - Runtime type validation
- `googleapis` - Google APIs integration (travel-planner only)

## Configuration Files

- `wrangler.jsonc` - Cloudflare Workers configuration with Durable Objects bindings
- `biome.json` - Code formatting/linting rules (4-space indentation, 100 char line width)
- `tsconfig.json` - TypeScript configuration

## Environment Variables

Travel planner requires Google OAuth credentials:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET` 
- `GOOGLE_REDIRECT_URI`

Store sensitive values as Cloudflare Workers secrets, not in wrangler.jsonc vars section.