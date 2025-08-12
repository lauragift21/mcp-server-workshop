# Connect to a MCP Client

## 🎯 Overview

Now that your MCP server is deployed, let's connect it to a MCP Client so you can interact with your custom tools and resources through natural conversation. You can use Claude Desktop, but you can also use any other MCP Client.

## 📱 Claude Desktop Setup

### Step 1: Install Claude Desktop

If you haven't already:
1. Download Claude Desktop from [claude.ai/desktop](https://claude.ai/desktop)
2. Install and sign in with your Anthropic account
3. Complete the initial setup

### Step 2: Locate Configuration File

Claude Desktop stores MCP server configurations in a JSON file:

**macOS:**
```bash
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```bash
%APPDATA%/Claude/claude_desktop_config.json
```

**Linux:**
```bash
~/.config/Claude/claude_desktop_config.json
```

## ⚙️ Configuration

### Step 1: Create Configuration File

If the file doesn't exist, create it. Here's the basic structure:

```json
{
  "mcpServers": {
    "calculator": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8787/sse"  // or remote-mcp-server-authless.your-account.workers.dev/sse
      ]
    }
  }
}
```

### Step 2: Configure Your Remote MCP Server

For a server deployed on Cloudflare Workers, use this configuration:

```json
{
  "mcpServers": {
    "travel-planner": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-mcp-server.your-subdomain.workers.dev/sse"
      ]
    }
  }
}
```

### Step 3: Complete Configuration Example

Here's a full example with multiple servers:

```json
{
  "mcpServers": {
    "travel-planner": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://travel-planner.your-subdomain.workers.dev/sse"
      ]
    },
    "restaurant-reservation": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://restaurant-server.your-subdomain.workers.dev/sse"
      ]
    },
    "meeting-summary": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://meeting-server.your-subdomain.workers.dev/sse"
      ]
    }
  }
}
```

## 🔄 Restart Claude Desktop

After updating the configuration:
1. **Quit Claude Desktop completely** (not just close the window)
2. **Restart the application**
3. Wait for it to fully load

## ✅ Testing the Connection

### Step 1: Verify Connection

In Claude Desktop, start a new conversation and try:

```
Can you list the available tools from my MCP servers?
```

You should see Claude respond with information about your custom tools.

### Step 2: Test Your Use Case

Try using your specific tools. For example:

**Travel Planner:**
```
Help me plan a trip to Paris. Can you search for flights and hotels?
```

**Restaurant Reservation:**
```
Find me a restaurant in downtown for dinner tonight.

```

**Meeting Summary:**
```
Can you analyze this meeting transcript and extract the action items?
```

## Workers AI LLM Playground

You can also use the [Workers AI LLM Playground](https://cloudflare-ai-playground.com/) to connect to your MCP server.


> ## 🐛 Troubleshooting

### Common Issues

#### Issue: "MCP server not found"
**Symptoms:** Claude doesn't recognize your server
**Solutions:**
- Check the configuration file path
- Verify JSON syntax (use a JSON validator)
- Ensure Claude Desktop was fully restarted
- Check server name spelling

#### Issue: "Connection failed"
**Symptoms:** Claude can't connect to your server
**Solutions:**
- Verify your server URL is accessible
- Test the URL with curl or Postman
- Check CORS headers are set
- Ensure server is responding to POST requests

#### Issue: "Tools not working"
**Symptoms:** Tools are listed but fail when called
**Solutions:**
- Check server logs with `wrangler tail`
- Verify tool parameter validation
- Test tools with direct API calls
- Check error responses are properly formatted

---

👉 **[Continue to Submission →](./submission.md)**
