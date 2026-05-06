import { childLogger } from '../utils/logger';
import { callAIFreeform, getProductionAISettings, type AzureAIOptions } from './aiService';
import { decrypt } from '../utils/crypto';
import { UserAISettings } from '../db/schema';
import { runAnalysisWithOpenCode } from './opencodeService';

const log = childLogger('analysisAgent');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisInput {
  userMessage: string;
  pdfText?: string;
  repoContext?: string;
  locale?: string;
  /** Custom agent prompt markdown; overrides the hardcoded SYSTEM_TEMPLATE when set */
  agentMarkdown?: string;
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
  lines.push(input.agentMarkdown ?? SYSTEM_TEMPLATE);
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
Do NOT use markdown. Return ONLY the HTML content, no code fences, no explanation. (LEGACY HTML FORMAT)

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

// ─── MD Prompt Builder (new format, used by opencode + all providers when md=true) ──

export function buildAnalysisMDPrompt(input: AnalysisInput): string {
  const language = input.locale === 'tr' ? 'Turkish' : 'English';
  const lines: string[] = [];

  lines.push(input.agentMarkdown ?? SYSTEM_TEMPLATE);
  lines.push('');
  lines.push(`Write ALL output in ${language}.`);
  lines.push('');

  lines.push('## 📥 INPUT');
  lines.push('');
  lines.push('### User Request:');
  lines.push(input.userMessage);
  lines.push('');

  if (input.pdfText) {
    lines.push('### Attached Document (PDF):');
    lines.push(input.pdfText.slice(0, 15_000));
    lines.push('');
  }

  if (input.repoContext) {
    lines.push('### Repo Context:');
    lines.push(input.repoContext.slice(0, 20_000));
    lines.push('');
  }

  lines.push(`## 📤 OUTPUT FORMAT

IMPORTANT: Respond ONLY with the following Markdown document structure. No preamble, no code fences, no explanation outside the document.

# 📝 Requirement Summary

[Short description of the business problem and objective]

---

# 🖥️ Affected Screens / Modules

- [Screen or module name]

---

# 🗄️ DB Objects

## Tables
- [Table name — from repo context only]

## Stored Procedures
- [SP name — from repo context only]

> ⚠️ All DB objects listed are based on repo context only. Items not found are marked as: *Not detected (not found in repo context)*

---

# 🔧 Requested Change

- [New feature / Update / Bug fix — business level description]

---

# ⚠️ Impact Analysis

- [Affected module or flow]
- [Potential risk]
- [Dependencies]

---

# 🧪 Test Cases

## ✅ Positive Scenarios
- [Happy path scenario]

## ❌ Negative Scenarios
- [Error or rejection scenario]

## ⚡ Edge Cases
- [Boundary condition]

## 🎯 SUCCESS CRITERIA
- Business analyst can read and understand directly
- Test team can write test cases immediately
- DB object names are never invented (critical)`);

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

    // Group items by key DB folders
    const tables = repo.items.filter(i => /\/Tables\//i.test(i.path) && i.gitObjectType === 'blob');
    const sps = repo.items.filter(i => /\/StoredProcedures?\//i.test(i.path) && i.gitObjectType === 'blob');
    const views = repo.items.filter(i => /\/Views\//i.test(i.path) && i.gitObjectType === 'blob');
    const functions = repo.items.filter(i => /\/Functions?\//i.test(i.path) && i.gitObjectType === 'blob');

    const isDbRepo = tables.length > 0 || sps.length > 0 || views.length > 0 || functions.length > 0;

    if (isDbRepo) {
      // Database.Project style repo — show SQL objects prominently
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
    } else {
      // Code repo — list all source files grouped by directory
      const allFiles = repo.items.filter(i => i.gitObjectType === 'blob').slice(0, 300);

      if (allFiles.length > 0) {
        // Group by top-level directory
        const grouped = new Map<string, string[]>();
        for (const file of allFiles) {
          const parts = file.path.replace(/^\//, '').split('/');
          const dir = parts.length > 1 ? parts[0] : '(root)';
          const name = parts[parts.length - 1];
          if (!grouped.has(dir)) grouped.set(dir, []);
          grouped.get(dir)!.push(name);
        }

        for (const [dir, files] of grouped) {
          lines.push(`📁 ${dir}/`);
          files.forEach(f => lines.push(`  - ${f}`));
        }
      } else {
        // Fallback: show folder structure
        const folders = repo.items.filter(i => i.gitObjectType === 'tree').slice(0, 80);
        if (folders.length > 0) {
          lines.push('📁 Folder structure:');
          folders.forEach(f => lines.push(`  - ${f.path}`));
        }
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

  log.info('Running analysis for user=%s provider=%s', userId, settings.provider);

  // ── OpenCode provider: use the SDK / local server ──────────────────────────
  if (settings.provider === 'opencode') {
    return runAnalysisWithOpenCode(input, input.agentMarkdown);
  }

  // ── All other providers: use MD prompt format ─────────────────────────────
  const prompt = buildAnalysisMDPrompt(input);

  const raw = await callAIFreeform(
    settings.provider,
    settings.apiKey,
    prompt,
    settings.azureOptions,
  );

  let md = raw.trim();

  // Strip code fences if present
  const fenceMatch = md.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    md = fenceMatch[1].trim();
  }

  return md;
}

// ─── Pipeline Types ──────────────────────────────────────────────────────────

export interface PipelineInput {
  userMessage: string;
  pdfText?: string;
  repoContext?: string;
  locale?: string;
}

export type PipelineEvent =
  | { type: 'step_start'; step: number; title: string }
  | { type: 'step_done'; step: number; title: string; output: string }
  | { type: 'complete'; steps: Array<{ step: number; title: string; output: string }> }
  | { type: 'error'; step: number; title: string; message: string };

export const PIPELINE_STEP_TITLES = [
  'PDF Analizi',
  'Kod & DB Analizi',
  'Çıktı Üretimi',
] as const;

// ─── Pipeline Helpers ─────────────────────────────────────────────────────────

function cleanFences(text: string): string {
  const m = text.trim().match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  return m ? m[1].trim() : text.trim();
}

// ─── Step 1: Document Analyst ─────────────────────────────────────────────────

function buildPipelineStep1Prompt(input: PipelineInput): string {
  const lines: string[] = [];

  const hasUserMessage = input.userMessage.trim().length > 0;

  lines.push(`# 📄 ADIM 1: BELGE ANALİSTİ

Sen kıdemli bir belge analisti olarak görev yapıyorsun. Görevin yorum katmadan, net ve yapılandırılmış biçimde belge içeriğini çıkarmaktır.

## KURALLAR
- Yorum katma, yalnızca çıkar ve yapılandır
- Teknik implementasyon detaylarına girme
- Tam ve eksiksiz listele
- Türkçe çıktı üret

## GÖREV
${hasUserMessage
    ? `Aşağıdaki iş gereksinimini ve varsa ekteki belgeyi analiz et. TÜM bilgileri şu kategorilere göre yapılandır:`
    : `Ekteki PDF belgesini analiz et. Belgede bulunan TÜM bilgileri şu kategorilere göre yapılandır:`
}
1. Gereksinim Özeti (ne istendiğini kısaca açıkla)
2. İş Kuralları (varsa tüm kural maddelerini listele)
3. Süreçler / Akışlar (varsa adım adım akışları çıkar)
4. Veri Alanları / Entities (formlar, tablolar, alanlar)
5. Ekran / Modül Referansları (hangi ekranlardan bahsedildiğini listele)
6. Kabul Kriterleri (varsa olduğu gibi aktar)
7. Özel Notlar (başka önemli bilgiler)`);

  if (hasUserMessage) {
    lines.push(`
## KULLANICI GEREKSİNİMİ
${input.userMessage}`);
  }

  if (input.pdfText) {
    lines.push(`
## EKTEN ÇIKARILAN BELGE İÇERİĞİ
${input.pdfText.slice(0, 15_000)}`);
  } else if (!hasUserMessage) {
    lines.push(`
## NOT
PDF belgesi veya kullanıcı gereksinimi sağlanmamış. Bu adımı atlayıp boş çıktı üret.`);
  } else {
    lines.push(`
## NOT
Ek PDF belgesi yüklenmemiş. Yalnızca kullanıcı gereksinimine göre analiz yap.`);
  }

  lines.push(`
## ÇIKTI FORMATI
Sadece Markdown belgesi üret. Kod bloğu, önsöz veya açıklama ekleme. Şu başlıkları kullan:

# 📝 Gereksinim Özeti
# 📋 İş Kuralları
# 🔄 Süreçler & Akışlar
# 📊 Veri Alanları
# 🖥️ Ekran Referansları
# ✅ Kabul Kriterleri
# 📌 Özel Notlar`);

  return lines.join('\n');
}

// ─── Step 2: Code & DB Analyst ────────────────────────────────────────────────

function buildPipelineStep2Prompt(input: PipelineInput, step1Output: string): string {
  const lines: string[] = [];
  lines.push(`# 🗄️ ADIM 2: KOD & VERİTABANI ANALİSTİ

Sen kıdemli bir teknik analistsin. Verilen repo context'ini inceleyerek teknik envanter oluşturacaksın.

## KURALLAR
- SADECE repo context'te bulunan nesneleri listele
- Tahmin yürütme, olmayan şeyler için "Tespit edilemedi (repo context'te bulunamadı)" yaz
- Türkçe çıktı üret
- Kod yazma, SQL yazma, teknik implementasyon anlatma
- Database.Project reposundaki Tables / StoredProcedures / Views / Functions klasörlerini özellikle tara
- Diğer kod repoları için kaynak dosyaları (controllers, services, pages, components, models) listele

## GÖREV
Repo context'i inceleyerek şunları tespit et ve listele:
1. **Tablolar** — Tables klasöründeki .sql dosyaları (Database.Project repo)
2. **Stored Procedure'ler** — StoredProcedures / StoredProcedure klasöründeki dosyalar
3. **View'lar** — Views klasöründeki dosyalar
4. **Fonksiyonlar** — Functions klasöründeki dosyalar
5. **Ekran / Modül İpuçları** — Klasör isimleri ve yapıdan çıkarılabilecek modüller (pages, controllers, services vb.)
6. **Gereksinimle Bağlantılı Teknik Bileşenler** — Adım 1 bulgularına ve kullanıcı gereksinimine göre ilgili dosyalar

## KULLANICI GEREKSİNİMİ (Bağlam için)
${input.userMessage || '(PDF belgesinden çıkarılan gereksinim — bkz. Adım 1 çıktısı)'}

## ADIM 1 ÇIKTISI (Bağlam için)
${step1Output.slice(0, 5_000)}`);

  if (input.repoContext) {
    lines.push(`
## REPO CONTEXT
${input.repoContext.slice(0, 20_000)}`);
  } else {
    lines.push(`
## NOT
Repo context sağlanmamış. Bu adımda teknik envanter oluşturulamaz. Tüm başlıklar için "Repo context yüklenmedi" olarak belirt.`);
  }

  lines.push(`
## ÇIKTI FORMATI
Sadece Markdown belgesi üret. Kod bloğu veya açıklama ekleme. Şu başlıkları kullan:

# 📁 Tablolar
# 🔧 Stored Procedure'ler
# 👁️ View'lar
# ⚡ Fonksiyonlar
# 🖥️ Ekran / Modül İpuçları
# 🔗 Gereksinimle İlgili Teknik Bileşenler`);

  return lines.join('\n');
}

// ─── Step 3: Output Formatter (combines Impact Analysis + Final Output) ────────

const HARDCODED_OUTPUT_FORMAT = `# 📝 Gereksinim Özeti

[Gereksinimin kısa açıklaması ve amacı]

---

# 🖥️ İlgili Ekran / Modül

- [Etkilenen ekran veya modül adı]
- [Servis veya bileşen adı]

---

# 🗄️ DB Nesneleri

## Tablolar:
- [Tablo adı — sadece repo context'ten]

## Stored Procedure'ler:
- [SP adı — sadece repo context'ten]

> ⚠️ Tüm DB nesneleri yalnızca repo context'e göre listelenmiştir. Bulunamayanlar açıkça belirtilmiştir.

---

# 🔧 İstenilen Değişiklik

- [Yeni geliştirme / Güncelleme / Bug fix — iş seviyesinde açıklama]

---

# ⚠️ Etki Analizi

- [Etkilenen modül veya akış]
- [Olası risk]
- [Bağımlılıklar]

---

# 🧪 Test Case'ler

## ✅ Pozitif

- [Mutlu yol senaryosu 1]

## ❌ Negatif

- [Hata veya red senaryosu]

## ⚠️ Edge

- [Sınır koşulu]
- [Eş zamanlı veya alışılmadık durum]`;

function buildPipelineStep3Prompt(
  input: PipelineInput,
  step1Output: string,
  step2Output: string,
): string {
  return `# 📋 ADIM 3: ÇIKTI ÜRETİCİ

Sen kıdemli bir belge formatlayıcısın. Önceki 2 adımın bulgularını, belirlenen formata göre konsolide ederek son analiz belgesini üreteceksin. Etki analizini de bu çıktıya dahil et.

## KURALLAR
- Sadece önceki adımlardan gelen bilgileri kullan
- Formatı AYNEN koru — başlık isimleri ve emoji'ler değişmez
- Eksiksiz ve tam doldur; bilinmeyen alanlar için "Tespit edilemedi" yaz
- Türkçe çıktı üret
- Yorum katma, bulguları aktar
- DB nesneleri için SADECE Adım 2'de tespit edilenleri yaz — uydurma

## KULLANILACAK FORMAT (AYNEN KORU)
${HARDCODED_OUTPUT_FORMAT}

## ADIM 1 ÇIKTISI (Belge Analizi — Gereksinimler)
${step1Output.slice(0, 8_000)}

## ADIM 2 ÇIKTISI (Teknik Envanter — Kod & DB)
${step2Output.slice(0, 8_000)}

## KULLANICI GEREKSİNİMİ
${input.userMessage || '(PDF belgesinden — bkz. Adım 1 özeti)'}

## GÖREV
Yukarıdaki tüm bilgileri kullanarak, BELİRTİLEN FORMAT'a AYNEN sadık kalarak kapsamlı ve eksiksiz son analiz belgesini üret.
Sadece Markdown belgesi üret. Kod bloğu, önsöz veya açıklama ekleme.
Etki analizini ⚠️ Etki Analizi bölümünde detaylı doldur.`;
}

// ─── Pipeline Runner ──────────────────────────────────────────────────────────

export async function* runPipelineAnalysis(
  userId: string,
  input: PipelineInput,
): AsyncGenerator<PipelineEvent> {
  const settings = await resolveAISettings(userId);
  const stepOutputs: string[] = [];
  const PIPELINE_TIMEOUT_MS = 180_000; // 3 minutes per step for CLI providers

  const promptBuilders: Array<() => string> = [
    () => buildPipelineStep1Prompt(input),
    () => buildPipelineStep2Prompt(input, stepOutputs[0] ?? ''),
    () => buildPipelineStep3Prompt(input, stepOutputs[0] ?? '', stepOutputs[1] ?? ''),
  ];

  for (let i = 0; i < 3; i++) {
    const step = i + 1;
    const title = PIPELINE_STEP_TITLES[i];
    yield { type: 'step_start', step, title };

    try {
      const prompt = promptBuilders[i]();
      let raw: string;

      if (settings.provider === 'opencode') {
        raw = await runAnalysisWithOpenCode(
          { userMessage: 'Lütfen analizi üret.', locale: input.locale },
          prompt,
        );
      } else {
        raw = await callAIFreeform(
          settings.provider,
          settings.apiKey,
          prompt,
          settings.azureOptions,
          PIPELINE_TIMEOUT_MS,
        );
      }

      const output = cleanFences(raw);
      stepOutputs.push(output);
      yield { type: 'step_done', step, title, output };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      yield { type: 'error', step, title, message };
      return;
    }
  }

  yield {
    type: 'complete',
    steps: PIPELINE_STEP_TITLES.map((title, i) => ({
      step: i + 1,
      title,
      output: stepOutputs[i] ?? '',
    })),
  };
}

/**
 * Legacy HTML analysis — kept for backward-compat with old stored messages.
 * @deprecated Use runAnalysis() which now returns Markdown.
 */
export async function runAnalysisLegacyHTML(
  userId: string,
  input: AnalysisInput,
): Promise<string> {
  const settings = await resolveAISettings(userId);
  const prompt = buildAnalysisPrompt(input);
  const raw = await callAIFreeform(
    settings.provider,
    settings.apiKey,
    prompt,
    settings.azureOptions,
  );
  let html = raw.trim();
  const fenceMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fenceMatch) html = fenceMatch[1].trim();
  if (!html.includes('analysis-output')) {
    html = `<div class="analysis-output"><div class="analysis-section">${html}</div></div>`;
  }
  return html;
}
