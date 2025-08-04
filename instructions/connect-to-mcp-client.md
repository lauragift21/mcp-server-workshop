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
        "@modelcontextprotocol/server-fetch",
        "https://your-mcp-server.your-subdomain.workers.dev"
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
        "@modelcontextprotocol/server-fetch",
        "https://travel-planner.your-subdomain.workers.dev"
      ],
      "env": {
        "TRAVEL_API_KEY": "your-travel-api-key"
      }
    },
    "restaurant-reservation": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-fetch",
        "https://restaurant-server.your-subdomain.workers.dev"
      ]
    },
    "meeting-summary": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-fetch",
        "https://meeting-server.your-subdomain.workers.dev"
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
Find me a restaurant in downtown for dinner tonight and make a reservation.
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


## 🎨 Enhancing the Experience

### Custom Tool Descriptions

Make your tools more discoverable with clear descriptions:

```typescript
{
  name: "search_flights",
  description: "Search for flights between two cities with optional date and passenger preferences. Returns flight options with prices, times, and airlines.",
  inputSchema: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "Departure city (e.g., 'New York', 'NYC', 'JFK')"
      },
      to: {
        type: "string", 
        description: "Destination city (e.g., 'Paris', 'CDG')"
      },
      date: {
        type: "string",
        description: "Departure date in YYYY-MM-DD format (optional)"
      }
    },
    required: ["from", "to"]
  }
}
```

### Rich Resource Content

Provide detailed resource information:

```typescript
{
  uri: "travel://destinations/paris",
  name: "Paris Travel Guide",
  description: "Comprehensive travel information for Paris including attractions, restaurants, transportation, and local tips",
  mimeType: "text/markdown"
}
```

### Error Messages

Provide helpful error messages:

```typescript
if (!location) {
  return {
    jsonrpc: "2.0",
    id: request.id,
    error: {
      code: -32602,
      message: "Missing required parameter 'location'",
      data: {
        hint: "Try: 'search flights from New York to Paris'",
        availableLocations: ["New York", "Paris", "London", "Tokyo"]
      }
    }
  };
}
```

## 🎯 Best Practices

### Tool Design
- **Clear Names**: Use descriptive, action-oriented tool names
- **Good Descriptions**: Explain what the tool does and when to use it
- **Flexible Parameters**: Support various input formats
- **Helpful Errors**: Guide users when things go wrong

### Resource Organization
- **Logical URIs**: Use hierarchical, meaningful resource identifiers
- **Rich Metadata**: Provide detailed descriptions and MIME types
- **Fresh Content**: Keep dynamic resources up-to-date

### Performance
- **Fast Responses**: Aim for < 1 second response times
- **Efficient Caching**: Cache expensive operations
- **Graceful Degradation**: Handle external API failures

## 🎉 Success Indicators

You'll know everything is working when:
- [ ] Claude recognizes your MCP server
- [ ] Tools are listed and callable
- [ ] Resources are accessible
- [ ] Error messages are helpful
- [ ] Your use case works end-to-end

---

👉 **[Continue to Building a UI →](./building-a-ui.md)** *(Optional)*
