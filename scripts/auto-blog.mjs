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
  minPostChars: Number(env.POST_MIN_CHARS || 2000),
  maxPostChars: Number(env.POST_MAX_CHARS || 4000),
  freeMode: env.FREE_AUTO_BLOG !== "0",
};

async function main() {
  if (dryRun) {
    console.log("[DailyPicker] dry-run OK");
    console.log(`[DailyPicker] keyword=${config.keyword}`);
    console.log(`[DailyPicker] mode=${config.freeMode ? "free topic mode" : "paid search/AI mode"}`);
    console.log(`[DailyPicker] provider=${config.freeMode ? "free-topic-pool" : detectSearchProvider(config) || "not configured"}`);
    console.log(`[DailyPicker] openai=${!config.freeMode && config.openAiKey ? "configured" : "not used"}`);
    console.log(`[DailyPicker] post length=${config.minPostChars}~${config.maxPostChars} chars`);
    return;
  }

  const provider = config.freeMode ? "free-topic-pool" : detectSearchProvider(config);
  if (!provider) {
    fail("SERPAPI_KEY 또는 GOOGLE_API_KEY + GOOGLE_CSE_ID가 필요합니다. 무료로 돌리려면 FREE_AUTO_BLOG=1로 설정하세요.");
  }

  const searchResults = config.freeMode
    ? getFreeReferenceResults(config)
    : await searchGoogleLike(config, provider);
  const topResults = searchResults.slice(0, config.maxResults);

  if (topResults.length === 0) {
    fail("참고 자료가 없습니다. 설정을 확인해 주세요.");
  }

  await ensureDir(path.join(rootDir, "data"));
  await fs.writeFile(
    path.join(rootDir, "data", `rankings-${slugify(config.keyword)}.json`),
    JSON.stringify({ keyword: config.keyword, provider, updatedAt: new Date().toISOString(), results: topResults }, null, 2),
    "utf8",
  );

  let article = !config.freeMode && config.openAiKey
    ? await generateWithOpenAI(config, topResults)
    : generateFallbackArticle(config, topResults);

  if (!config.freeMode && config.openAiKey) {
    article = await ensureArticleLength(config, topResults, article);
  }

  const normalized = normalizeArticle(article, config, topResults);
  const normalizedLength = plainTextLength(normalized.bodyHtml);
  if (normalizedLength < config.minPostChars || normalizedLength > config.maxPostChars) {
    fail(`생성된 본문 길이가 설정 범위를 벗어났습니다. 현재 ${normalizedLength}자, 목표 ${config.minPostChars}~${config.maxPostChars}자`);
  }

  const postPath = await writePost(config, normalized, topResults);
  await updatePostsIndex(config, normalized, postPath);
  await updateHomePage(config);
  await updateSitemap(postPath);

  console.log(`[DailyPicker] 글 생성 완료: ${path.relative(rootDir, postPath)}`);
}

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
    // Local .env is optional. GitHub Actions uses secrets and variables.
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
    fail("OPENAI_MODEL을 설정해 주세요.");
  }

  const prompt = [
    "너는 한국어 블로그 편집자다.",
    "아래 검색 결과의 제목, 요약, 링크를 참고하되 문장을 복사하지 말고 새 글로 작성한다.",
    "과장 광고, 투자 수익 보장, 법률/세무 확정 표현은 피한다.",
    `본문은 HTML 조각으로 작성하고, 태그를 제외한 글자 수가 ${options.minPostChars}~${options.maxPostChars}자 사이여야 한다.`,
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
      title: `${options.keyword} 흐름을 볼 때 확인할 점`,
      summary: `${options.keyword} 관련 검색 결과를 바탕으로 확인 기준을 정리했습니다.`,
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

async function ensureArticleLength(options, results, article) {
  const currentLength = plainTextLength(article.bodyHtml || "");
  if (currentLength >= options.minPostChars && currentLength <= options.maxPostChars) {
    return article;
  }

  const direction = currentLength < options.minPostChars ? "늘려" : "줄여";
  const prompt = [
    "아래 글을 정보성 블로그 글로 다시 다듬어라.",
    `본문 글자 수는 HTML 태그를 제외하고 반드시 ${options.minPostChars}~${options.maxPostChars}자 사이여야 한다.`,
    `현재 글자 수는 ${currentLength}자이므로 자연스럽게 ${direction}라.`,
    "JSON만 출력한다. 형식: {\"title\":\"...\",\"summary\":\"...\",\"bodyHtml\":\"<p>...</p><h2>...</h2>\",\"tags\":[\"...\"]}",
    "",
    JSON.stringify(article),
    "",
    "참고 결과:",
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
      temperature: 0.65,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(`OpenAI 재작성 요청 실패: ${response.status} ${JSON.stringify(data).slice(0, 400)}`);
  }

  const text = extractOpenAIText(data);
  try {
    return JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
  } catch {
    return {
      title: article.title || `${options.keyword} 흐름 정리`,
      summary: article.summary || `${options.keyword} 관련 확인 기준을 정리했습니다.`,
      bodyHtml: sanitizeGeneratedHtml(text),
      tags: article.tags || [options.keyword, options.category],
    };
  }
}

function getFreeReferenceResults(options) {
  const topic = selectFreeTopic();
  const common = [
    {
      title: "국토교통부 실거래가 공개시스템",
      url: "https://rt.molit.go.kr",
      snippet: "아파트, 연립, 다세대, 오피스텔 등 실제 신고된 거래 가격을 확인할 수 있는 공공 자료입니다.",
    },
    {
      title: "한국부동산원 부동산통계정보",
      url: "https://www.reb.or.kr",
      snippet: "가격 동향과 통계 자료를 함께 볼 수 있어 시장 흐름을 점검할 때 참고하기 좋습니다.",
    },
    {
      title: "청약홈",
      url: "https://www.applyhome.co.kr",
      snippet: "청약 일정, 모집 공고, 당첨자 발표와 자격 조건을 확인할 수 있는 공식 서비스입니다.",
    },
    {
      title: "대법원 인터넷등기소",
      url: "https://www.iros.go.kr",
      snippet: "등기부등본 열람과 권리 관계 확인에 사용하는 공식 서비스입니다.",
    },
    {
      title: "KOSIS 국가통계포털",
      url: "https://kosis.kr",
      snippet: "인구, 가구, 지역 지표 등 부동산 판단에 도움이 되는 기초 통계를 확인할 수 있습니다.",
    },
  ];

  return [...topic.references, ...common].slice(0, options.maxResults).map((item, index) => ({
    rank: index + 1,
    title: item.title,
    url: item.url,
    snippet: item.snippet,
    source: hostOf(item.url),
  }));
}

function generateFallbackArticle(options, results) {
  const topic = selectFreeTopic();
  const referenceLine = results
    .slice(0, 3)
    .map((item) => item.title)
    .filter(Boolean)
    .join(", ");

  const bodyParts = [
    `<p>${topic.intro}</p>`,
    `<p>${options.keyword} 글을 읽을 때는 단정적인 전망보다 확인 순서가 더 중요합니다. 같은 지역이라도 역과의 거리, 입주 연차, 관리 상태, 대출 조건, 전월세 수요에 따라 판단이 달라집니다. 그래서 이 글은 특정 매물을 추천하기보다 실제로 자료를 볼 때 놓치기 쉬운 기준을 차분하게 정리하는 방향으로 구성했습니다.</p>`,
    `<p>이번 글은 ${escapeHtml(referenceLine || "공식 자료")}처럼 공개된 자료에서 자주 확인하는 항목을 바탕으로 썼습니다. 무료 자동 글쓰기 모드에서는 실시간 검색 순위를 긁어오지 않고, 검증 가능한 공공 자료와 기본 체크리스트를 중심으로 정보성 글을 발행합니다.</p>`,
  ];

  for (const section of topic.sections) {
    bodyParts.push(`<h2>${section.heading}</h2>`);
    for (const paragraph of section.paragraphs) {
      bodyParts.push(`<p>${paragraph}</p>`);
    }
  }

  bodyParts.push(
    "<h2>읽고 나서 바로 해볼 일</h2>",
    `<p>관심 지역이 있다면 먼저 최근 거래 사례와 현재 호가를 나란히 놓고 보세요. 그다음 같은 면적이라도 층, 향, 수리 상태, 동 위치가 가격에 어떤 차이를 만드는지 확인하면 숫자가 훨씬 현실적으로 보입니다. ${options.keyword} 정보는 한 번에 결론을 내리기보다 자료를 쌓아가며 좁혀가는 편이 안전합니다.</p>`,
    "<p>또한 계약이나 청약처럼 금액이 크게 움직이는 결정은 글 하나만 보고 진행하지 않는 것이 좋습니다. 등기, 대출 가능 금액, 세금, 관리비, 입주 가능 시기처럼 개인별로 달라지는 항목이 많기 때문입니다. 글은 방향을 잡는 용도, 최종 판단은 공식 자료와 전문가 확인을 함께 두는 방식이 가장 무난합니다.</p>",
  );

  let bodyHtml = bodyParts.join("\n");
  while (plainTextLength(bodyHtml) < options.minPostChars) {
    bodyHtml += `\n<p>${topic.extra}</p>`;
  }
  while (plainTextLength(bodyHtml) > options.maxPostChars && bodyParts.length > 8) {
    bodyParts.splice(-3, 1);
    bodyHtml = bodyParts.join("\n");
  }

  return {
    title: topic.title,
    summary: topic.summary,
    bodyHtml,
    tags: [options.keyword, options.category, ...topic.tags].slice(0, 5),
  };
}

function selectFreeTopic() {
  const forcedIndex = Number(process.env.FREE_TOPIC_INDEX);
  if (Number.isInteger(forcedIndex)) {
    return FREE_TOPICS[((forcedIndex % FREE_TOPICS.length) + FREE_TOPICS.length) % FREE_TOPICS.length];
  }

  const sixHourBucket = Math.floor(Date.now() / (6 * 60 * 60 * 1000));
  return FREE_TOPICS[sixHourBucket % FREE_TOPICS.length];
}

const FREE_TOPICS = [
  {
    title: "전세 계약 전 꼭 확인해야 할 기본 순서",
    summary: "전세 계약을 앞두고 등기, 보증금, 대출, 보증보험을 어떤 순서로 확인하면 좋은지 정리했습니다.",
    tags: ["전세", "계약체크"],
    intro: "전세 계약은 집을 고르는 일보다 확인해야 할 서류와 조건이 더 중요할 때가 많습니다. 마음에 드는 집을 찾았더라도 권리 관계, 보증금 규모, 대출 가능 여부, 보증보험 가입 가능성을 차례로 점검하지 않으면 나중에 불편한 상황이 생길 수 있습니다.",
    references: [
      {
        title: "전세 계약 전 등기부등본 확인",
        url: "https://www.iros.go.kr",
        snippet: "소유자, 근저당, 가압류 등 권리 관계를 확인할 때 가장 먼저 보는 자료입니다.",
      },
      {
        title: "전세보증금 반환보증 안내",
        url: "https://www.khug.or.kr",
        snippet: "보증보험 가입 가능 여부와 보증 한도를 확인할 때 참고할 수 있습니다.",
      },
    ],
    sections: [
      {
        heading: "등기부등본은 계약 전후로 두 번 본다",
        paragraphs: [
          "등기부등본은 계약 직전에 한 번만 보는 자료가 아닙니다. 처음 집을 볼 때 소유자가 누구인지, 근저당이나 가압류 같은 권리가 있는지 확인하고, 잔금일 직전에도 다시 확인하는 편이 좋습니다. 짧은 기간에도 권리 변동이 생길 수 있기 때문에 마지막 확인이 생각보다 중요합니다.",
          "특히 보증금이 매매가에 비해 높은 집은 더 조심해서 봐야 합니다. 단순히 집주인이 괜찮아 보인다는 느낌보다, 서류상 권리 순위와 보증금 회수 가능성을 기준으로 판단해야 합니다.",
        ],
      },
      {
        heading: "보증보험은 가능 여부부터 확인한다",
        paragraphs: [
          "전세보증금 반환보증은 모든 집이 자동으로 가입되는 상품이 아닙니다. 주택 유형, 보증금, 선순위 채권, 임대인의 상태에 따라 가입 가능 여부가 달라집니다. 계약서를 쓰기 전에 조건을 먼저 확인해야 계약 후 난감한 상황을 줄일 수 있습니다.",
          "보증보험이 어렵다면 그 이유가 무엇인지도 살펴봐야 합니다. 단순 서류 문제인지, 보증금과 채권 비율이 부담스러운 구조인지에 따라 판단이 달라지기 때문입니다.",
        ],
      },
      {
        heading: "특약은 짧아도 구체적으로 쓴다",
        paragraphs: [
          "계약서 특약은 길게 쓰는 것보다 구체적으로 쓰는 것이 중요합니다. 잔금 전 권리 변동 금지, 보증보험 가입 협조, 하자 수리 범위, 입주일 조정처럼 실제로 분쟁이 생길 수 있는 항목을 문장으로 남겨두면 이후 대화가 훨씬 명확해집니다.",
          "다만 특약이 모든 문제를 해결해 주는 것은 아닙니다. 효력이 불확실한 문구를 많이 넣는 것보다, 실제 이행 가능한 내용과 증빙 가능한 조건을 중심으로 정리하는 편이 실용적입니다.",
        ],
      },
    ],
    extra: "전세는 가격만 낮다고 좋은 선택이 되지 않습니다. 내가 감당할 수 있는 보증금인지, 퇴거 시점에 돌려받을 구조가 충분히 안정적인지, 대출과 보증보험이 함께 맞물리는지까지 봐야 전체 그림이 보입니다.",
  },
  {
    title: "실거래가와 호가를 같이 봐야 하는 이유",
    summary: "부동산 가격을 볼 때 실거래가와 매물 호가가 왜 다르게 보이는지, 차이를 읽는 기준을 정리했습니다.",
    tags: ["실거래가", "호가"],
    intro: "부동산 가격을 처음 볼 때 가장 헷갈리는 부분은 실거래가와 호가의 차이입니다. 실거래가는 이미 신고된 거래 가격이고, 호가는 현재 매도자가 원하는 가격입니다. 두 숫자가 비슷할 때도 있지만 시장이 흔들리는 구간에서는 차이가 크게 벌어질 수 있습니다.",
    references: [
      {
        title: "국토교통부 실거래가 공개시스템",
        url: "https://rt.molit.go.kr",
        snippet: "실제 신고된 매매와 전월세 거래 사례를 확인할 수 있습니다.",
      },
      {
        title: "한국부동산원 가격동향",
        url: "https://www.reb.or.kr",
        snippet: "지역별 가격 흐름과 통계 자료를 참고할 수 있습니다.",
      },
    ],
    sections: [
      {
        heading: "실거래가는 지나간 가격이다",
        paragraphs: [
          "실거래가는 실제 거래가 있었다는 점에서 신뢰도가 높지만, 현재 가격을 그대로 말해 주지는 않습니다. 신고 시차가 있고, 거래 당시의 층, 향, 수리 상태, 급매 여부가 모두 반영되어 있기 때문입니다. 같은 단지라도 조건이 다르면 숫자의 의미가 달라집니다.",
          "그래서 실거래가를 볼 때는 최근 한 건만 보지 말고 몇 달 동안의 흐름을 같이 보는 편이 좋습니다. 거래량이 줄었는지, 낮은 가격 거래가 반복되는지, 특정 면적만 움직이는지 확인하면 시장 분위기를 조금 더 현실적으로 볼 수 있습니다.",
        ],
      },
      {
        heading: "호가는 매도자의 기대가 섞인 가격이다",
        paragraphs: [
          "호가는 현재 시장에 나와 있는 가격이지만 반드시 거래될 가격은 아닙니다. 매도자가 급한지, 비슷한 매물이 얼마나 있는지, 최근 거래가와 얼마나 차이가 나는지에 따라 협상 여지가 달라집니다.",
          "호가가 높게 유지된다고 해서 시장이 강하다고 단정하기는 어렵습니다. 반대로 호가가 빠르게 낮아진다면 매도자들이 시장 변화를 받아들이기 시작했다는 신호일 수 있습니다.",
        ],
      },
      {
        heading: "둘 사이의 간격을 보면 분위기가 보인다",
        paragraphs: [
          "실거래가보다 호가가 많이 높다면 매수자는 기다리는 쪽을 선택할 가능성이 커집니다. 반대로 호가가 실거래가 근처까지 내려오고 거래가 다시 생긴다면 가격 눈높이가 맞춰지고 있다고 볼 수 있습니다.",
          "다만 이 차이만으로 매수나 매도를 결정하면 위험합니다. 금리, 입주 물량, 전세가율, 지역 개발 이슈처럼 함께 움직이는 요소가 많기 때문에 숫자는 항상 맥락과 같이 읽어야 합니다.",
        ],
      },
    ],
    extra: "가격 판단은 정답을 맞히는 일이 아니라 위험을 줄이는 일에 가깝습니다. 실거래가, 호가, 거래량, 전세가를 같은 표에 놓고 보면 과장된 말보다 실제 움직임이 먼저 보입니다.",
  },
  {
    title: "청약 공고문을 읽을 때 먼저 볼 항목",
    summary: "청약 공고문에서 일정, 자격, 분양가, 전매 제한을 어떤 순서로 보면 좋은지 정리했습니다.",
    tags: ["청약", "공고문"],
    intro: "청약 공고문은 길고 낯선 표현이 많아서 처음 보면 중요한 부분을 놓치기 쉽습니다. 하지만 순서를 정해 놓고 보면 생각보다 구조가 분명합니다. 일정, 자격, 공급 유형, 분양가, 전매 제한, 자금 계획을 차례대로 확인하면 됩니다.",
    references: [
      {
        title: "청약홈 모집공고",
        url: "https://www.applyhome.co.kr",
        snippet: "아파트 청약 일정과 모집 공고를 확인할 수 있는 공식 서비스입니다.",
      },
      {
        title: "주택도시보증공사 분양보증",
        url: "https://www.khug.or.kr",
        snippet: "분양과 보증 관련 기본 정보를 확인할 수 있습니다.",
      },
    ],
    sections: [
      {
        heading: "일정부터 캘린더에 옮긴다",
        paragraphs: [
          "청약은 날짜를 놓치면 좋은 조건도 의미가 없습니다. 특별공급, 1순위, 2순위, 당첨자 발표, 서류 접수, 계약일을 먼저 캘린더에 적어두는 것이 좋습니다. 특히 서류 제출 기간은 짧은 경우가 있어 미리 준비해야 합니다.",
          "일정 확인이 끝나면 내가 해당하는 공급 유형을 골라야 합니다. 일반공급인지 특별공급인지에 따라 필요한 자격과 서류가 달라지므로, 처음부터 모든 내용을 읽으려고 하기보다 내 조건에 맞는 부분을 중심으로 보는 편이 효율적입니다.",
        ],
      },
      {
        heading: "자격 조건은 애매하면 보수적으로 본다",
        paragraphs: [
          "무주택 기간, 세대주 여부, 청약통장 가입 기간, 지역 거주 요건은 작은 차이로 결과가 달라질 수 있습니다. 애매한 부분이 있으면 유리한 쪽으로 해석하기보다 공고문과 상담 창구를 통해 확인하는 편이 안전합니다.",
          "부적격 당첨은 단순히 이번 기회를 놓치는 것에서 끝나지 않을 수 있습니다. 재당첨 제한이나 청약 제한으로 이어질 수 있으므로, 신청 전 조건 확인을 가장 중요하게 두는 것이 좋습니다.",
        ],
      },
      {
        heading: "분양가는 총비용으로 다시 계산한다",
        paragraphs: [
          "공고문에 나온 분양가만 보고 부담 가능 여부를 판단하면 빠지는 금액이 생길 수 있습니다. 발코니 확장비, 옵션, 취득세, 중도금 이자, 입주 시 필요한 비용까지 합쳐서 봐야 실제 자금 계획이 나옵니다.",
          "대출 가능 금액도 시점과 개인 조건에 따라 달라집니다. 당첨 후에야 자금 부족을 알게 되면 선택지가 줄어들기 때문에 신청 전에 보수적으로 계산해 두는 편이 좋습니다.",
        ],
      },
    ],
    extra: "청약은 경쟁률보다 내 조건을 먼저 보는 것이 중요합니다. 남들이 많이 넣는 단지인지보다 내가 자격을 충족하는지, 계약금과 중도금을 감당할 수 있는지, 입주 시점의 생활 계획과 맞는지가 더 현실적인 기준입니다.",
  },
  {
    title: "월세 집을 볼 때 관리비까지 같이 계산하는 법",
    summary: "월세 매물을 비교할 때 월세만 보지 않고 관리비, 공과금, 옵션 상태를 함께 계산하는 방법을 정리했습니다.",
    tags: ["월세", "관리비"],
    intro: "월세 집을 고를 때 가장 먼저 보이는 숫자는 보증금과 월세입니다. 하지만 실제 매달 나가는 돈은 관리비, 공과금, 주차비, 인터넷 비용까지 더해야 알 수 있습니다. 월세가 낮아 보여도 관리비가 높으면 총비용은 비슷하거나 더 커질 수 있습니다.",
    references: [
      {
        title: "주택임대차 표준계약서 안내",
        url: "https://www.molit.go.kr",
        snippet: "임대차 계약 시 확인할 기본 항목을 참고할 수 있습니다.",
      },
      {
        title: "대법원 인터넷등기소",
        url: "https://www.iros.go.kr",
        snippet: "임대인과 권리 관계 확인에 필요한 등기 정보를 볼 수 있습니다.",
      },
    ],
    sections: [
      {
        heading: "월 고정비를 한 줄로 합친다",
        paragraphs: [
          "매물을 비교할 때는 보증금과 월세만 적지 말고 관리비, 전기, 가스, 수도, 인터넷, 주차비를 함께 적어보는 것이 좋습니다. 이렇게 하면 집마다 실제 부담이 얼마나 다른지 한눈에 보입니다.",
          "관리비에 무엇이 포함되는지도 확인해야 합니다. 어떤 집은 인터넷과 수도가 포함되고, 어떤 집은 공용 관리비만 포함됩니다. 포함 항목이 다르면 같은 관리비라도 체감 비용이 달라집니다.",
        ],
      },
      {
        heading: "옵션 상태는 입주 비용과 연결된다",
        paragraphs: [
          "냉장고, 세탁기, 에어컨, 침대 같은 옵션은 편리하지만 상태가 좋지 않으면 입주 후 비용이 생길 수 있습니다. 작동 여부, 청소 상태, 수리 책임을 계약 전 확인하고 필요한 부분은 사진으로 남겨두는 편이 좋습니다.",
          "옵션이 없는 집은 월세가 낮아도 초기 구매 비용이 들어갑니다. 반대로 옵션이 많은 집은 몸만 들어갈 수 있지만 월세나 관리비가 높을 수 있습니다. 총비용 기준으로 비교해야 판단이 쉬워집니다.",
        ],
      },
      {
        heading: "계약 전 하자와 소음도 확인한다",
        paragraphs: [
          "누수, 곰팡이, 창문 틈, 수압, 배수, 난방은 짧은 방문에서도 확인할 수 있는 항목입니다. 밤 시간 소음이나 주변 생활 환경은 낮에만 보면 놓치기 쉬우므로 가능하다면 다른 시간대도 살펴보는 것이 좋습니다.",
          "작은 하자라도 입주 후에는 책임 소재가 애매해질 수 있습니다. 계약 전 확인한 내용은 문자나 사진으로 남겨두면 나중에 대화가 훨씬 수월합니다.",
        ],
      },
    ],
    extra: "월세 매물은 빠르게 결정해야 할 때가 많지만, 빠른 결정일수록 체크리스트가 필요합니다. 월 고정비, 옵션 상태, 관리비 포함 항목, 계약 조건을 같은 기준으로 비교하면 감으로 고르는 실수를 줄일 수 있습니다.",
  },
  {
    title: "신축과 구축 아파트를 비교할 때 보는 기준",
    summary: "신축과 구축을 선택할 때 가격, 관리비, 위치, 수리비, 생활 편의성을 나눠서 보는 방법을 정리했습니다.",
    tags: ["아파트", "비교"],
    intro: "신축과 구축 아파트는 장단점이 뚜렷합니다. 신축은 설비와 커뮤니티가 좋고, 구축은 입지와 가격 경쟁력이 있는 경우가 많습니다. 어느 쪽이 무조건 낫다고 보기보다 내 생활 방식과 자금 계획에 맞는지 비교해야 합니다.",
    references: [
      {
        title: "공동주택관리정보시스템",
        url: "https://www.k-apt.go.kr",
        snippet: "관리비와 단지 관리 정보를 확인할 때 참고할 수 있습니다.",
      },
      {
        title: "국토교통부 실거래가 공개시스템",
        url: "https://rt.molit.go.kr",
        snippet: "같은 지역의 신축과 구축 거래 가격을 비교할 수 있습니다.",
      },
    ],
    sections: [
      {
        heading: "가격 차이는 초기 비용만 보지 않는다",
        paragraphs: [
          "구축은 매입 가격이 낮아 보여도 수리비가 들어갈 수 있고, 신축은 가격이 높아도 당분간 큰 수리 없이 지낼 수 있습니다. 단순 매매가만 비교하면 실제 부담을 놓치기 쉽습니다.",
          "취득세, 대출 이자, 인테리어 비용, 관리비까지 포함해서 계산하면 선택지가 달라질 수 있습니다. 특히 오래된 집은 배관, 창호, 난방 설비처럼 눈에 잘 보이지 않는 비용까지 고려해야 합니다.",
        ],
      },
      {
        heading: "입지는 매일 쓰는 동선으로 본다",
        paragraphs: [
          "신축이더라도 출퇴근이나 등하교 동선이 불편하면 생활 만족도가 떨어질 수 있습니다. 반대로 구축은 내부가 낡았어도 역, 학교, 병원, 마트 접근성이 좋으면 장점이 큽니다.",
          "지도상 거리보다 실제 걷는 시간과 경사, 횡단보도, 버스 배차를 확인하는 것이 좋습니다. 숫자로는 가까워 보여도 매일 이동하기 불편한 길이 있습니다.",
        ],
      },
      {
        heading: "관리 상태는 단지 분위기를 보여준다",
        paragraphs: [
          "구축을 볼 때는 연식 자체보다 관리 상태가 중요합니다. 외벽, 주차장, 엘리베이터, 공용 복도, 분리수거장, 조경 상태를 보면 단지가 어떻게 관리되는지 어느 정도 알 수 있습니다.",
          "신축도 관리비가 높거나 입주 초기 하자가 남아 있을 수 있습니다. 입주민 커뮤니티나 관리사무소 안내를 통해 실제 생활 불편이 없는지 확인하는 과정이 필요합니다.",
        ],
      },
    ],
    extra: "신축과 구축 선택은 취향의 문제가 아니라 비용과 생활의 균형 문제입니다. 집 안의 새로움, 동네의 편의성, 장기 수리 비용을 함께 놓고 보면 내게 맞는 쪽이 더 또렷해집니다.",
  },
];

function normalizeArticle(article, options, results) {
  const now = new Date();
  const title = cleanText(article.title || `${options.keyword} 흐름 정리`);
  const summary = cleanText(article.summary || `${options.keyword} 관련 확인 기준을 정리했습니다.`);
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
          <span class="mt-1 block text-sm text-zinc-500">생활 정보를 고르는 블로그</span>
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
              <span>공공 자료 참고</span>
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
            <h2 class="text-2xl font-black tracking-tight">참고 자료</h2>
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
    return "<p>참고 자료를 바탕으로 확인 기준을 정리했습니다.</p>";
  }

  return allowed;
}

function plainTextLength(html) {
  const text = String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return text.length;
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

await main();
