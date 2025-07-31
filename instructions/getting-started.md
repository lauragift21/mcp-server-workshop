# 🛠️ Getting Started

Welcome! In this section, you'll set up your local environment and prepare to build your own MCP server using Cloudflare Workers.

## 📋 Prerequisites

Before we begin, make sure you have the following:

### ✅ Required

* **Node.js v18+** – [Download](https://nodejs.org/)
* **Cloudflare Account** – [Sign up](https://dash.cloudflare.com/sign-up)
* **Code Editor** – VS Code recommended
* **Terminal / Command Line** access

### 🧰 Recommended

* [**Claude Desktop**](https://claude.ai/desktop) – for testing mcp server
* [**Cloudflare AI Playground**](https://cloudflare-ai-playground.com/) – for testing mcp server

---

## ⚙️ Environment Setup

### 1️⃣ Check Node.js & npm

```bash
node --version
npm --version
```

Ensure you see version 18 or higher.

---

### 2️⃣ Install Wrangler CLI

Wrangler is Cloudflare’s CLI tool for building and deploying Workers.

```bash
npm install -g wrangler
wrangler --version
```

---

### 3️⃣ Login to Cloudflare

```bash
wrangler login
```

This will open a browser window for authentication. Complete the login to proceed.

---

### 4️⃣ Clone the Workshop Repo

```bash
git clone https://github.com/lauragift21/mcp-server-workshop.git
cd mcp-server-workshop
```

---

## 🧪 Project Setup

### 1️⃣ Choose a Use Case

Navigate into one of the use case folders:

```bash
cd use-cases/travel-planner/mcp-server
# or
cd use-cases/restaurant-reservation/mcp-server
# or
cd use-cases/meeting-summary/mcp-server
```

---

### 2️⃣ Install Dependencies

```bash
npm install
```

---

### 3️⃣ Review Project Structure

```
mcp-server/
├── package.json         # Project dependencies and scripts
├── wrangler.toml        # Cloudflare Worker configuration
├── tsconfig.json        # TypeScript configuration
├── src/
│   ├── index.ts         # Cloudflare Worker entry point
│   ├── server.ts        # MCP logic implementation
│   ├── tools/           # Individual tools
│   ├── resources/       # Resource handlers
│   └── types.ts         # Type declarations
└── README.md            # Use case guide
```

---

## 🔄 Local Development

### Start Development Server

```bash
npm run dev
```

This starts the Worker at: `http://localhost:8787`

---

## 🔐 Environment Variables

Create a `.env` file in your project root:

```env
ENVIRONMENT=development
DEBUG=true

# Optional: API keys for integrations
# WEATHER_API_KEY=your-key
# JIRA_TOKEN=your-token
```

> ⚠️ **Do not commit `.env` files** — always use `.gitignore`.
---

## 🎯 Next Steps

Once your environment is set up and you can run the test client successfully, you're ready to start building!

### What's Next?

- **Understand Your Use Case**: Read the README in your chosen use case directory
- **Implement Tools**: Add the specific tools your use case needs
- **Add Resources**: Create resources that provide data to the AI

---

**Environment ready? Let's start building your MCP server!**

👉 **[Continue to Deploying Your MCP →](./deploying-your-mcp.md)**
