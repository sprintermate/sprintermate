import { childLogger } from '../utils/logger';

const log = childLogger('ai-analysis');

/**
 * Build the analysis prompt based on PDF content, user message, and optional repo context.
 * The output must follow the structured MD format for business analysts.
 */
export function buildAnalysisPrompt(
  pdfText: string,
  userMessage: string | null,
  repoContext: string | null,
  locale: string,
  mdContext?: string | null,
): string {
  const language = locale === 'tr' ? 'Turkish' : 'English';
  const lines: string[] = [];

  lines.push('You are a Senior Business Analyst and Technical Analyst.');
  lines.push(`Write ALL output text in ${language}.`);
  lines.push('');
  lines.push('Your task: Analyze the given PDF document and repo context, then produce a clear, actionable output for analyst teams.');
  lines.push('');

  // Rules
  lines.push('## RULES (CRITICAL)');
  lines.push('- Do NOT go into deep technical implementation details');
  lines.push('- Do NOT write code or SQL');
  lines.push('- Only provide name-level analysis:');
  lines.push('  - Screen/page names');
  lines.push('  - DB table names');
  lines.push('  - Stored Procedure (SP) names');
  lines.push('- Do NOT guess — only speak based on given context');
  lines.push('- Do NOT fabricate table or SP names');
  lines.push('- Write concise and analyst-focused');
  lines.push('');

  // PDF content
  lines.push('## PDF Document Content');
  lines.push('');
  const truncatedPdf = pdfText.length > 8000 ? pdfText.slice(0, 8000) + '\n\n[... content truncated ...]' : pdfText;
  lines.push(truncatedPdf);
  lines.push('');

  // User message
  if (userMessage && userMessage.trim()) {
    lines.push('## Additional User Context');
    lines.push('');
    lines.push(userMessage.trim());
    lines.push('');
  }

  // Repo context
  if (repoContext && repoContext.trim()) {
    lines.push('## Repository Context (Code Search Results)');
    lines.push('');
    lines.push(repoContext.trim());
    lines.push('');
  }

  // MD document context
  if (mdContext && mdContext.trim()) {
    lines.push('## Additional Documentation Context (MD Files)');
    lines.push('');
    const truncatedMd = mdContext.length > 6000 ? mdContext.slice(0, 6000) + '\n\n[... content truncated ...]' : mdContext;
    lines.push(truncatedMd);
    lines.push('');
  }

  // Output format
  lines.push('## OUTPUT FORMAT');
  lines.push('');
  lines.push('Produce the output EXACTLY in the following markdown format. Keep each section concise.');
  lines.push('');
  lines.push('```');
  lines.push('## 📝 Gereksinim Özeti');
  lines.push('');
  lines.push('(Summarize the business need from the PDF. What is the business problem? What is the goal?)');
  lines.push('');
  lines.push('## 🖥️ İlgili Ekran / Modül');
  lines.push('');
  lines.push('(Which screens/modules does this change affect? List UI or service names if available.)');
  lines.push('');
  lines.push('## 🗄️ DB Nesneleri');
  lines.push('');
  lines.push('### Tablolar:');
  lines.push('- (list table names only — NO column details)');
  lines.push('');
  lines.push('### Stored Procedure\'ler:');
  lines.push('- (list SP names only — NO query details)');
  lines.push('');
  lines.push('## 🔧 İstenilen Değişiklik');
  lines.push('');
  lines.push('(Describe the expected system change. Is it new? Update? Bug fix?)');
  lines.push('');
  lines.push('## ⚠️ Etki Analizi');
  lines.push('');
  lines.push('- **Etkilenen Modüller:** ...');
  lines.push('- **Olası Riskler:** ...');
  lines.push('- **Bağımlılıklar:** ...');
  lines.push('');
  lines.push('## 🧪 Test Case\'ler');
  lines.push('');
  lines.push('### Pozitif Senaryolar:');
  lines.push('- ...');
  lines.push('');
  lines.push('### Negatif Senaryolar:');
  lines.push('- ...');
  lines.push('');
  lines.push('### Edge Case\'ler:');
  lines.push('- ...');
  lines.push('```');
  lines.push('');
  lines.push('IMPORTANT: Output ONLY the markdown content above. Do NOT wrap it in code fences. Do NOT add any explanation before or after.');

  return lines.join('\n');
}

/**
 * Clean up the AI response to ensure it's valid markdown output.
 */
export function parseAnalysisResponse(raw: string): string {
  let cleaned = raw.trim();

  // Remove surrounding code fences if the AI wrapped its output
  cleaned = cleaned.replace(/^```(?:markdown|md)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // Validate that it contains at least one expected section header
  const expectedHeaders = ['Gereksinim Özeti', 'İlgili Ekran', 'DB Nesneleri', 'İstenilen Değişiklik', 'Etki Analizi', 'Test Case'];
  const hasExpectedContent = expectedHeaders.some(h => cleaned.includes(h));

  if (!hasExpectedContent) {
    log.warn('AI response does not contain expected section headers, returning as-is');
  }

  return cleaned;
}
