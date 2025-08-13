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
