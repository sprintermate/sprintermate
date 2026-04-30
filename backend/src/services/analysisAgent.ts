import { childLogger } from '../utils/logger';
import { callAIFreeform, getProductionAISettings, type AzureAIOptions } from './aiService';
import { decrypt } from '../utils/crypto';
import { UserAISettings } from '../db/schema';

const log = childLogger('analysisAgent');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisInput {
  userMessage: string;
  pdfText?: string;
  repoContext?: string;
  locale?: string;
}

interface ResolvedAISettings {
  provider: string;
  apiKey: string | null;
  azureOptions?: AzureAIOptions;
}

// ─── Resolve AI settings for a user ──────────────────────────────────────────

async function resolveAISettings(userId: string): Promise<ResolvedAISettings> {
  // Check for production-level (env-var) AI settings first
  const prod = getProductionAISettings();
  if (prod) return prod;

  // Fall back to per-user DB settings
  const row = await UserAISettings.findOne({ where: { user_id: userId } });
  if (!row) {
    throw new Error('No AI settings configured. Please configure your AI provider in Settings.');
  }

  const settings = row.get({ plain: true }) as any;
  let apiKey: string | null = null;
  if (settings.encrypted_api_key) {
    apiKey = decrypt(settings.encrypted_api_key);
  }

  let azureOptions: AzureAIOptions | undefined;
  if (settings.provider === 'azure-openai') {
    if (!settings.encrypted_endpoint) throw new Error('Azure OpenAI endpoint not configured');
    azureOptions = {
      endpoint: decrypt(settings.encrypted_endpoint),
      deploymentName: settings.azure_deployment_name ?? 'gpt-4o',
      apiVersion: settings.azure_api_version ?? '2024-02-01',
      organization: settings.azure_organization,
    };
  }

  return { provider: settings.provider, apiKey, azureOptions };
}

// ─── Business Analysis Prompt Builder ────────────────────────────────────────

const SYSTEM_TEMPLATE = `# 📊 BUSINESS ANALYSIS AGENT

## 🎯 AMAÇ

Bu agent, verilen PDF dokümanını ve repo context'ini analiz ederek:
- Detaya girmeden
- Teknik implementasyon anlatmadan
- Analist ve test ekiplerinin anlayacağı şekilde
**kısa, net ve aksiyona dönüştürülebilir analiz çıktısı üretir.**

## 🧠 ROL

Sen bir **Senior Business Analyst + Technical Analyst** olarak görev yapıyorsun.
- Developer gibi düşünme
- Kod yazma
- Teknik derinliğe girme
- İş ihtiyacını sadeleştir

## ⚠️ KRİTİK DB ERİŞİM KURALI (ZORUNLU)

Database erişimi MCP üzerinden YOKTUR (VPN kısıtı nedeniyle).

### ✅ TEK GEÇERLİ KAYNAK: Repo context

### 🔍 DB NESNELERİ NASIL BULUNACAK?
- Repo context içinde gelen:
  - StoredProcedures klasörü
  - Tables klasörü
  - Views klasörü
üzerinden okuma yapar.

### ❗ ZORUNLU KURALLAR
- ❌ MCP kullanma
- ❌ Canlı DB sorgusu varsayma
- ❌ Tahmini tablo/SP ismi üretme
- ❌ Context dışında isim uydurma
- ✅ SADECE repo context'te varsa yaz
- ✅ Yoksa: → "Tespit edilemedi (repo context'te bulunamadı)" yaz

## ⚠️ GENEL KURALLAR

### 🚫 Yapılmayacaklar
- Kod yazma
- SQL yazma
- Teknik implementasyon anlatma
- Kolon / query detayı verme
- Tahmin yürütme

### ✅ Yapılacaklar
- Sadece isim seviyesinde analiz
- Kısa, net, analist dili kullan
- Gereksiz açıklama yapma`;

export function buildAnalysisPrompt(input: AnalysisInput): string {
  const language = input.locale === 'tr' ? 'Turkish' : 'English';

  const lines: string[] = [];
  lines.push(SYSTEM_TEMPLATE);
  lines.push('');
  lines.push(`Write ALL output in ${language}.`);
  lines.push('');

  lines.push('## 📥 INPUT');
  lines.push('');
  lines.push('### Kullanıcı Girdisi:');
  lines.push(input.userMessage);
  lines.push('');

  if (input.pdfText) {
    lines.push('### PDF Özeti:');
    lines.push(input.pdfText.slice(0, 15000)); // limit to ~15k chars
    lines.push('');
  }

  if (input.repoContext) {
    lines.push('### Repo Context:');
    lines.push(input.repoContext.slice(0, 20000)); // limit to ~20k chars
    lines.push('');
  }

  lines.push(`## 📤 OUTPUT FORMAT

IMPORTANT: You MUST respond with a well-structured HTML output. Use the following HTML template exactly.
Do NOT use markdown. Return ONLY the HTML content, no code fences, no explanation.

<div class="analysis-output">
  <div class="analysis-section">
    <h2>📝 Gereksinim Özeti</h2>
    <p>[İş problemi ve amacı kısaca açıkla]</p>
  </div>

  <div class="analysis-section">
    <h2>🖥️ İlgili Ekran / Modül</h2>
    <ul>
      <li>[Etkilenen ekranlar]</li>
      <li>[Servis veya modül adları]</li>
    </ul>
  </div>

  <div class="analysis-section">
    <h2>🗄️ DB Nesneleri</h2>
    <h3>Tablolar:</h3>
    <ul>
      <li>[Tablo isimleri - SADECE repo context'ten]</li>
    </ul>
    <h3>Stored Procedure'ler:</h3>
    <ul>
      <li>[SP isimleri - SADECE repo context'ten]</li>
    </ul>
    <p class="warning">❗ Sadece Database.Project repo context'ine göre yazılmıştır. Bulunamayanlar "Tespit edilemedi" olarak belirtilmiştir.</p>
  </div>

  <div class="analysis-section">
    <h2>🔧 İstenilen Değişiklik</h2>
    <ul>
      <li>[Yeni geliştirme / Güncelleme / Bug fix detayları]</li>
    </ul>
  </div>

  <div class="analysis-section">
    <h2>⚠️ Etki Analizi</h2>
    <ul>
      <li>[Etkilenen modüller]</li>
      <li>[Olası riskler]</li>
      <li>[Bağımlılıklar]</li>
    </ul>
  </div>

  <div class="analysis-section">
    <h2>🧪 Test Case'ler</h2>
    <div class="test-cases">
      <h3>✅ Pozitif</h3>
      <ul class="positive">
        <li>[Pozitif test senaryoları]</li>
      </ul>
      <h3>❌ Negatif</h3>
      <ul class="negative">
        <li>[Negatif test senaryoları]</li>
      </ul>
      <h3>⚠️ Edge</h3>
      <ul class="edge">
        <li>[Edge case senaryoları]</li>
      </ul>
    </div>
  </div>
</div>

## 🎯 BAŞARI KRİTERİ
- İş analisti direkt anlayabilmeli
- Test ekibi senaryo yazabilmeli
- Developer'a bağımlı kalınmamalı
- DB isimleri uydurulmamalı (kritik)`);

  return lines.join('\n');
}

// ─── PDF Text & Image Extraction ─────────────────────────────────────────────

export async function parsePDF(buffer: Buffer): Promise<string> {
  try {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });

    // Extract text
    const textResult = await parser.getText();
    let text = textResult.text
      .replace(/\s{3,}/g, '\n\n')
      .trim();

    // Extract images and append descriptions
    try {
      const imgResult = await parser.getImage({
        imageThreshold: 50,
        imageBuffer: false,
        imageDataUrl: false,
      });
      if (imgResult && imgResult.pages) {
        const imgDescriptions: string[] = [];
        for (const page of imgResult.pages) {
          if (page.images && page.images.length > 0) {
            for (const img of page.images) {
              imgDescriptions.push(
                `[Image on page ${page.pageNumber}: ${img.width}x${img.height}px, name="${img.name}"]`
              );
            }
          }
        }
        if (imgDescriptions.length > 0) {
          text += '\n\n--- PDF Images ---\n' + imgDescriptions.join('\n');
          log.info('parsePDF: extracted %d image references', imgDescriptions.length);
        }
      }
    } catch (imgErr: any) {
      log.info('parsePDF: image extraction skipped: %s', imgErr.message);
    }

    return text;
  } catch (err: any) {
    log.warn('PDF parsing failed: %s', err.message);
    throw new Error('Failed to parse PDF file. Please ensure it is a valid PDF document.');
  }
}

// ─── Build Repo Context String ───────────────────────────────────────────────

export function buildRepoContext(
  repoTrees: Array<{ repoName: string; items: Array<{ path: string; gitObjectType: string }> }>,
): string {
  const lines: string[] = [];

  for (const repo of repoTrees) {
    lines.push(`\n=== Repository: ${repo.repoName} ===\n`);

    // Group items by key folders
    const tables = repo.items.filter(i => /\/Tables\//i.test(i.path) && i.gitObjectType === 'blob');
    const sps = repo.items.filter(i => /\/StoredProcedures?\//i.test(i.path) && i.gitObjectType === 'blob');
    const views = repo.items.filter(i => /\/Views\//i.test(i.path) && i.gitObjectType === 'blob');
    const functions = repo.items.filter(i => /\/Functions?\//i.test(i.path) && i.gitObjectType === 'blob');

    if (tables.length > 0) {
      lines.push('📁 Tables:');
      tables.forEach(t => lines.push(`  - ${t.path.split('/').pop()}`));
    }
    if (sps.length > 0) {
      lines.push('📁 Stored Procedures:');
      sps.forEach(s => lines.push(`  - ${s.path.split('/').pop()}`));
    }
    if (views.length > 0) {
      lines.push('📁 Views:');
      views.forEach(v => lines.push(`  - ${v.path.split('/').pop()}`));
    }
    if (functions.length > 0) {
      lines.push('📁 Functions:');
      functions.forEach(f => lines.push(`  - ${f.path.split('/').pop()}`));
    }

    // If none of the DB folders found, list top-level structure
    if (tables.length === 0 && sps.length === 0 && views.length === 0 && functions.length === 0) {
      const folders = repo.items.filter(i => i.gitObjectType === 'tree').slice(0, 50);
      if (folders.length > 0) {
        lines.push('📁 Folder structure:');
        folders.forEach(f => lines.push(`  - ${f.path}`));
      }
    }
  }

  return lines.join('\n');
}

// ─── Main Analysis Function ──────────────────────────────────────────────────

export async function runAnalysis(
  userId: string,
  input: AnalysisInput,
): Promise<string> {
  const settings = await resolveAISettings(userId);

  const prompt = buildAnalysisPrompt(input);

  log.info('Running analysis for user=%s provider=%s', userId, settings.provider);

  const raw = await callAIFreeform(
    settings.provider,
    settings.apiKey,
    prompt,
    settings.azureOptions,
  );

  // Try to extract HTML from the response
  let html = raw.trim();

  // If wrapped in code fences, extract the content
  const fenceMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    html = fenceMatch[1].trim();
  }

  // If the response doesn't contain our expected div, wrap it
  if (!html.includes('analysis-output') && !html.includes('analysis-section')) {
    html = `<div class="analysis-output"><div class="analysis-section">${html}</div></div>`;
  }

  return html;
}
