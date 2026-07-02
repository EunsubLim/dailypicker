import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const env = await loadEnv(path.join(rootDir, ".env"));

const config = {
  keyword: env.SEARCH_KEYWORD || "부동산",
  category: env.POST_CATEGORY || "부동산",
  outputDir: env.POST_OUTPUT_DIR || "posts",
  maxResults: Number(env.MAX_REFERENCE_RESULTS || 10),
  smartstoreUrl: env.SMARTSTORE_URL || "YOUR_SMARTSTORE_URL",
  serpApiKey: env.SERPAPI_KEY || "",
  googleApiKey: env.GOOGLE_API_KEY || "",
  googleCseId: env.GOOGLE_CSE_ID || "",
  openAiKey: env.OPENAI_API_KEY || "",
  openAiModel: env.OPENAI_MODEL || "",
};

if (dryRun) {
  console.log("[DailyPicker] dry-run OK");
  console.log(`[DailyPicker] keyword=${config.keyword}`);
  console.log(`[DailyPicker] provider=${detectSearchProvider(config) || "not configured"}`);
  console.log(`[DailyPicker] openai=${config.openAiKey ? "configured" : "fallback template"}`);
  process.exit(0);
}

const provider = detectSearchProvider(config);
if (!provider) {
  fail("SERPAPI_KEY 또는 GOOGLE_API_KEY + GOOGLE_CSE_ID를 .env에 넣어주세요.");
}

const searchResults = await searchGoogleLike(config, provider);
const topResults = searchResults.slice(0, config.maxResults);

if (topResults.length === 0) {
  fail("검색 결과가 없습니다. 키워드 또는 검색 API 설정을 확인해주세요.");
}

await ensureDir(path.join(rootDir, "data"));
await fs.writeFile(
  path.join(rootDir, "data", `rankings-${slugify(config.keyword)}.json`),
  JSON.stringify({ keyword: config.keyword, provider, updatedAt: new Date().toISOString(), results: topResults }, null, 2),
  "utf8",
);

const article = config.openAiKey
  ? await generateWithOpenAI(config, topResults)
  : generateFallbackArticle(config, topResults);

const normalized = normalizeArticle(article, config, topResults);
const postPath = await writePost(config, normalized, topResults);
await updatePostsIndex(config, normalized, postPath);
await updateHomePage(config);
await updateSitemap(postPath);

console.log(`[DailyPicker] 글 생성 완료: ${path.relative(rootDir, postPath)}`);

async function loadEnv(filePath) {
  const loaded = { ...process.env };

  try {
    const text = await fs.readFile(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
      loaded[key] = value;
    }
  } catch {
    // .env is optional. The batch can also use Windows environment variables.
  }

  return loaded;
}

function detectSearchProvider(options) {
  if (options.serpApiKey) return "serpapi";
  if (options.googleApiKey && options.googleCseId) return "google-cse";
  return "";
}

async function searchGoogleLike(options, provider) {
  if (provider === "serpapi") {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google");
    url.searchParams.set("q", options.keyword);
    url.searchParams.set("google_domain", "google.co.kr");
    url.searchParams.set("hl", "ko");
    url.searchParams.set("gl", "kr");
    url.searchParams.set("num", String(options.maxResults));
    url.searchParams.set("api_key", options.serpApiKey);

    const data = await fetchJson(url);
    return (data.organic_results || []).slice(0, options.maxResults).map((item, index) => ({
      rank: item.position || index + 1,
      title: cleanText(item.title || ""),
      url: item.link || "",
      snippet: cleanText(item.snippet || ""),
      source: item.source || hostOf(item.link || ""),
    }));
  }

  const url = new URL("https://www.googleapis.com/customsearch/v1");
  url.searchParams.set("key", options.googleApiKey);
  url.searchParams.set("cx", options.googleCseId);
  url.searchParams.set("q", options.keyword);
  url.searchParams.set("num", String(Math.min(options.maxResults, 10)));
  url.searchParams.set("lr", "lang_ko");

  const data = await fetchJson(url);
  return (data.items || []).slice(0, options.maxResults).map((item, index) => ({
    rank: index + 1,
    title: cleanText(item.title || ""),
    url: item.link || "",
    snippet: cleanText(item.snippet || ""),
    source: hostOf(item.link || ""),
  }));
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status} ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

async function generateWithOpenAI(options, results) {
  if (!options.openAiModel) {
    fail("OPENAI_MODEL을 .env에 넣어주세요. 예: 현재 계정에서 사용할 모델명");
  }

  const prompt = [
    "너는 한국어 블로그 편집자다.",
    "아래 구글 검색 결과 여러 개의 제목, 요약, 링크를 함께 참고해서 완전히 새로운 원본 글을 작성한다.",
    "한 결과에만 기대지 말고, 여러 글에서 반복되는 관점과 빠진 관점을 섞어 자연스럽게 재구성한다.",
    "다른 블로그 문장을 복사하거나 문장 구조를 따라 하지 않는다. 원문과 7단어 이상 연속으로 같은 표현을 쓰지 않는다.",
    "AI가 쓴 듯한 도입부, 과한 정리 문구, 반복적인 결론 문장을 피한다.",
    "사람이 직접 검색하고 메모한 듯한 자연스러운 편집자 톤으로 쓴다.",
    "문장 길이를 다양하게 쓰고, 가끔 짧은 문장을 섞는다.",
    "다만 없는 경험담, 방문 후기, 거래 사례, 확인하지 않은 수치는 지어내지 않는다.",
    "광고성 과장, 투자 수익 보장, 법률/세무 확정 표현은 피한다.",
    "부동산 주제는 정보성으로 쓰고, 독자가 확인해야 할 기준을 중심으로 쓴다.",
    "JSON만 출력한다. 형식: {\"title\":\"...\",\"summary\":\"...\",\"bodyHtml\":\"<p>...</p><h2>...</h2>\",\"tags\":[\"...\"]}",
    "",
    `키워드: ${options.keyword}`,
    "검색 결과:",
    ...results.map((item) => `${item.rank}. ${item.title}\nURL: ${item.url}\n요약: ${item.snippet}`),
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.openAiModel,
      input: prompt,
      temperature: 0.7,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI 요청 실패: ${response.status} ${JSON.stringify(data).slice(0, 400)}`);
  }

  const text = extractOpenAIText(data);
  try {
    return JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
  } catch {
    return {
      title: `${options.keyword} 검색 흐름으로 본 체크포인트`,
      summary: "검색 결과를 바탕으로 확인할 기준을 정리했습니다.",
      bodyHtml: sanitizeGeneratedHtml(text),
      tags: [options.keyword, options.category],
    };
  }
}

function extractOpenAIText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  const parts = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) parts.push(content.text);
      if (content.type === "text" && content.text) parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function generateFallbackArticle(options, results) {
  const topTitles = results.slice(0, 3).map((item) => item.title).filter(Boolean);
  return {
    title: `${options.keyword} 검색 상위 글에서 보이는 핵심 체크포인트`,
    summary: `${options.keyword} 검색 결과 상위 ${results.length}개를 기준으로 현재 사람들이 많이 확인하는 내용을 정리했습니다.`,
    bodyHtml: [
      `<p>오늘 검색 결과를 보면 ${escapeHtml(options.keyword)} 주제에서는 정보의 최신성, 지역별 차이, 실제 확인해야 할 조건이 중요하게 다뤄지고 있습니다. 특정 글을 그대로 옮기기보다, 상위 결과에서 반복되는 관점을 기준으로 독자가 점검할 항목을 정리했습니다.</p>`,
      "<h2>상위 결과에서 반복되는 흐름</h2>",
      `<p>${escapeHtml(topTitles.join(", ")) || "상위 결과"}처럼 검색 상단에 노출되는 글들은 대체로 현재 시장 상황, 초보자가 놓치기 쉬운 기준, 실제 의사결정 전에 확인할 자료를 중심으로 구성되어 있습니다.</p>`,
      "<h2>확인해야 할 기준</h2>",
      "<ul><li>정보가 작성된 날짜와 업데이트 여부</li><li>지역, 가격대, 목적에 따른 차이</li><li>공식 자료와 현장 정보의 차이</li><li>광고성 표현과 실제 확인 가능한 정보의 구분</li></ul>",
      "<h2>읽을 때 주의할 점</h2>",
      "<p>부동산 정보는 상황에 따라 빠르게 달라질 수 있습니다. 블로그 글은 판단의 출발점으로만 보고, 실제 결정 전에는 공공 데이터, 현장 확인, 전문가 상담을 함께 확인하는 편이 안전합니다.</p>",
    ].join("\n"),
    tags: [options.keyword, options.category, "검색 트렌드"],
  };
}

function normalizeArticle(article, options, results) {
  const now = new Date();
  const title = cleanText(article.title || `${options.keyword} 검색 흐름 정리`);
  const summary = cleanText(article.summary || `${options.keyword} 검색 결과를 바탕으로 핵심 기준을 정리했습니다.`);
  const bodyHtml = sanitizeGeneratedHtml(article.bodyHtml || "");
  const tags = Array.isArray(article.tags) ? article.tags.map(cleanText).filter(Boolean).slice(0, 5) : [options.keyword];
  const slug = `${slugify(options.keyword)}-${formatDate(now, "yyyyMMdd-HHmm")}`;

  return {
    title,
    summary,
    bodyHtml,
    tags,
    slug,
    category: options.category,
    createdAt: now.toISOString(),
    dateLabel: formatKoreanDate(now),
    fileName: `${slug}.html`,
    references: results,
  };
}

async function writePost(options, article, results) {
  const outputDir = path.join(rootDir, options.outputDir);
  await ensureDir(outputDir);

  const referencesHtml = results
    .map(
      (item) => `
              <li>
                <a class="font-bold text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-emerald-500" href="${escapeAttribute(item.url)}" target="_blank" rel="nofollow noopener">${escapeHtml(item.title || item.url)}</a>
                <p class="mt-1 text-sm leading-6 text-zinc-500">${escapeHtml(item.snippet || hostOf(item.url))}</p>
              </li>`,
    )
    .join("\n");

  const tagsHtml = article.tags.map((tag) => `<span class="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">${escapeHtml(tag)}</span>`).join("\n");

  const html = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(article.title)} | 데일리픽</title>
    <meta name="description" content="${escapeAttribute(article.summary)}" />
    <meta name="google-adsense-account" content="ca-pub-0000000000000000" />
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="../styles.css" />
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-0000000000000000" crossorigin="anonymous"></script>
  </head>
  <body class="bg-zinc-100 text-zinc-950 antialiased">
    <div class="min-h-screen lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside class="border-b border-zinc-200 bg-white px-5 py-5 lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r lg:px-7 lg:py-9">
        <a class="block" href="../index.html">
          <span class="block text-2xl font-black tracking-tight">데일리픽</span>
          <span class="mt-1 block text-sm text-zinc-500">생활 픽을 고르는 블로그</span>
        </a>
        <nav class="mt-8 grid gap-1 text-sm font-semibold text-zinc-600" aria-label="카테고리">
          <p class="mb-2 text-xs font-black uppercase tracking-widest text-emerald-700">Categories</p>
          <a class="rounded-lg px-3 py-2 hover:bg-zinc-100" href="../index.html#articles">전체 글</a>
          <a class="rounded-lg bg-zinc-950 px-3 py-2 text-white" href="#">${escapeHtml(article.category)}</a>
          <a class="rounded-lg px-3 py-2 hover:bg-zinc-100" href="../contact.html">문의</a>
        </nav>
      </aside>

      <main class="flex justify-center px-4 py-8 sm:px-8 lg:px-14 lg:py-14">
        <article class="article-paper w-full max-w-4xl bg-white px-6 py-10 sm:px-12 sm:py-14 lg:px-20 lg:py-20">
          <header class="mx-auto max-w-2xl text-center">
            <p class="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">${escapeHtml(article.category)}</p>
            <h1 class="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">${escapeHtml(article.title)}</h1>
            <p class="mx-auto mt-5 max-w-xl text-base leading-8 text-zinc-500">${escapeHtml(article.summary)}</p>
            <div class="mt-7 flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-500">
              <span>${escapeHtml(article.dateLabel)}</span>
              <span class="h-1 w-1 rounded-full bg-zinc-300"></span>
              <span>검색 결과 참고</span>
              <span class="h-1 w-1 rounded-full bg-zinc-300"></span>
              <span>광고 포함 가능</span>
            </div>
            <div class="mt-6 flex flex-wrap justify-center gap-2">
              ${tagsHtml}
            </div>
          </header>

          <div class="post-content mx-auto mt-14 max-w-2xl">
            ${article.bodyHtml}
          </div>

          <section class="mx-auto my-14 max-w-2xl border-y border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500" aria-label="광고 영역">
            <p class="font-bold text-zinc-700">Google AdSense 광고</p>
            <ins class="adsbygoogle" style="display: block" data-ad-client="ca-pub-0000000000000000" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins>
          </section>

          <section class="mx-auto max-w-2xl">
            <h2 class="text-2xl font-black tracking-tight">참고한 검색 결과</h2>
            <ol class="mt-5 grid gap-5">
              ${referencesHtml}
            </ol>
          </section>

          <section class="mx-auto mt-14 max-w-2xl bg-zinc-950 px-6 py-7 text-white sm:px-8">
            <p class="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Sponsored</p>
            <h2 class="mt-3 text-2xl font-black tracking-tight">관련 상품 보러가기</h2>
            <p class="mt-3 leading-7 text-zinc-300">아래 버튼은 운영자의 스마트스토어로 연결될 예정입니다. 구매 전 옵션과 배송 정보를 확인하세요.</p>
            <a class="mt-6 inline-flex rounded-full bg-white px-5 py-3 text-sm font-black text-zinc-950 hover:bg-emerald-100" href="${escapeAttribute(options.smartstoreUrl)}" data-store-link>스토어 보기</a>
          </section>
        </article>
      </main>
    </div>
    <script src="../script.js"></script>
  </body>
</html>
`;

  const postPath = path.join(outputDir, article.fileName);
  await fs.writeFile(postPath, html, "utf8");
  return postPath;
}

async function updatePostsIndex(options, article, postPath) {
  const filePath = path.join(rootDir, options.outputDir, "posts.json");
  let posts = [];

  try {
    posts = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    posts = [];
  }

  const relativeUrl = toSitePath(path.relative(rootDir, postPath));
  posts = posts.filter((post) => post.url !== relativeUrl);
  posts.unshift({
    title: article.title,
    summary: article.summary,
    category: article.category,
    date: article.createdAt,
    url: relativeUrl,
    tags: article.tags,
  });

  await fs.writeFile(filePath, JSON.stringify(posts.slice(0, 50), null, 2), "utf8");
}

async function updateHomePage(options) {
  const indexPath = path.join(rootDir, "index.html");
  const postsPath = path.join(rootDir, options.outputDir, "posts.json");
  const posts = JSON.parse(await fs.readFile(postsPath, "utf8"));
  let indexHtml = await fs.readFile(indexPath, "utf8");

  const generatedHtml = posts
    .slice(0, 10)
    .map(
      (post) => `            <article data-auto-post>
              <a class="grid gap-4 py-7 transition hover:bg-white sm:grid-cols-[140px_minmax(0,1fr)] sm:px-3" href="${escapeAttribute(post.url)}">
                <span class="text-sm font-black text-emerald-700">${escapeHtml(post.category)}</span>
                <div>
                  <h3 class="text-2xl font-black tracking-tight">${escapeHtml(post.title)}</h3>
                  <p class="mt-2 text-zinc-600">${escapeHtml(post.summary)}</p>
                </div>
              </a>
            </article>`,
    )
    .join("\n");

  const block = `            <!-- AUTO_POSTS_START -->\n${generatedHtml}\n            <!-- AUTO_POSTS_END -->`;

  if (indexHtml.includes("<!-- AUTO_POSTS_START -->") && indexHtml.includes("<!-- AUTO_POSTS_END -->")) {
    indexHtml = indexHtml.replace(/            <!-- AUTO_POSTS_START -->[\s\S]*?            <!-- AUTO_POSTS_END -->/, block);
  } else {
    indexHtml = indexHtml.replace(
      '<div class="divide-y divide-zinc-200 border-y border-zinc-200">',
      `<div class="divide-y divide-zinc-200 border-y border-zinc-200">\n${block}`,
    );
  }

  await fs.writeFile(indexPath, indexHtml, "utf8");
}

async function updateSitemap(postPath) {
  const sitemapPath = path.join(rootDir, "sitemap.xml");
  let sitemap = "";
  try {
    sitemap = await fs.readFile(sitemapPath, "utf8");
  } catch {
    return;
  }

  const loc = `https://dailypicker.kr/${toSitePath(path.relative(rootDir, postPath))}`;
  if (sitemap.includes(loc)) return;

  const entry = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>\n  </url>\n`;
  sitemap = sitemap.replace("</urlset>", `${entry}</urlset>`);
  await fs.writeFile(sitemapPath, sitemap, "utf8");
}

function sanitizeGeneratedHtml(html) {
  const allowed = String(html || "")
    .replace(/```html/gi, "")
    .replace(/```/g, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .trim();

  if (!allowed) {
    return "<p>검색 결과를 바탕으로 확인할 기준을 정리했습니다.</p>";
  }

  return allowed;
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function slugify(value) {
  const roman = String(value || "post")
    .normalize("NFKD")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return roman || "post";
}

function formatDate(date, pattern) {
  const parts = {
    yyyy: String(date.getFullYear()),
    MM: String(date.getMonth() + 1).padStart(2, "0"),
    dd: String(date.getDate()).padStart(2, "0"),
    HH: String(date.getHours()).padStart(2, "0"),
    mm: String(date.getMinutes()).padStart(2, "0"),
  };
  return pattern.replace(/yyyy|MM|dd|HH|mm/g, (key) => parts[key]);
}

function formatKoreanDate(date) {
  return `업데이트 ${formatDate(date, "yyyy.MM.dd")}`;
}

function toSitePath(value) {
  return value.split(path.sep).join("/");
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function fail(message) {
  console.error(`[DailyPicker] ${message}`);
  process.exit(1);
}
