import { JiraConfig, JiraIssue, CreateIssueRequest } from '../types'

/**
 * Jira Service for API key authentication
 * 
 * This service provides methods to interact with Jira REST API using API token authentication.
 */
export class JiraService {
  private config: JiraConfig

  constructor(config: JiraConfig) {
    this.config = config
    
    if (!config.baseUrl || !config.email || !config.apiToken) {
      throw new Error('Jira configuration is incomplete. baseUrl, email, and apiToken are required.')
    }
  }

  /**
   * Get authentication headers for Jira API requests
   */
  private getAuthHeaders(): Record<string, string> {
    const auth = btoa(`${this.config.email}:${this.config.apiToken}`)
    return {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    }
  }

  /**
   * List all projects accessible to the user
   */
  async listProjects(): Promise<Array<{ key: string; name: string; id: string }>> {
    try {
      const response = await fetch(`${this.config.baseUrl}/rest/api/3/project`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`)
      }

      const projects = await response.json() as any[]
      return projects.map(project => ({
        key: project.key,
        name: project.name,
        id: project.id,
      }))
    } catch (error) {
      throw new Error(`Failed to list projects: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get issue types for a specific project
   */
  async getIssueTypes(projectKey: string): Promise<Array<{ id: string; name: string; description?: string }>> {
    try {
      const response = await fetch(
        `${this.config.baseUrl}/rest/api/3/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes`,
        {
          method: 'GET',
          headers: this.getAuthHeaders(),
        }
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch issue types: ${response.status} ${response.statusText}`)
      }

      const data = await response.json() as any
      const project = data.projects?.[0]
      
      if (!project) {
        throw new Error(`Project ${projectKey} not found or no permission`)
      }

      return project.issuetypes.map((issueType: any) => ({
        id: issueType.id,
        name: issueType.name,
        description: issueType.description,
      }))
    } catch (error) {
      throw new Error(`Failed to get issue types: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a new Jira issue
   */
  async createIssue(request: CreateIssueRequest): Promise<JiraIssue> {
    try {
      const issueData = {
        fields: {
          project: { key: request.projectKey },
          summary: request.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: request.description || '',
                  },
                ],
              },
            ],
          },
          issuetype: { name: request.issueType || 'Task' },
          ...(request.assignee && { assignee: { accountId: request.assignee } }),
          ...(request.priority && { priority: { name: request.priority } }),
          ...(request.labels && { labels: request.labels }),
        },
      }

      const response = await fetch(`${this.config.baseUrl}/rest/api/3/issue`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(issueData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Failed to create issue: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`)
      }

      const createdIssue = await response.json() as any
      
      return {
        id: createdIssue.id,
        key: createdIssue.key,
        summary: request.summary,
        description: request.description,
        status: 'Open',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
      }
    } catch (error) {
      throw new Error(`Failed to create Jira issue: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get issue details by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const response = await fetch(`${this.config.baseUrl}/rest/api/3/issue/${issueKey}`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch issue: ${response.status} ${response.statusText}`)
      }

      const issue = await response.json() as any
      
      return {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        description: this.extractDescription(issue.fields.description),
        status: issue.fields.status.name,
        assignee: issue.fields.assignee?.displayName,
        created: issue.fields.created,
        updated: issue.fields.updated,
      }
    } catch (error) {
      throw new Error(`Failed to get issue: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract plain text description from Jira's ADF format
   */
  private extractDescription(description: any): string {
    if (!description || !description.content) {
      return ''
    }

    let text = ''
    const extractText = (content: any[]): string => {
      let result = ''
      for (const item of content) {
        if (item.type === 'text') {
          result += item.text
        } else if (item.content) {
          result += extractText(item.content)
        }
      }
      return result
    }

    return extractText(description.content)
  }
}
