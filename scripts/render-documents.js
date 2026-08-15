const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const documents = [
    {
        source: 'Crime_Records_API_Documentation (1).md',
        output: 'Crime_Records_API_Documentation.pdf'
    },
    {
        source: 'Crime_Records_Development_Context_Report.md',
        output: 'Crime_Records_Development_Context_Report.pdf'
    }
];

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 48;
const MARGIN_RIGHT = 48;
const MARGIN_TOP = 50;
const MARGIN_BOTTOM = 46;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

const toPdfText = value => String(value)
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const stripMarkdown = value => String(value)
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();

const wrapText = (value, maxCharacters) => {
    const text = stripMarkdown(value);

    if (!text) {
        return [''];
    }

    const lines = [];
    let currentLine = '';

    for (const rawWord of text.split(/\s+/)) {
        const wordParts = [];

        if (rawWord.length > maxCharacters) {
            for (let index = 0; index < rawWord.length; index += maxCharacters) {
                wordParts.push(rawWord.slice(index, index + maxCharacters));
            }
        } else {
            wordParts.push(rawWord);
        }

        for (const word of wordParts) {
            const candidate = currentLine ? `${currentLine} ${word}` : word;

            if (candidate.length <= maxCharacters) {
                currentLine = candidate;
            } else {
                if (currentLine) {
                    lines.push(currentLine);
                }

                currentLine = word;
            }
        }
    }

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
};

const wrapCodeLine = (value, maxCharacters) => {
    const text = String(value).replace(/\t/g, '    ');

    if (!text) {
        return [''];
    }

    const lines = [];

    for (let index = 0; index < text.length; index += maxCharacters) {
        lines.push(text.slice(index, index + maxCharacters));
    }

    return lines;
};

const renderMarkdownToPages = markdown => {
    const sourceLines = markdown.replaceAll('\r\n', '\n').split('\n');
    const pages = [[]];
    let pageIndex = 0;
    let y = PAGE_HEIGHT - MARGIN_TOP;

    const currentPage = () => pages[pageIndex];

    const newPage = () => {
        pages.push([]);
        pageIndex += 1;
        y = PAGE_HEIGHT - MARGIN_TOP;
    };

    const ensureSpace = requiredHeight => {
        if (y - requiredHeight < MARGIN_BOTTOM + 14) {
            newPage();
        }
    };

    const drawText = (text, {
        font = 'F1',
        size = 10.5,
        x = MARGIN_LEFT,
        leading = 14,
        after = 0,
        shade = false
    } = {}) => {
        ensureSpace(leading + after);

        if (shade) {
            currentPage().push(
                `0.95 g ${x - 4} ${y - 3} ${CONTENT_WIDTH + 8} ${leading} re f 0 g`
            );
        }

        currentPage().push(
            `BT /${font} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${toPdfText(text)}) Tj ET`
        );
        y -= leading + after;
    };

    const addParagraph = text => {
        const maxCharacters = Math.max(20, Math.floor(CONTENT_WIDTH / (10.5 * 0.53)));
        const lines = wrapText(text, maxCharacters);

        for (const line of lines) {
            drawText(line, { leading: 14 });
        }

        y -= 5;
    };

    const addHeading = (level, text) => {
        const styles = {
            1: { font: 'F2', size: 21, leading: 28, after: 8 },
            2: { font: 'F2', size: 15, leading: 21, after: 4 },
            3: { font: 'F2', size: 12, leading: 17, after: 2 },
            4: { font: 'F2', size: 10.5, leading: 15, after: 1 }
        };
        const style = styles[level] || styles[4];
        const maxCharacters = Math.max(
            18,
            Math.floor(CONTENT_WIDTH / (style.size * 0.56))
        );
        const lines = wrapText(text, maxCharacters);

        y -= level === 1 ? 0 : 8;

        for (const line of lines) {
            drawText(line, style);
        }

        if (level === 1) {
            ensureSpace(6);
            currentPage().push(
                `0.20 0.42 0.56 RG 1.2 w ${MARGIN_LEFT} ${y + 4} m ${PAGE_WIDTH - MARGIN_RIGHT} ${y + 4} l S 0 G`
            );
            y -= 7;
        }
    };

    for (let index = 0; index < sourceLines.length; index += 1) {
        const line = sourceLines[index];

        if (!line.trim()) {
            continue;
        }

        if (line.startsWith('```')) {
            const codeLines = [];
            index += 1;

            while (index < sourceLines.length && !sourceLines[index].startsWith('```')) {
                codeLines.push(sourceLines[index]);
                index += 1;
            }

            y -= 4;

            for (const codeLine of codeLines) {
                for (const wrappedLine of wrapCodeLine(codeLine, 88)) {
                    drawText(wrappedLine, {
                        font: 'F3',
                        size: 8.5,
                        x: MARGIN_LEFT + 4,
                        leading: 12,
                        shade: true
                    });
                }
            }

            y -= 7;
            continue;
        }

        const heading = /^(#{1,4})\s+(.+)$/.exec(line);

        if (heading) {
            addHeading(heading[1].length, heading[2]);
            continue;
        }

        if (/^\s*-\s+/.test(line)) {
            const item = line.replace(/^\s*-\s+/, '');
            const maxCharacters = Math.floor((CONTENT_WIDTH - 14) / (10.5 * 0.53));
            const wrappedLines = wrapText(item, maxCharacters);

            wrappedLines.forEach((wrappedLine, lineIndex) => {
                drawText(
                    `${lineIndex === 0 ? '- ' : '  '}${wrappedLine}`,
                    { x: MARGIN_LEFT + 10, leading: 14 }
                );
            });
            y -= 1;
            continue;
        }

        if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(sourceLines[index + 1] || '')) {
            const tableLines = [line];
            index += 2;

            while (
                index < sourceLines.length &&
                sourceLines[index].includes('|') &&
                sourceLines[index].trim()
            ) {
                tableLines.push(sourceLines[index]);
                index += 1;
            }

            index -= 1;
            tableLines.forEach((tableLine, rowIndex) => {
                const cells = tableLine
                    .trim()
                    .replace(/^\|/, '')
                    .replace(/\|$/, '')
                    .split('|')
                    .map(cell => stripMarkdown(cell))
                    .join(' | ');

                for (const wrappedLine of wrapCodeLine(cells, 96)) {
                    drawText(wrappedLine, {
                        font: rowIndex === 0 ? 'F2' : 'F3',
                        size: rowIndex === 0 ? 8.5 : 8,
                        leading: 12,
                        shade: rowIndex === 0
                    });
                }
            });
            y -= 6;
            continue;
        }

        if (/^\s*---+\s*$/.test(line)) {
            ensureSpace(10);
            currentPage().push(
                `0.75 G 0.6 w ${MARGIN_LEFT} ${y} m ${PAGE_WIDTH - MARGIN_RIGHT} ${y} l S 0 G`
            );
            y -= 10;
            continue;
        }

        const paragraphLines = [line.trim()];

        while (
            index + 1 < sourceLines.length &&
            sourceLines[index + 1].trim() &&
            !/^(#{1,4})\s+/.test(sourceLines[index + 1]) &&
            !/^\s*-\s+/.test(sourceLines[index + 1]) &&
            !sourceLines[index + 1].startsWith('```') &&
            !sourceLines[index + 1].includes('|')
        ) {
            index += 1;
            paragraphLines.push(sourceLines[index].trim());
        }

        addParagraph(paragraphLines.join(' '));
    }

    pages.forEach((commands, index) => {
        commands.push(
            `BT /F1 8 Tf 1 0 0 1 ${PAGE_WIDTH - MARGIN_RIGHT - 42} 24 Tm (Page ${index + 1}) Tj ET`
        );
    });

    return pages;
};

const createPdf = pages => {
    const objects = new Map();
    const pageObjectIds = pages.map((_, index) => 7 + (index * 2));

    objects.set(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objects.set(
        2,
        `<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] >>`
    );
    objects.set(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects.set(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
    objects.set(5, '<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');

    pages.forEach((commands, index) => {
        const contentObjectId = 6 + (index * 2);
        const pageObjectId = 7 + (index * 2);
        const stream = commands.join('\n');

        objects.set(
            contentObjectId,
            `<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`
        );
        objects.set(
            pageObjectId,
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
            `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> ` +
            `/Contents ${contentObjectId} 0 R >>`
        );
    });

    const maximumObjectId = Math.max(...objects.keys());
    const chunks = [Buffer.from('%PDF-1.4\n%\xff\xff\xff\xff\n', 'latin1')];
    const offsets = new Array(maximumObjectId + 1).fill(0);
    let currentOffset = chunks[0].length;

    for (let objectId = 1; objectId <= maximumObjectId; objectId += 1) {
        const objectBody = objects.get(objectId);

        if (!objectBody) {
            throw new Error(`Missing PDF object ${objectId}`);
        }

        const objectBuffer = Buffer.from(
            `${objectId} 0 obj\n${objectBody}\nendobj\n`,
            'latin1'
        );
        offsets[objectId] = currentOffset;
        chunks.push(objectBuffer);
        currentOffset += objectBuffer.length;
    }

    const xrefOffset = currentOffset;
    const xrefLines = [
        'xref',
        `0 ${maximumObjectId + 1}`,
        '0000000000 65535 f '
    ];

    for (let objectId = 1; objectId <= maximumObjectId; objectId += 1) {
        xrefLines.push(`${String(offsets[objectId]).padStart(10, '0')} 00000 n `);
    }

    xrefLines.push(
        'trailer',
        `<< /Size ${maximumObjectId + 1} /Root 1 0 R >>`,
        'startxref',
        String(xrefOffset),
        '%%EOF'
    );
    chunks.push(Buffer.from(`${xrefLines.join('\n')}\n`, 'latin1'));

    return Buffer.concat(chunks);
};

for (const document of documents) {
    const sourcePath = path.join(projectRoot, document.source);
    const outputPath = path.join(projectRoot, document.output);
    const markdown = fs.readFileSync(sourcePath, 'utf8');
    const pages = renderMarkdownToPages(markdown);

    fs.writeFileSync(outputPath, createPdf(pages));
    console.log(`Rendered ${document.output} (${pages.length} pages)`);
}
