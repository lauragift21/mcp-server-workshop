# Meeting Summary MCP Server

An MCP server for intelligent document summarization and Jira task creation, featuring **dual-mode AI integration** with Cloudflare Workers AI and advanced extractive fallback. Designed to work seamlessly with Claude and other AI assistants.

## 🎯 What You'll Build

A fully functional MCP server with **5 powerful tools** for document processing and task management:

### 📄 Document Processing Tools
- `summarize_document` - **AI-powered** text summarization with key topics and action items
- `validate_document_content` - Document analysis and processing readiness validation
- `create_jira_task_from_doc` - Create Jira tasks directly from document summaries

### 🎫 Jira Integration Tools  
- `list_jira_projects` - List all available Jira projects
- `get_jira_issue_types` - Get issue types for specific projects

## 📋 Prerequisites

Before you begin, ensure you have:

- **Jira Cloud instance** with API token access

## 🛠️ Step-by-Step Setup

### Step 1: Navigate to the Project Directory

Navigate to the project directory:

```bash
cd use-cases/meeting-summary
```

### Step 2: Install Dependencies & Copy Example Variables

```bash
npm install

cp .dev.vars.example .dev.vars
```

### Step 3: Configure Environment Variables

The document summarization works immediately with intelligent extractive processing! For enhanced AI-powered summaries, the system automatically uses Cloudflare Workers AI when available.

Update the `.dev.vars` file with your Jira credentials:

```
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your_jira_api_token

```

#### Setting up Jira API Token

1. Go to [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Click "Create API token"
3. Copy the token to your `.dev.vars` file

## 📁 Implementation Code

### Step 4: Main Server Implementation

The `src/index.ts` file is already configured:

```typescript
import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from './tools'

export class MyMCP extends McpAgent<Env, Record<string, never>, Props> {
  server = new McpServer({
    name: "Meeting Summary MCP",
    version: "1.0.0",
  });

  async init() {
    // Register all meeting summary tools using the tools directory
    registerAllTools(this.server)
  }
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
```

### Step 5: Dual-Mode AI Architecture

The system features a sophisticated **dual-mode AI integration** with automatic fallback:

#### **DocumentSummarizer Service** (`src/services/summarizer-service.ts`):

```typescript
export class DocumentSummarizer {
  async summarizeDocument(content: string, options: SummaryOptions = {}): Promise<DocumentSummary> {
    // Try AI first, fall back to extractive if unavailable
    const summary = await this.generateAISummary(content, maxLength, format)
    const keyTopics = includeKeyTopics ? await this.extractAIKeyTopics(content) : []
    const actionItems = includeActionItems ? await this.extractAIActionItems(content) : []

    return { summary, keyTopics, actionItems, wordCount, originalLength }
  }

  private async callAI(prompt: string): Promise<string | null> {
    try {
      // Use Cloudflare Workers AI when available
      if (!env.AI) {
        console.warn('AI binding not available, using extractive fallback')
        return null
      }

      const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        messages: [
          { role: 'system', content: 'Expert document summarizer...' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000
      })

      return response?.response?.trim() || null
    } catch (error) {
      console.error('AI call failed, using extractive fallback:', error)
      return null
    }
  }

  // Intelligent extractive fallback with sentence scoring
  private extractiveSummary(content: string, maxLength: number): string {
    const sentences = content.split(/[.!?]+/).filter(s => s.length > 20)
    const keywords = this.extractKeywords(content)
    
    // Score sentences by keyword frequency and position
    const scoredSentences = sentences.map((sentence, index) => {
      let score = 0
      keywords.forEach(keyword => {
        if (sentence.toLowerCase().includes(keyword.toLowerCase())) score += 1
      })
      if (index < 3 || index > sentences.length - 3) score += 0.5 // Boost intro/conclusion
      return { sentence, score }
    })
    
    // Select top sentences within word limit
    return this.selectTopSentences(scoredSentences, maxLength)
  }
}
```

#### **LocalFileService** (`src/services/local-file-service.ts`):

```typescript
export class LocalFileService {
  processTextContent(content: string, title: string = 'Document'): DocumentContent {
    const validation = this.validateContent(content)
    if (!validation.isValid) throw new Error(validation.error)

    return {
      title,
      content: this.cleanTextContent(content),
      wordCount: this.countWords(content)
    }
  }

  getDocumentStats(content: string) {
    return {
      wordCount: this.countWords(content),
      characterCount: content.length,
      paragraphCount: content.split(/\n\s*\n/).length,
      estimatedReadingTime: Math.ceil(this.countWords(content) / 200)
    }
  }
}
```

### Step 6: Enhanced MCP Tools

The `src/tools/local-file.ts` provides comprehensive document processing:

```typescript
import { LocalFileService } from '../services/local-file-service'
import { DocumentSummarizer } from '../services/summarizer-service'

export function registerDocumentTools(server: McpServer) {
  const fileService = new LocalFileService()
  const summarizerService = new DocumentSummarizer()

  // AI-powered document summarization tool
  server.tool(
    'summarize_document',
    'AI-powered text summarization with dual-mode operation (Cloudflare AI + extractive fallback)',
    {
      content: z.string().describe('Text content to summarize'),
      title: z.string().optional().describe('Document title (optional)'),
      maxLength: z.number().optional().describe('Maximum summary length in words (default: 500)'),
      format: z.enum(['bullet-points', 'paragraph', 'structured']).optional().describe('Summary format'),
      includeActionItems: z.boolean().optional().describe('Include action items (default: true)'),
      includeKeyTopics: z.boolean().optional().describe('Include key topics (default: true)'),
    },
    async ({ content, title, maxLength, format, includeActionItems, includeKeyTopics }) => {
      try {
        // Validate and process content
        const validation = fileService.validateContent(content)
        if (!validation.isValid) throw new Error(validation.error)

        const documentContent = fileService.processTextContent(content, title || 'Document')
        
        // Use dual-mode AI summarization
        const summary = await summarizerService.summarizeDocument(documentContent.content, {
          maxLength: maxLength || 500,
          format: format || 'structured',
          includeActionItems: includeActionItems !== false,
          includeKeyTopics: includeKeyTopics !== false,
        })

        // Format comprehensive response
        let response = `# Document Summary: ${documentContent.title}\n\n`
        response += `**Summary:**\n${summary.summary}\n\n`
        
        if (summary.keyTopics.length > 0) {
          response += `**Key Topics:**\n${summary.keyTopics.map(topic => `• ${topic}`).join('\n')}\n\n`
        }
        
        if (summary.actionItems.length > 0) {
          response += `**Action Items:**\n${summary.actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`
        }
        
        response += `**Document Stats:**\n• Original: ${summary.originalLength} characters\n• Summary: ${summary.wordCount} words\n• Word Count: ${documentContent.wordCount} words`

        return { content: [{ text: response, type: 'text' }] }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { content: [{ text: `Error: ${errorMessage}`, type: 'text' }], isError: true }
      }
    }
  )

  // Document validation and analysis tool
  server.tool(
    'validate_document_content',
    'Validate and analyze document content for processing readiness',
    {
      content: z.string().describe('Text content to validate'),
      title: z.string().optional().describe('Document title (optional)'),
    },
    async ({ content, title }) => {
      try {
        const validation = fileService.validateContent(content)
        if (!validation.isValid) {
          return { content: [{ text: `Validation failed: ${validation.error}`, type: 'text' }], isError: true }
        }

        const documentContent = fileService.processTextContent(content, title || 'Document')
        const stats = fileService.getDocumentStats(documentContent.content)

        const response = `# Document Validation Results\n\n` +
          `**Status:** ✅ Valid for processing\n\n` +
          `**Document Info:**\n` +
          `• Title: ${documentContent.title}\n` +
          `• Word Count: ${documentContent.wordCount} words\n` +
          `• Character Count: ${documentContent.content.length} characters\n` +
          `• Estimated Reading Time: ${stats.estimatedReadingTime} minutes\n` +
          `• Paragraph Count: ${stats.paragraphCount}\n\n` +
          `**Ready for:** AI summarization, Jira task creation, content analysis`

        return { content: [{ text: response, type: 'text' }] }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return { content: [{ text: `Error: ${errorMessage}`, type: 'text' }], isError: true }
      }
    }
  )
}
```

### Step 7: Jira Integration Tools

The `src/tools/jira.ts` creates tasks from document summaries:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { LocalFileService } from '../services/local-file-service'
import { JiraService } from '../services/jira-service'
import { DocumentSummarizer } from '../services/summarizer-service'
import { env } from 'cloudflare:workers'

/**
 * Registers Jira-related tools with the MCP server
 */
export function registerJiraTools(server: McpServer) {
  const fileService = new LocalFileService()
  const summarizerService = new DocumentSummarizer()

  const getJiraService = (): JiraService => {
    try {
      const jiraConfig = {
        baseUrl: env.JIRA_BASE_URL || '',
        email: env.JIRA_EMAIL || '',
        apiToken: env.JIRA_API_TOKEN || '',
      }

      if (!jiraConfig.baseUrl || !jiraConfig.email || !jiraConfig.apiToken) {
        throw new Error('Jira configuration is incomplete. Please set JIRA_BASE_URL, JIRA_EMAIL, and JIRA_API_TOKEN environment variables.')
      }

      return new JiraService(jiraConfig)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Jira configuration error'
      throw new Error(`Failed to initialize Jira service: ${message}`)
    }
  }

  // Tool to create Jira task from document summary
  server.tool(
    'create_jira_task_from_doc',
    'Create a Jira task with summary content from a document',
    {
      content: z.string().describe('Text content to summarize and create task from'),
      taskTitle: z.string().describe('Title for the Jira task'),
      projectKey: z.string().describe("Jira project key (e.g., 'PROJ')"),
      documentTitle: z.string().optional().describe('Document title (optional, defaults to "Document")'),
      maxSummaryLength: z.number().optional().describe('Maximum length of summary (default: 300)'),
      issueType: z.string().optional().describe('Issue type (default: Task)'),
      priority: z.string().optional().describe('Priority level (e.g., High, Medium, Low)'),
      assignee: z.string().optional().describe('Assignee account ID'),
      labels: z.array(z.string()).optional().describe('Labels to add to the task'),
    },
    async ({ content, taskTitle, projectKey, documentTitle, maxSummaryLength, issueType, priority, assignee, labels }) => {
      try {
        const jiraService = getJiraService()

        // Validate and process document content
        const validation = fileService.validateContent(content)
        if (!validation.isValid) {
          throw new Error(validation.error)
        }

        const documentContent = fileService.processTextContent(content, documentTitle || 'Document')

        if (!documentContent.content.trim()) {
          throw new Error('Document appears to be empty after processing')
        }

        const summary = await summarizerService.summarizeDocument(documentContent.content, {
          maxLength: maxSummaryLength || 300,
          format: 'structured',
          includeActionItems: true,
          includeKeyTopics: true,
        })

        // Create Jira task
        const description = summarizerService.generateJiraTaskDescription(summary, documentContent.title)

        const jiraIssue = await jiraService.createIssue({
          projectKey,
          summary: taskTitle,
          description,
          issueType: issueType || 'Task',
          priority,
          assignee,
          labels,
        })

        return {
          content: [
            {
              text: `# Jira Task Created Successfully\n\n**Task:** ${jiraIssue.key} - ${jiraIssue.summary}\n**Status:** ${jiraIssue.status}\n**Created:** ${new Date(jiraIssue.created).toLocaleString()}\n\n**Description:**\n${jiraIssue.description}\n\n**Jira Link:** ${env.JIRA_BASE_URL}/browse/${jiraIssue.key}`,
              type: 'text',
            },
          ],
        }
      } catch (error) {
        return {
          content: [{ text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`, type: 'text' }],
        }
      }
    },
  )

  // Tool to list Jira projects
  server.tool('list_jira_projects', 'List all available Jira projects', {}, async () => {
    try {
      const jiraService = getJiraService()
      const projects = await jiraService.listProjects()

      const result = `# Available Jira Projects\n\n${projects.map((p: { key: string; name: string; id: string }) => `**${p.key}** - ${p.name} (ID: ${p.id})`).join('\n')}`

      return {
        content: [{ text: result, type: 'text' }],
      }
    } catch (error) {
      return {
        content: [{ text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`, type: 'text' }],
      }
    }
  })

  // Tool to get Jira issue types for a project
  server.tool(
    'get_jira_issue_types',
    'Get available issue types for a specific Jira project',
    {
      projectKey: z.string().describe('Jira project key'),
    },
    async ({ projectKey }) => {
      try {
        const jiraService = getJiraService()
        const issueTypes = await jiraService.getIssueTypes(projectKey)

        const result = `# Issue Types for Project ${projectKey}\n\n${issueTypes.map((type: { name: string; description?: string }) => `**${type.name}** - ${type.description || 'No description'}`).join('\n')}`

        return {
          content: [{ text: result, type: 'text' }],
        }
      } catch (error) {
        return {
          content: [{ text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`, type: 'text' }],
        }
      }
    },
  )
}
```

### Step 7: Jira Integration Tools



## 🚀 Deployment

### Step 8: Deploy to Cloudflare Workers

```bash
# Generate TypeScript types (includes AI binding)
npm run cf-typegen

# Deploy the worker with AI integration
npm run deploy

# Your MCP server will be deployed to: `https://meeting-summary.<your-account>.workers.dev`
```

### Step 9: Set Environment Variables (Optional)

Configure Jira integration for task creation features:

```bash
# Set Jira environment variables (optional)
wrangler secret put JIRA_BASE_URL
wrangler secret put JIRA_EMAIL  
wrangler secret put JIRA_API_TOKEN

```

### Step 10: Verify AI Integration

Test the dual-mode operation:

```bash
# Check deployment status
wrangler tail meeting-summary

# The logs will show:
# ✅ "Using Cloudflare AI for summarization" (when AI is available)
# ⚠️  "AI binding not available, using extractive fallback" (fallback mode)
```

## 🔗 Connect to MCP Client

### Connect to Cloudflare AI Playground

1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed URL: `https://meeting-summarizer.<your-account>.workers.dev/sse`
3. Start using the document processing tools!

### Connect to Claude Desktop

1. Open Claude Desktop settings
2. Add your MCP server configuration:

```json
{
  "mcpServers": {
    "meeting-summary": {
      "command": "node",
      "args": [
        "path/to/mcp-client.js",
        "https://meeting-summary.<your-account>.workers.dev/sse"
      ]
    }
  }
}
```

3. Restart Claude Desktop

## 🎯 Available Tools

Your enhanced MCP server provides **5 powerful tools** with dual-mode AI integration:

### **📄 Document Processing Tools**
- **`summarize_document`**: **AI-powered** text summarization with Cloudflare Workers AI + extractive fallback
- **`validate_document_content`**: Document analysis, validation, and processing readiness assessment

### **🎫 Jira Integration Tools**
- **`create_jira_task_from_doc`**: Create Jira tasks directly from AI-generated document summaries
- **`list_jira_projects`**: List all available Jira projects for task creation
- **`get_jira_issue_types`**: Get issue types for specific Jira projects

## 💬 Example Usage

Try these commands with Claude:

### Document Summarization
```
"Please summarize this meeting content:

Team Standup - January 15, 2024

Attendees: Alice, Bob, Charlie

Alice: Completed user authentication feature, working on password reset
Bob: Fixed database performance issues, investigating slow queries
Charlie: Finished UI mockups, starting frontend implementation

Action Items:
- Alice: Deploy auth feature to staging by Friday
- Bob: Optimize database queries by end of week  
- Charlie: Complete login page by Tuesday

Next meeting: January 22, 2024"
```

### Jira Task Creation
```
"Create a Jira task in project DEMO from this document summary with title 'Weekly Standup Follow-up'"
```

### Project Management
```
"List all available Jira projects"
"What issue types are available for project DEMO?"
```

## 🔧 Customization

### Adding New Document Formats

Extend the `LocalFileService` to support different input formats:

```typescript
// Add URL processing
async processContentFromUrl(url: string): Promise<DocumentContent> {
  const response = await fetch(url)
  const content = await response.text()
  return this.processTextContent(content, this.extractTitleFromUrl(url))
}
```

### Enhanced Summarization

Modify the `DocumentSummarizer` service to add custom summarization logic:

```typescript
// Add custom summary formats
async summarizeDocument(content: string, options: SummaryOptions) {
  // Custom AI prompting and processing
  return {
    summary: processedSummary,
    keyTopics: extractedTopics,
    actionItems: identifiedActions
  }
}
```

## 🐛 Troubleshooting

### Common Issues

**Document processing errors:**
- Ensure content has at least 10 words for meaningful summarization
- Check that text content is properly formatted
- Verify content doesn't exceed 1MB size limit

**Jira integration issues:**
- Verify Jira credentials in `.dev.vars` file
- Check Jira base URL format (https://your-domain.atlassian.net)
- Ensure API token has proper permissions

**Deployment issues:**
- Run `npm run cf-typegen` before deployment
- Check Cloudflare account permissions
- Verify environment variables are set correctly

## 🎓 Learning Points

This MCP server demonstrates:

- **Simplified Authentication**: No complex OAuth flows required
- **Local File Processing**: Direct text input without external APIs
- **AI Integration**: Intelligent document analysis and summarization
- **Service Architecture**: Clean separation between tools and services
- **Error Handling**: Robust validation and error messages

## 📚 Additional Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Cloudflare MCP Documentation](https://developers.cloudflare.com/agents/model-context-protocol/)
- [Jira REST API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)


Congratulations! You've built a complete meeting summary MCP server with local text processing.