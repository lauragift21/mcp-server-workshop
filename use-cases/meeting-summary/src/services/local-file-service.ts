/**
 * Local File Service for Text Document Processing
 * 
 * This service provides methods to process local text files instead of using Google Docs API.
 * Users can upload text files or provide text content directly for summarization.
 */

export interface DocumentContent {
  title: string
  content: string
  wordCount: number
}

export class LocalFileService {
  constructor() {
    // No authentication needed for local file processing
  }

  /**
   * Process text content directly (for copy-paste scenarios)
   */
  processTextContent(content: string, title: string = 'Uploaded Document'): DocumentContent {
    if (!content || content.trim().length === 0) {
      throw new Error('Document content cannot be empty')
    }

    const cleanContent = this.cleanTextContent(content)
    const wordCount = this.countWords(cleanContent)

    return {
      title,
      content: cleanContent,
      wordCount
    }
  }

  /**
   * Process uploaded file content (simulated for Cloudflare Workers environment)
   * In a real implementation, this would handle file uploads via FormData
   */
  async processUploadedFile(fileContent: string, fileName: string = 'uploaded-document.txt'): Promise<DocumentContent> {
    if (!fileContent || fileContent.trim().length === 0) {
      throw new Error('Uploaded file appears to be empty')
    }

    // Extract title from filename (remove extension)
    const title = fileName.replace(/\.[^/.]+$/, '') || 'Uploaded Document'
    
    return this.processTextContent(fileContent, title)
  }

  /**
   * Process content from a URL (for cases where content is provided via URL)
   */
  async processContentFromUrl(url: string): Promise<DocumentContent> {
    try {
      const response = await fetch(url)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch content from URL: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      
      if (!contentType.includes('text/')) {
        throw new Error('URL must point to a text file or plain text content')
      }

      const content = await response.text()
      const title = this.extractTitleFromUrl(url)
      
      return this.processTextContent(content, title)
    } catch (error) {
      throw new Error(`Failed to process content from URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Clean and normalize text content
   */
  private cleanTextContent(content: string): string {
    return content
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n\s*\n/g, '\n\n') // Normalize multiple newlines
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
  }

  /**
   * Count words in text content
   */
  private countWords(content: string): number {
    return content
      .split(/\s+/)
      .filter(word => word.length > 0)
      .length
  }

  /**
   * Extract a title from a URL
   */
  private extractTitleFromUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname
      const filename = pathname.split('/').pop() || 'Document from URL'
      
      // Remove file extension and decode URI component
      return decodeURIComponent(filename.replace(/\.[^/.]+$/, '')) || 'Document from URL'
    } catch {
      return 'Document from URL'
    }
  }

  /**
   * Validate text content for processing
   */
  validateContent(content: string): { isValid: boolean; error?: string } {
    if (!content || content.trim().length === 0) {
      return { isValid: false, error: 'Content cannot be empty' }
    }

    if (content.length > 1000000) { // 1MB limit
      return { isValid: false, error: 'Content is too large (max 1MB)' }
    }

    const wordCount = this.countWords(content)
    if (wordCount < 10) {
      return { isValid: false, error: 'Content must contain at least 10 words for meaningful summarization' }
    }

    return { isValid: true }
  }

  /**
   * Get document statistics
   */
  getDocumentStats(content: string): {
    wordCount: number
    characterCount: number
    paragraphCount: number
    estimatedReadingTime: number
  } {
    const wordCount = this.countWords(content)
    const characterCount = content.length
    const paragraphCount = content.split(/\n\s*\n/).length
    const estimatedReadingTime = Math.ceil(wordCount / 200) // Assuming 200 words per minute

    return {
      wordCount,
      characterCount,
      paragraphCount,
      estimatedReadingTime
    }
  }
}
