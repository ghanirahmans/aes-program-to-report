import { generateAesReport } from "@/lib/generate-report";

const [plaintext, key] = process.argv.slice(2);

if (!plaintext || !key) {
  console.error("Usage: npm run report:ts -- <plaintext 16 byte | hex 32 digit> <key 16 byte | hex 32 digit>");
  process.exit(1);
}

generateAesReport({ plaintext, key })
  .then((result) => {
    console.log(`\nFolder hasil dibuat: '${result.outputDir}'`);
    console.log(`DOCX: '${result.docxPath}'`);
    console.log(`PDF : '${result.pdfPath}'`);
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
