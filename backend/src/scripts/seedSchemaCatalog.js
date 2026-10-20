/**
 * File: backend/src/scripts/seedSchemaCatalog.js
 * Uses Groq (openai/gpt-oss-120b) to generate rich schema documents (JSON + Markdown)
 * for all crime tables and seeds Supabase `chatbot_schema_catalog`.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const fs = require('fs');
const Groq = require('groq-sdk');
const pool = require('../config/db');
const {
    SYSTEM_TABLES,
    getDatasetTableSchema
} = require('../services/datasetTableService');

// Initialize Groq client (automatically reads process.env.GROQ_API_KEY)
const groq = process.env.GROQ_API_KEY
    ? new Groq({ apiKey: process.env.GROQ_API_KEY })
    : null;

/**
 * 1. Fetch all crime dataset table names using your SYSTEM_TABLES Set
 */
async function getAllCrimeTables() {
    const excludedTables = [...SYSTEM_TABLES];
    const placeholders = excludedTables.map(() => '?').join(',');
    const schemaName = process.env.DB_SCHEMA || 'public';

    const [tables] = await pool.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = ?
          AND table_type = 'BASE TABLE'
          AND table_name NOT IN (${placeholders})
        ORDER BY table_name
        `,
        [schemaName, ...excludedTables]
    );

    return tables.map(t => t.TABLE_NAME || t.table_name);
}

/**
 * 2. Fetch row count and up to 5 distinct sample values per categorical/year column
 */
async function getTableStatsAndSamples(tableName, columns) {
    const tableId = pool.escapeId(tableName);
    const [countResult] = await pool.query(
        `SELECT COUNT(*) AS total FROM ${tableId}`
    );
    const rowCount = Number(countResult[0]?.total || 0);
    const sampleValues = {};

    if (rowCount === 0) {
        return { rowCount, sampleValues };
    }

    for (const col of columns) {
        const colName = col.COLUMN_NAME || col.column_name;
        const dataType = String(col.DATA_TYPE || col.data_type).toLowerCase();

        const isText = dataType.includes('char') || dataType.includes('text');
        const isDimension = /area|state|district|year|group|sub_group|sex|gender|age|type|category/i.test(colName);

        if (isText || isDimension) {
            try {
                const colId = pool.escapeId(colName);
                const [options] = await pool.query(
                    `
                    SELECT DISTINCT ${colId}
                    FROM ${tableId}
                    WHERE ${colId} IS NOT NULL
                    ORDER BY ${colId} ASC
                    LIMIT 5
                    `
                );
                if (options.length > 0) {
                    sampleValues[colName] = options.map(item => item[colName]);
                }
            } catch (err) {
                // Skip columns that cannot be distinct-ordered
            }
        }
    }

    return { rowCount, sampleValues };
}

/**
 * 3. Generate semantic description for the table using Groq (openai/gpt-oss-120b)
 */
async function buildSemanticSummary(tableName, formattedColumns, sampleValues) {
    const colSummary = formattedColumns
        .map(c => `${c.quoted_name} (${c.type})`)
        .join(', ');

    if (!groq) {
        const readableName = tableName.replace(/_/g, ' ');
        return {
            crime_category: readableName.toUpperCase(),
            semantic_summary: `Dataset table "${tableName}" containing Indian crime records for ${readableName}. Tracks attributes: ${formattedColumns.map(c => c.name).join(', ')}.`,
            column_descriptions: {}
        };
    }

    const prompt = `
You are documenting an Indian Crime Records PostgreSQL database for a Text-to-SQL AI assistant.
Analyze the following dataset table and output a JSON summary:

Table Name: "${tableName}"
Columns: ${colSummary}
Sample Values: ${JSON.stringify(sampleValues)}

Return strictly valid JSON with this exact structure (no markdown code blocks, just raw JSON):
{
  "crime_category": "High-level category (e.g., 'Property Crime - Auto Theft', 'Crimes Against Women', 'Custodial Deaths', 'Violent Crime')",
  "semantic_summary": "A clear 2-3 sentence summary explaining what crime statistics this table records, its granularity (e.g., Area/State and Year), and what analytical questions it can answer.",
  "column_descriptions": {
    "ExactColumnName": "Short 1-line description of this attribute"
  }
}`;

    try {
        const chatCompletion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'You are a database documentation assistant. Always respond with valid JSON only.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            model: 'openai/gpt-oss-120b',
            temperature: 0.3,
            max_completion_tokens: 2048,
            top_p: 1,
            stream: false,
            reasoning_effort: 'medium',
            response_format: { type: 'json_object' }
        });

        const rawContent = chatCompletion.choices[0]?.message?.content || '{}';
        return JSON.parse(rawContent);
    } catch (error) {
        console.warn(`⚠️ Groq summary fallback for "${tableName}": ${error.message}`);
        const readableName = tableName.replace(/_/g, ' ');
        return {
            crime_category: readableName.toUpperCase(),
            semantic_summary: `Dataset table "${tableName}" containing Indian crime records for ${readableName}. Tracks attributes: ${formattedColumns.map(c => c.name).join(', ')}.`,
            column_descriptions: {}
        };
    }
}

/**
 * 4. Generate Embedding Vectors (if Gemini, OpenAI, or Voyage API keys are set in .env)
 */
async function createEmbeddings(embeddingText) {
    const vectors = { gemini: null, openai: null, claude: null };

    // A. Gemini Embedding (768 dims) via REST API (no extra SDK required!)
    if (process.env.GEMINI_API_KEY) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'models/text-embedding-004',
                    content: { parts: [{ text: embeddingText }] }
                })
            });
            const data = await res.json();
            if (data.embedding?.values) {
                vectors.gemini = `[${data.embedding.values.join(',')}]`;
            }
        } catch (e) {
            console.warn('⚠️ Gemini embedding skipped:', e.message);
        }
    }

    // B. OpenAI Embedding (1536 dims)
    if (process.env.OPENAI_API_KEY) {
        try {
            const res = await fetch('https://api.openai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'text-embedding-3-small',
                    input: embeddingText
                })
            });
            const data = await res.json();
            if (data.data?.[0]?.embedding) {
                vectors.openai = `[${data.data[0].embedding.join(',')}]`;
            }
        } catch (e) {
            console.warn('⚠️ OpenAI embedding skipped:', e.message);
        }
    }

    // C. Voyage / Claude Embedding (1024 dims)
    if (process.env.VOYAGE_API_KEY) {
        try {
            const res = await fetch('https://api.voyageai.com/v1/embeddings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`
                },
                body: JSON.stringify({
                    model: 'voyage-3',
                    input: [embeddingText]
                })
            });
            const data = await res.json();
            if (data.data?.[0]?.embedding) {
                vectors.claude = `[${data.data[0].embedding.join(',')}]`;
            }
        } catch (e) {
            console.warn('⚠️ Voyage embedding skipped:', e.message);
        }
    }

    return vectors;
}

/**
 * 5. Upsert the generated document + vectors into `chatbot_schema_catalog`
 */
async function upsertCatalogRow(doc, vectors) {
    await pool.query(
        `
        INSERT INTO chatbot_schema_catalog (
            table_name,
            crime_category,
            row_count,
            semantic_summary,
            embedding_text,
            columns_schema,
            sample_values,
            embedding_gemini,
            embedding_openai,
            embedding_claude,
            updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::vector, ?::vector, ?::vector, NOW())
        ON CONFLICT (table_name) DO UPDATE SET
            crime_category = EXCLUDED.crime_category,
            row_count = EXCLUDED.row_count,
            semantic_summary = EXCLUDED.semantic_summary,
            embedding_text = EXCLUDED.embedding_text,
            columns_schema = EXCLUDED.columns_schema,
            sample_values = EXCLUDED.sample_values,
            embedding_gemini = COALESCE(EXCLUDED.embedding_gemini, chatbot_schema_catalog.embedding_gemini),
            embedding_openai = COALESCE(EXCLUDED.embedding_openai, chatbot_schema_catalog.embedding_openai),
            embedding_claude = COALESCE(EXCLUDED.embedding_claude, chatbot_schema_catalog.embedding_claude),
            updated_at = NOW()
        `,
        [
            doc.table_name,
            doc.crime_category,
            doc.row_count,
            doc.semantic_summary,
            doc.embedding_text,
            JSON.stringify(doc.columns_schema),
            JSON.stringify(doc.sample_values),
            vectors.gemini,
            vectors.openai,
            vectors.claude
        ]
    );
}

/**
 * Main execution
 */
async function main() {
    console.log('🔍 Fetching all crime dataset tables...');
    const tables = await getAllCrimeTables();
    console.log(`✅ Found ${tables.length} crime dataset tables.\n`);

    const allDocuments = [];
    let markdownDoc = `# Crime Records of India — AI Schema Summary Document\n\n`;
    markdownDoc += `Total Tables: **${tables.length}**\n\n---\n\n`;

    for (let i = 0; i < tables.length; i++) {
        const table = tables[i];
        console.log(`[${i + 1}/${tables.length}] Processing table with Groq (openai/gpt-oss-120b): ${table}...`);

        const schema = await getDatasetTableSchema(pool, table);
        if (!schema || !schema.columns) continue;

        const formattedColumns = schema.columns.map(col => ({
            name: col.COLUMN_NAME,
            quoted_name: pool.escapeId(col.COLUMN_NAME),
            type: col.DATA_TYPE,
            nullable: col.IS_NULLABLE
        }));

        const { rowCount, sampleValues } = await getTableStatsAndSamples(table, schema.columns);
        const aiMeta = await buildSemanticSummary(table, formattedColumns, sampleValues);

        const enrichedColumns = formattedColumns.map(c => ({
            ...c,
            description: aiMeta.column_descriptions?.[c.name] || ''
        }));

        const embeddingText = [
            `Table: "${table}"`,
            `Category: ${aiMeta.crime_category}`,
            `Summary: ${aiMeta.semantic_summary}`,
            `Attributes: ${enrichedColumns.map(c => `${c.name} (${c.description || c.type})`).join(', ')}`
        ].join(' | ');

        const tableDoc = {
            table_name: table,
            crime_category: aiMeta.crime_category,
            row_count: rowCount,
            semantic_summary: aiMeta.semantic_summary,
            embedding_text: embeddingText,
            columns_schema: enrichedColumns,
            sample_values: sampleValues
        };

        const vectors = await createEmbeddings(embeddingText);
        await upsertCatalogRow(tableDoc, vectors);

        allDocuments.push(tableDoc);

        // Append to Markdown summary file
        markdownDoc += `## ${i + 1}. \`${pool.escapeId(table)}\` (${aiMeta.crime_category})\n`;
        markdownDoc += `- **Total Records:** ${rowCount}\n`;
        markdownDoc += `- **Summary:** ${aiMeta.semantic_summary}\n`;
        markdownDoc += `- **Attributes:**\n`;
        for (const col of enrichedColumns) {
            const sampleStr = sampleValues[col.name]
                ? ` — *Samples: ${JSON.stringify(sampleValues[col.name])}*`
                : '';
            markdownDoc += `  - \`${col.quoted_name}\` (${col.type}): ${col.description}${sampleStr}\n`;
        }
        markdownDoc += `\n---\n\n`;
    }

    // Save the generated document files into backend/src/data/
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    const jsonPath = path.join(dataDir, 'crime_schema_summary.json');
    const mdPath = path.join(dataDir, 'crime_schema_summary.md');

    fs.writeFileSync(jsonPath, JSON.stringify(allDocuments, null, 2), 'utf-8');
    fs.writeFileSync(mdPath, markdownDoc, 'utf-8');

    console.log(`\n🎉 Completed! Documented & indexed ${allDocuments.length} tables.`);
    console.log(`📄 JSON saved at: ${jsonPath}`);
    console.log(`📘 Markdown saved at: ${mdPath}`);
    process.exit(0);
}

main().catch(err => {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
});