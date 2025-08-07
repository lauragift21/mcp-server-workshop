# 🚀 Deploying Your MCP Server

In this section, you'll learn how to deploy your MCP server to Cloudflare Workers. To deploy your MCP server, run the following command:

### Deploy Command

```bash
# Deploy to Cloudflare Workers
npm run deploy
```

This command will:
1. Build your TypeScript code
2. Bundle dependencies
3. Upload to Cloudflare Workers
4. Configure Durable Objects
5. Provide you with a deployment URL

### Expected Output

```bash
⛅️ wrangler 3.x.x
-------------------

Total Upload: 150.23 KiB / gzip: 35.67 KiB
Uploaded your-mcp-server-name (2.34 sec)
Published your-mcp-server-name (6.78 sec)
  https://your-mcp-server-name.your-subdomain.workers.dev
Current Deployment ID: abc123def456
```

## Step 5: Verify Deployment

### Test Your Deployed Server

```bash
# Test the deployment URL
curl https://your-mcp-server-name.your-subdomain.workers.dev
```

## Step 6: Environment Variables (If Needed)

### Set Environment Variables

If your MCP server requires API keys or configuration:

```bash
# Set environment variables
wrangler secret put API_KEY
wrangler secret put DATABASE_URL
```

---

👉 **[Continue to Connect to Claude →](./connect-to-claude.md)**
