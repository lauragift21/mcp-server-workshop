import { SummaryOptions, DocumentSummary } from '../types'
import { env } from 'cloudflare:workers'

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
    const aiResult = await this.callAI(prompt)
    
    // If AI fails, use intelligent extractive summarization
    if (!aiResult) {
      return this.extractiveSummary(content, maxLength)
    }
    
    return aiResult
  }

  // Intelligent extractive summarization fallback
  private extractiveSummary(content: string, maxLength: number): string {
    const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20)
    const keywords = this.extractKeywords(content)
    
    // Score sentences based on keyword frequency and position
    const scoredSentences = sentences.map((sentence, index) => {
      let score = 0
      keywords.forEach(keyword => {
        if (sentence.toLowerCase().includes(keyword.toLowerCase())) score += 1
      })
      // Boost first and last sentences
      if (index < 3 || index > sentences.length - 3) score += 0.5
      return { sentence, score }
    })
    
    // Select top sentences within word limit
    const sorted = scoredSentences.sort((a, b) => b.score - a.score)
    const selected: string[] = []
    let wordCount = 0
    
    for (const item of sorted) {
      const words = item.sentence.split(/\s+/).length
      if (wordCount + words <= maxLength) {
        selected.push(item.sentence)
        wordCount += words
      }
    }
    
    return selected.join('. ') + '.'
  }

  private extractKeywords(content: string): string[] {
    const words = content.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4)
    
    const frequency: {[key: string]: number} = {}
    words.forEach(word => frequency[word] = (frequency[word] || 0) + 1)
    
    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([word]) => word)
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
      // Check if AI binding is available
      if (!env.AI) {
        console.warn('Cloudflare AI binding not available, using extractive fallback')
        return null
      }

      // Use Cloudflare Workers AI with proper message structure
      const response = await env.AI.run('@cf/meta/llama-2-7b-chat-int8', {
        messages: [
          {
            role: 'system',
            content: 'You are an expert document summarizer. Provide concise, structured summaries that capture key points, decisions, and action items. Focus on clarity and actionable insights.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000
      })

      // Extract response text
      if (response && response.response) {
        return response.response.trim()
      }

      console.warn('Unexpected AI response format:', response)
      return null

    } catch (error) {
      console.error('Error calling Cloudflare AI:', error)
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
