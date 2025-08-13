/**
 * Type definitions for the Meeting Summarizer MCP Server
 */

export type Props = {
  name: string
  email: string
  googleApiKey: string
  jiraApiToken?: string
  jiraBaseUrl?: string
}

export interface DocumentContent {
  title: string
  content: string
  wordCount: number
}

export interface SummaryOptions {
  maxLength?: number
  format?: 'bullet-points' | 'paragraph' | 'structured'
  includeActionItems?: boolean
  includeKeyTopics?: boolean
}

export interface DocumentSummary {
  summary: string
  keyTopics: string[]
  actionItems: string[]
  wordCount: number
  originalLength: number
}

export interface JiraConfig {
  baseUrl: string
  email: string
  apiToken: string
}

export interface JiraIssue {
  id: string
  key: string
  summary: string
  description?: string
  status: string
  assignee?: string
  created: string
  updated: string
}

export interface CreateIssueRequest {
  projectKey: string
  summary: string
  description?: string
  issueType?: string
  assignee?: string
  priority?: string
  labels?: string[]
}
