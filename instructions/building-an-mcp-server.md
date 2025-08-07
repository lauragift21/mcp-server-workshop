# Building an MCP Server

In this section, you'll learn how to build your own MCP server using Cloudflare Workers.

## 🎯 Choose Your Use Case

We've prepared three complete MCP server examples that demonstrate different capabilities:

### 1. **Real-time Travel Planner**
- Claude connects to Google Calendar and travel APIs
- Checks flights, hotels, and calendar conflicts

### 2. **Restaurant Reservation**
- Claude connects to a booking platform like OpenTable
- Manages restaurant bookings and availability

### 3. **AI-Powered Meeting Summary**
- Claude summarizes notes and create jira tasks from Google docs
- Processes meeting transcripts and generates summaries

## 📚 Implementation Guides

Each use case includes a comprehensive README with step-by-step instructions:

- **[Real-time Travel Planner](../use-cases/travel-planner/README.md)** - Complete guide with API setup and deployment
- **[Restaurant Reservation](../use-cases/restaurant-reservation/README.md)** - Booking system implementation
- **[Meeting Summary](../use-cases/meeting-summary/README.md)** - AI-powered text processing

## 🚀 Getting Started

1. **Choose a use case** that interests you most
2. **Navigate to the use case folder** in your terminal
3. **Follow the README guide** for your chosen use case
4. **Deploy to Cloudflare Workers** using the provided instructions
5. **Connect to Claude** and start testing your MCP server

---

## Best Practices

### 🎯 Tool Design
**Focus on user goals, not API coverage.** Don't treat your MCP server as a wrapper around your full API schema. Instead, build tools that are optimized for specific user workflows and reliable outcomes.

- ✅ **Fewer, well-designed tools** often outperform many granular ones
- ✅ **Optimize for agents** with small context windows and tight latency budgets
- ✅ **Combine related operations** into single, powerful tools when it makes sense

### 🔒 Scoped Permissions
**Deploy focused servers with narrow permissions.** This reduces security risks and makes your system easier to manage and audit.

- ✅ **One server per domain** (e.g., separate servers for calendar, travel, finance)
- ✅ **Minimal required permissions** for each server's specific use case
- ✅ **Clear audit trails** of what each server can access

### 📝 Tool Descriptions
**Write detailed, clear parameter descriptions.** Help agents understand exactly how to use your tools correctly.

- ✅ **Expected values and formats** for each parameter
- ✅ **Behavioral constraints** and important limitations
- ✅ **Example usage patterns** in your descriptions
- ✅ **Error conditions** and how to handle them

### 🧪 Evaluation & Testing
**Use evaluation tests ('evals') to measure tool effectiveness.** This ensures your tools work reliably as your server evolves.

- ✅ **Test agent interactions** with your tools regularly
- ✅ **Run evals after updates** to catch regressions early
- ✅ **Track improvements** in tool usage over time
- ✅ **Validate real-world scenarios** your users will encounter

**Ready to build? Pick your use case and dive into the detailed guide!**

---

👉 **[Continue to Deploying Your MCP →](./deploying-your-mcp.md)**
