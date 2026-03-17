#!/usr/bin/env node

/**
 * Generate clean PDFs from web pages (e.g. Docusaurus docs).
 *
 * Usage:
 *   node scripts/generate-pdfs.mjs [options]
 *
 * Options:
 *   --urls <url1,url2,...>   Comma-separated list of URLs
 *   --file <path>            Path to a text file with one URL per line
 *   --out  <path>            Output PDF file path (default: ./output.pdf)
 *
 * Examples:
 *   node scripts/generate-pdfs.mjs --urls "https://docs.temporal.io/workflows"
 *   node scripts/generate-pdfs.mjs --file urls.txt --out ./portfolio.pdf
 */

import puppeteer from "puppeteer";
import { PDFDocument } from "pdf-lib";
import { mkdir, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

// CSS injected into each page before printing to strip navigation chrome.
// Adjust selectors to match the target site (these cover Docusaurus defaults).
const PRINT_CSS = `
  /* Hide Docusaurus navigation chrome */
  .navbar,
  .footer,
  .theme-doc-sidebar-container,
  .theme-doc-toc-desktop,
  .theme-doc-toc-mobile,
  .theme-doc-breadcrumbs,
  .pagination-nav,
  .theme-doc-version-banner,
  .theme-admonition-tip .admonitionHeading_node_modules,
  [class*="announcementBar"],
  [class*="docSidebarContainer"],
  [class*="tableOfContents"] {
    display: none !important;
  }

  /* Let the main content fill the page */
  .main-wrapper,
  .docMainContainer,
  [class*="docItemContainer"] {
    margin: 0 !important;
    padding: 0 !important;
    max-width: 100% !important;
  }

  /* Clean typography for print */
  body {
    font-size: 11pt;
    line-height: 1.5;
    color: #1a1a1a;
  }

  /* Ensure code blocks don't overflow */
  pre, code {
    white-space: pre-wrap !important;
    word-break: break-word;
    font-size: 9pt;
  }

  /* Keep images reasonable */
  img {
    max-width: 100% !important;
    height: auto !important;
  }
`;

function slugFromUrl(url) {
  const path = new URL(url).pathname;
  return path.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "index";
}

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      urls: { type: "string" },
      file: { type: "string" },
      out: { type: "string", default: "./output.pdf" },
    },
  });

  let urls = [];

  if (values.urls) {
    urls = values.urls.split(",").map((u) => u.trim());
  }

  if (values.file) {
    const content = readFileSync(values.file, "utf-8");
    const fileUrls = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    urls.push(...fileUrls);
  }

  if (urls.length === 0) {
    console.error("No URLs provided. Use --urls or --file.");
    process.exit(1);
  }

  return { urls, outPath: values.out };
}

// Dismiss cookie/privacy popups and hide chatbot overlays.
async function dismissPopups(page) {
  await page.evaluate(() => {
    // --- Kapa.ai widget (Shadow DOM) ---
    // Hide the entire widget container so the consent modal never shows
    const kapaContainer = document.querySelector("#kapa-widget-container");
    if (kapaContainer) {
      kapaContainer.style.display = "none";
    }

    // --- Seers CMP cookie banner ---
    const seersBanner = document.querySelector("#seers-cmp");
    if (seersBanner) seersBanner.style.display = "none";
    // Seers also uses these common containers
    for (const el of document.querySelectorAll(
      '[class*="seers"], [id*="seers"], [class*="seerscmp"]'
    )) {
      el.style.display = "none";
    }

    // --- Generic cookie/consent banners ---
    const hideSelectors = [
      "#onetrust-consent-sdk",
      "#onetrust-banner-sdk",
      ".onetrust-pc-dark-filter",
      "#CybotCookiebotDialog",
      "#CybotCookiebotDialogBodyUnderlay",
      ".osano-cm-window",
      ".cc-window",
      ".cookie-banner",
      '[class*="cookie-consent"]',
      '[class*="cookieConsent"]',
      '[class*="privacy-banner"]',
      '[class*="CookieBanner"]',
      '[id*="cookie-banner"]',
      '[id*="gdpr"]',
      '[id*="privacy-popup"]',
    ];
    for (const sel of hideSelectors) {
      for (const el of document.querySelectorAll(sel)) {
        el.style.display = "none";
      }
    }

    // Unlock body scroll in case an overlay locked it
    document.body.style.overflow = "auto";
  });
}

async function generatePagePdf(page, url) {
  console.log(`  ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });

  // Dismiss cookie/privacy popups
  await dismissPopups(page);

  // Inject print-cleanup CSS
  await page.addStyleTag({ content: PRINT_CSS });

  // Small delay so any lazy-loaded images can settle
  await new Promise((r) => setTimeout(r, 1000));

  // Return PDF as a buffer (no file written yet)
  return page.pdf({
    format: "A4",
    margin: { top: "0.75in", right: "0.75in", bottom: "0.75in", left: "0.75in" },
    printBackground: true,
  });
}

async function main() {
  const { urls, outPath } = parseCliArgs();

  console.log(`Generating combined PDF from ${urls.length} page(s)...\n`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });

  const mergedPdf = await PDFDocument.create();

  for (const url of urls) {
    try {
      const pdfBytes = await generatePagePdf(page, url);
      const doc = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
      for (const p of copiedPages) {
        mergedPdf.addPage(p);
      }
      console.log(`    ✓ ${doc.getPageCount()} page(s)`);
    } catch (err) {
      console.error(`  ✗ Failed: ${url}\n    ${err.message}`);
    }
  }

  const finalBytes = await mergedPdf.save();
  await mkdir(join(outPath, ".."), { recursive: true });
  await writeFile(outPath, finalBytes);

  await browser.close();
  console.log(`\nDone. ${mergedPdf.getPageCount()} total pages → ${outPath}`);
}

main();
