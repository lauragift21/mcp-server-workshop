import { SummaryOptions, DocumentSummary } from '../types'

export class DocumentSummarizer {
  constructor() {}

  async summarizeDocument(content: string, options: SummaryOptions = {}): Promise<DocumentSummary> {
    const { maxLength = 500, format = 'structured', includeActionItems = true, includeKeyTopics = true } = options

    // Use LLM for intelligent summarization
    const summary = await this.generateAISummary(content, maxLength, format)
    const keyTopics = includeKeyTopics ? await this.extractAIKeyTopics(content) : []
    const actionItems = includeActionItems ? await this.extractAIActionItems(content) : []

    return {
      summary,
      keyTopics,
      actionItems,
      wordCount: summary.split(/\s+/).length,
      originalLength: content.length,
    }
  }

  private async generateAISummary(content: string, maxLength: number, format: string): Promise<string> {
    const prompt = this.buildSummaryPrompt(content, maxLength, format)
    return (await this.callAI(prompt)) || `Summary of document (${Math.round(content.length / 1000)}k characters)`
  }

  private async extractAIKeyTopics(content: string): Promise<string[]> {
    const prompt = `Extract 5-8 key topics from this document. Return only the topics as a comma-separated list:\n\n${content.substring(0, 2000)}...`

    const response = await this.callAI(prompt)
    if (response) {
      return response
        .split(',')
        .map((topic: string) => topic.trim())
        .filter((topic: string) => topic.length > 0)
        .slice(0, 8)
    }

    return []
  }

  private async extractAIActionItems(content: string): Promise<string[]> {
    const prompt = `Extract action items, tasks, and next steps from this document. Return as a numbered list:\n\n${content.substring(0, 2000)}...`

    const response = await this.callAI(prompt)
    if (response) {
      return response
        .split('\n')
        .filter((line: string) => line.match(/^\d+\./)) // Lines starting with numbers
        .map((line: string) => line.replace(/^\d+\.\s*/, '').trim())
        .filter((item: string) => item.length > 0)
        .slice(0, 5)
    }

    return []
  }

  // AI Helper Methods
  private buildSummaryPrompt(content: string, maxLength: number, format: string): string {
    return `Please summarize the following document in ${maxLength} words or less. Format: ${format}.

Focus on:
- Main points and key decisions
- Important discussions and outcomes
- Critical information and insights

Document content:
${content.substring(0, 3000)}...`
  }

  private async callAI(prompt: string): Promise<string | null> {
    try {
      // This would integrate with Cloudflare AI Workers or other AI services
      // For now, return null to use simple fallback
      return null
    } catch (error) {
      console.warn('AI call failed:', error)
      return null
    }
  }

  // Method to generate Jira-friendly task descriptions
  generateJiraTaskDescription(summary: DocumentSummary, originalDocUrl?: string): string {
    let description = `*Summary:*\n${summary.summary}\n\n`

    if (summary.keyTopics.length > 0) {
      description += `*Key Topics:*\n${summary.keyTopics.map((topic) => `• ${topic}`).join('\n')}\n\n`
    }

    if (summary.actionItems.length > 0) {
      description += `*Action Items:*\n${summary.actionItems.map((item) => `• ${item}`).join('\n')}\n\n`
    }

    if (originalDocUrl) {
      description += `*Original Document:* ${originalDocUrl}\n`
    }

    description += `\n_Generated from document summary (${summary.wordCount} words from ${Math.round(summary.originalLength / 1000)}k characters)_`

    return description
  }
}
