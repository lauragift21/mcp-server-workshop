import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { LocalFileService } from '../services/local-file-service'
import { DocumentSummarizer } from '../services/summarizer-service'

/**
 * Registers document processing tools with the MCP server
 * These tools handle local text file processing and summarization
 */
export function registerDocumentTools(server: McpServer) {
  const fileService = new LocalFileService()
  const summarizerService = new DocumentSummarizer()

  // Tool to summarize document content directly
  server.tool(
    'summarize_document',
    'Summarize text content from uploaded documents or direct text input with key topics and action items',
    {
      content: z.string().describe('Text content to summarize (can be from uploaded file or direct input)'),
      title: z.string().optional().describe('Document title (optional, defaults to "Document")'),
      maxLength: z.number().optional().describe('Maximum length of summary in words (default: 500)'),
      format: z.enum(['bullet-points', 'paragraph', 'structured']).optional().describe('Summary format (default: structured)'),
      includeActionItems: z.boolean().optional().describe('Include action items in summary (default: true)'),
      includeKeyTopics: z.boolean().optional().describe('Include key topics in summary (default: true)'),
    },
    async ({ content, title, maxLength, format, includeActionItems, includeKeyTopics }) => {
      try {
        // Validate content
        const validation = fileService.validateContent(content)
        if (!validation.isValid) {
          throw new Error(validation.error)
        }

        // Process document content
        const documentContent = fileService.processTextContent(content, title || 'Document')
        
        // Generate summary
        const summary = await summarizerService.summarizeDocument(documentContent.content, {
          maxLength: maxLength || 500,
          format: format || 'structured',
          includeActionItems: includeActionItems !== false,
          includeKeyTopics: includeKeyTopics !== false,
        })

        // Format response
        let response = `# Document Summary: ${documentContent.title}\n\n`
        response += `**Summary:**\n${summary.summary}\n\n`
        
        if (summary.keyTopics.length > 0) {
          response += `**Key Topics:**\n${summary.keyTopics.map(topic => `• ${topic}`).join('\n')}\n\n`
        }
        
        if (summary.actionItems.length > 0) {
          response += `**Action Items:**\n${summary.actionItems.map((item, i) => `${i + 1}. ${item}`).join('\n')}\n\n`
        }
        
        response += `**Document Stats:**\n• Original: ${summary.originalLength} characters\n• Summary: ${summary.wordCount} words\n• Word Count: ${documentContent.wordCount} words`

        return {
          content: [{ text: response, type: 'text' }],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        return {
          content: [{ text: `Error processing document: ${errorMessage}`, type: 'text' }],
          isError: true,
        }
      }
    }
  )

  // Tool to process and validate document content (utility tool)
  server.tool(
    'validate_document_content',
    'Validate and analyze document content for processing readiness',
    {
      content: z.string().describe('Text content to validate'),
      title: z.string().optional().describe('Document title (optional)'),
    },
    async ({ content, title }) => {
      try {
        // Validate content
        const validation = fileService.validateContent(content)
        if (!validation.isValid) {
          return {
            content: [{ text: `Validation failed: ${validation.error}`, type: 'text' }],
            isError: true,
          }
        }

        // Process and analyze content
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
          `**Ready for:** Summarization, Jira task creation, content analysis`

        return {
          content: [{ text: response, type: 'text' }],
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        return {
          content: [{ text: `Error validating document: ${errorMessage}`, type: 'text' }],
          isError: true,
        }
      }
    }
  )
}