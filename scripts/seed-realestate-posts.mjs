import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "posts");

const posts = [
  {
    slug: "jeonse-contract-checklist-20260702",
    title: "전세 계약 전에 숫자보다 먼저 봐야 할 것들",
    summary: "보증금이 싸 보인다고 바로 좋은 집은 아닙니다. 전세 계약 전에는 등기, 보증보험, 주변 거래 흐름을 먼저 확인해야 합니다.",
    category: "부동산",
    tags: ["전세", "계약", "보증금"],
    readingTime: "4분",
    body: [
      ["p", "전세 글을 검색하면 가장 먼저 보이는 것은 보통 가격입니다. 어느 동네 전세가가 내려갔다, 어느 단지는 아직 높다 같은 이야기죠. 그런데 실제 계약 앞에서는 가격보다 먼저 봐야 할 것들이 있습니다. 싸게 나온 이유가 단순한 시장 흐름인지, 아니면 피해야 할 신호인지 구분해야 합니다."],
      ["h2", "등기부등본은 계약 직전에도 다시 본다"],
      ["p", "전세 계약에서 등기 확인은 한 번으로 끝내기 어렵습니다. 처음 집을 볼 때 괜찮아 보여도 계약 직전 사이에 권리관계가 바뀔 수 있습니다. 소유자, 근저당, 압류 같은 항목은 계약 당일에 다시 확인하는 편이 안전합니다."],
      ["h2", "보증보험 가능 여부를 먼저 묻는다"],
      ["p", "전세보증금 반환보증 가입이 가능한지 확인하는 것도 중요합니다. 가입 가능 여부는 주택 유형, 보증금, 선순위 채권, 임대인 조건 등에 따라 달라질 수 있습니다. 단순히 중개인이 된다고 말했다는 이유만으로 넘기지 말고 직접 확인할 필요가 있습니다."],
      ["h2", "주변 거래 흐름과 너무 다른 매물은 이유를 본다"],
      ["p", "시세보다 많이 낮은 전세는 반가운 매물처럼 보이지만, 이유가 있어 낮을 수도 있습니다. 급하게 세입자를 구하는 상황인지, 집 상태 문제가 있는지, 대출이나 권리관계가 복잡한지까지 같이 봐야 합니다."],
      ["h2", "계약서 특약은 짧아도 구체적으로"],
      ["p", "특약은 길다고 좋은 것이 아닙니다. 잔금 전 권리관계 유지, 보증보험 협조, 미납 관리비 확인처럼 실제로 확인 가능한 내용을 구체적으로 넣는 편이 낫습니다. 애매한 문장은 나중에 서로 다르게 해석될 수 있습니다."],
      ["p", "전세 계약은 마음에 드는 집을 고르는 일인 동시에 리스크를 줄이는 일입니다. 가격을 보기 전에, 내가 돌려받아야 할 돈이 어떤 조건에서 안전해지는지부터 확인하는 습관이 필요합니다."],
    ],
  },
  {
    slug: "actual-price-vs-listing-price-20260702",
    title: "실거래가와 호가를 같이 봐야 하는 이유",
    summary: "매물 가격만 보면 시장을 오해하기 쉽습니다. 실거래가, 호가, 거래량을 함께 봐야 흐름이 조금 더 선명해집니다.",
    category: "부동산",
    tags: ["실거래가", "호가", "시세"],
    readingTime: "4분",
    body: [
      ["p", "부동산 검색을 하다 보면 호가가 내렸다는 말과 실거래가가 버틴다는 말이 동시에 보일 때가 있습니다. 둘 중 하나만 보면 헷갈립니다. 호가는 팔고 싶은 가격이고, 실거래가는 실제로 거래된 가격입니다. 둘 사이의 간격이 시장 분위기를 보여줍니다."],
      ["h2", "호가는 기대가 섞인 숫자다"],
      ["p", "매도자는 보통 조금이라도 더 받고 싶어 합니다. 그래서 호가에는 기대와 협상 여지가 들어갑니다. 매물 가격이 높게 걸려 있다고 해서 그 가격에 거래된다는 뜻은 아닙니다. 반대로 낮은 매물이 보인다고 해서 단지 전체 시세가 바로 내려갔다고 보기도 어렵습니다."],
      ["h2", "실거래가는 늦게 보이는 기록이다"],
      ["p", "실거래가는 실제 거래가 신고된 뒤 확인됩니다. 그래서 현장의 분위기보다 조금 늦게 따라오는 성격이 있습니다. 최근 며칠 사이 분위기를 보려면 매물 변화도 같이 봐야 하고, 지난 흐름을 보려면 실거래가가 더 도움이 됩니다."],
      ["h2", "거래량이 적으면 숫자가 크게 흔들린다"],
      ["p", "거래가 거의 없는 단지에서 한 건의 낮은 거래가 나오면 분위기가 크게 내려간 것처럼 보일 수 있습니다. 반대로 한 건의 높은 거래도 전체 시세를 대표한다고 보기 어렵습니다. 가격만 보지 말고 몇 건이 거래됐는지 함께 확인해야 합니다."],
      ["h2", "같은 평형인지, 같은 조건인지 확인한다"],
      ["p", "동일 단지라도 층, 방향, 수리 상태, 동, 조망에 따라 가격이 달라집니다. 실거래가와 현재 매물을 비교할 때는 면적만 맞출 것이 아니라 조건까지 가능한 한 비슷하게 놓고 봐야 합니다."],
      ["p", "결국 시세는 숫자 하나로 끝나지 않습니다. 호가, 실거래가, 거래량, 매물 수를 나란히 놓고 보면 과하게 낙관적인 글과 과하게 비관적인 글을 걸러내기가 조금 쉬워집니다."],
    ],
  },
  {
    slug: "subscription-notice-reading-20260702",
    title: "청약 공고문에서 먼저 읽어야 할 항목들",
    summary: "청약 글은 요약만 보면 쉬워 보이지만, 실제 판단은 공고문에서 갈립니다. 자격, 일정, 납부 조건을 먼저 확인하세요.",
    category: "부동산",
    tags: ["청약", "공고문", "분양"],
    readingTime: "5분",
    body: [
      ["p", "청약 관련 글은 보기 좋게 요약된 경우가 많습니다. 분양가, 위치, 일정만 보면 금방 판단할 수 있을 것 같죠. 하지만 실제로는 공고문 안의 작은 조건에서 가능 여부가 갈립니다. 요약 글은 출발점으로 보고, 최종 판단은 공고문으로 해야 합니다."],
      ["h2", "신청 자격부터 확인한다"],
      ["p", "지역 거주 요건, 무주택 여부, 세대주 조건, 청약통장 가입 기간은 기본입니다. 특별공급은 유형별 조건이 더 세분화됩니다. 글에서 좋다고 소개한 단지라도 내가 신청할 수 없으면 의미가 없습니다."],
      ["h2", "일정은 접수일만 보지 않는다"],
      ["p", "모집공고일, 특별공급, 일반공급, 당첨자 발표, 서류 제출, 계약일은 모두 연결돼 있습니다. 특히 서류 제출 기간을 놓치면 당첨 이후에도 문제가 생길 수 있습니다. 달력에 한 번에 적어두는 편이 좋습니다."],
      ["h2", "분양가 외 비용을 같이 본다"],
      ["p", "분양가만 보고 자금 계획을 세우면 빠지는 항목이 생깁니다. 발코니 확장, 옵션, 중도금 대출 조건, 계약금 비율, 잔금 일정까지 확인해야 실제 필요한 현금 흐름이 보입니다."],
      ["h2", "입지 평가는 생활 동선으로 다시 본다"],
      ["p", "교통 호재나 개발 계획은 글에서 자주 강조됩니다. 다만 실제 거주라면 출퇴근, 학교, 병원, 장보기, 주차처럼 매일 쓰는 동선이 더 중요할 수 있습니다. 호재와 생활 편의를 분리해서 보는 편이 좋습니다."],
      ["p", "청약은 남들이 많이 본다고 좋은 선택이 되는 구조가 아닙니다. 내가 자격이 되는지, 돈의 흐름이 맞는지, 실제 생활이 가능한지가 먼저입니다."],
    ],
  },
  {
    slug: "new-vs-old-apartment-20260702",
    title: "신축과 구축 아파트를 비교할 때 놓치기 쉬운 차이",
    summary: "신축은 새롭고 편하지만 가격 부담이 크고, 구축은 입지가 좋아도 관리와 수리 비용을 봐야 합니다. 비교 기준을 정리했습니다.",
    category: "부동산",
    tags: ["아파트", "신축", "구축"],
    readingTime: "4분",
    body: [
      ["p", "신축이냐 구축이냐는 부동산 글에서 자주 나오는 비교입니다. 신축은 편하고 깨끗합니다. 구축은 입지가 이미 자리 잡은 경우가 많습니다. 그런데 이 비교는 단순히 새집과 오래된 집의 문제가 아닙니다."],
      ["h2", "신축은 관리 편의와 가격 부담을 같이 본다"],
      ["p", "신축은 커뮤니티, 주차, 보안, 단지 설계가 장점으로 꼽힙니다. 대신 가격에 새 아파트 프리미엄이 들어가 있을 수 있습니다. 주변 구축과의 가격 차이가 생활 편의 차이만큼 납득되는지 따져봐야 합니다."],
      ["h2", "구축은 입지와 수리 상태를 나눠 본다"],
      ["p", "구축은 교통, 학교, 상권이 이미 잡힌 곳이 많습니다. 다만 집 내부 수리, 배관, 주차, 엘리베이터, 단지 관리 상태는 별도로 봐야 합니다. 입지가 좋다는 말이 집 상태까지 좋다는 뜻은 아닙니다."],
      ["h2", "관리비와 장기수선충당금도 비교한다"],
      ["p", "월 관리비는 생각보다 체감이 큽니다. 신축은 시설이 많아 관리비가 높을 수 있고, 구축은 노후 시설 관리 비용이 부담이 될 수 있습니다. 매매가나 전세가만 비교하면 이 부분이 빠집니다."],
      ["h2", "내가 오래 쓸 기능이 무엇인지 정한다"],
      ["p", "아이 학교가 중요한지, 출퇴근 시간이 중요한지, 주차가 중요한지, 집 안 구조가 중요한지에 따라 답이 달라집니다. 다른 사람에게 좋은 아파트가 내 생활에도 좋은 아파트는 아닐 수 있습니다."],
      ["p", "신축과 구축은 어느 한쪽이 무조건 좋다고 말하기 어렵습니다. 가격 차이를 감당할 이유가 있는지, 오래된 단점이 생활에서 얼마나 불편할지 차분히 비교하는 것이 현실적입니다."],
    ],
  },
  {
    slug: "real-estate-outlook-filter-20260702",
    title: "부동산 전망 글을 읽을 때 걸러야 할 표현",
    summary: "전망 글은 자극적인 문장이 많습니다. 오른다, 떨어진다보다 근거와 조건을 먼저 보면 글의 쓸모가 달라집니다.",
    category: "부동산",
    tags: ["전망", "시장", "체크포인트"],
    readingTime: "4분",
    body: [
      ["p", "부동산 전망 글은 클릭하기 좋은 제목이 많습니다. 지금 사야 한다, 더 기다려야 한다, 특정 지역이 뜬다는 식의 문장은 눈에 잘 들어옵니다. 문제는 그런 문장이 실제 판단에 바로 도움이 되지는 않는다는 점입니다."],
      ["h2", "단정적인 표현은 근거를 찾는다"],
      ["p", "무조건, 반드시, 이제 끝났다는 식의 표현은 조심해서 읽는 편이 좋습니다. 좋은 글은 보통 조건을 함께 설명합니다. 금리, 공급, 거래량, 소득, 대출 규제 같은 근거가 빠져 있다면 결론만 강한 글일 수 있습니다."],
      ["h2", "전국 이야기를 내 동네에 바로 적용하지 않는다"],
      ["p", "전국 평균이나 서울 전체 흐름은 큰 방향을 보는 데는 도움이 됩니다. 하지만 실제 선택은 동네와 단지 단위에서 갈립니다. 같은 시장 안에서도 입주 물량, 학군, 교통, 연식에 따라 움직임이 다릅니다."],
      ["h2", "전망보다 가정이 더 중요하다"],
      ["p", "어떤 글이 내린 결론보다 그 결론이 어떤 가정에서 나왔는지가 중요합니다. 금리가 내려간다는 가정인지, 거래량이 회복된다는 가정인지, 공급 부족을 전제로 하는지에 따라 해석이 달라집니다."],
      ["h2", "내 상황과 맞지 않는 조언은 내려놓는다"],
      ["p", "실거주자, 투자자, 갈아타기 수요, 전세 세입자는 보는 기준이 다릅니다. 같은 전망 글도 누구에게 쓰인 글인지에 따라 쓸모가 달라집니다. 내 자금 계획과 거주 목적에 맞는 부분만 가져오는 것이 낫습니다."],
      ["p", "전망 글은 답을 주는 글이 아니라 질문을 남기는 글로 읽는 편이 안전합니다. 좋은 질문이 남으면 다음에 확인할 자료가 보이고, 그때부터 판단이 조금 더 차분해집니다."],
    ],
  },
];

await fs.mkdir(outputDir, { recursive: true });

for (const post of posts) {
  await fs.writeFile(path.join(outputDir, `${post.slug}.html`), renderPost(post), "utf8");
}

await writePostsJson();
await updateHome();
await updateSitemap();

console.log(`[DailyPicker] 부동산 글 ${posts.length}개 생성 완료`);

async function writePostsJson() {
  const filePath = path.join(outputDir, "posts.json");
  let current = [];

  try {
    current = JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    current = [];
  }

  const generated = posts.map((post) => ({
    title: post.title,
    summary: post.summary,
    category: post.category,
    date: "2026-07-02T12:00:00.000Z",
    url: `posts/${post.slug}.html`,
    tags: post.tags,
  }));

  const generatedUrls = new Set(generated.map((post) => post.url));
  const merged = [...generated, ...current.filter((post) => !generatedUrls.has(post.url))];
  await fs.writeFile(filePath, JSON.stringify(merged.slice(0, 50), null, 2), "utf8");
}

async function updateHome() {
  const postsJson = JSON.parse(await fs.readFile(path.join(outputDir, "posts.json"), "utf8"));
  const indexPath = path.join(rootDir, "index.html");
  let html = await fs.readFile(indexPath, "utf8");

  const generatedHtml = postsJson
    .slice(0, 10)
    .map((post) => `            <article data-auto-post>
              <a class="grid gap-4 py-7 transition hover:bg-white sm:grid-cols-[140px_minmax(0,1fr)] sm:px-3" href="${escapeAttribute(post.url)}">
                <span class="text-sm font-black text-emerald-700">${escapeHtml(post.category)}</span>
                <div>
                  <h3 class="text-2xl font-black tracking-tight">${escapeHtml(post.title)}</h3>
                  <p class="mt-2 text-zinc-600">${escapeHtml(post.summary)}</p>
                </div>
              </a>
            </article>`)
    .join("\n");

  const block = `            <!-- AUTO_POSTS_START -->\n${generatedHtml}\n            <!-- AUTO_POSTS_END -->`;

  if (html.includes("<!-- AUTO_POSTS_START -->") && html.includes("<!-- AUTO_POSTS_END -->")) {
    html = html.replace(/            <!-- AUTO_POSTS_START -->[\s\S]*?            <!-- AUTO_POSTS_END -->/, block);
  } else {
    html = html.replace(
      '<div class="divide-y divide-zinc-200 border-y border-zinc-200">',
      `<div class="divide-y divide-zinc-200 border-y border-zinc-200">\n${block}`,
    );
  }

  await fs.writeFile(indexPath, html, "utf8");
}

async function updateSitemap() {
  const sitemapPath = path.join(rootDir, "sitemap.xml");
  let sitemap = await fs.readFile(sitemapPath, "utf8");

  for (const post of posts) {
    const loc = `https://dailypicker.kr/posts/${post.slug}.html`;
    if (sitemap.includes(loc)) continue;
    const entry = `  <url>\n    <loc>${loc}</loc>\n    <lastmod>2026-07-02</lastmod>\n  </url>\n`;
    sitemap = sitemap.replace("</urlset>", `${entry}</urlset>`);
  }

  await fs.writeFile(sitemapPath, sitemap, "utf8");
}

function renderPost(post) {
  const bodyHtml = post.body.map(([tag, text]) => `<${tag}>${escapeHtml(text)}</${tag}>`).join("\n            ");
  const tagsHtml = post.tags
    .map((tag) => `<span class="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">${escapeHtml(tag)}</span>`)
    .join("\n              ");

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(post.title)} | 데일리픽</title>
    <meta name="description" content="${escapeAttribute(post.summary)}" />
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
          <a class="rounded-lg bg-zinc-950 px-3 py-2 text-white" href="#">${escapeHtml(post.category)}</a>
          <a class="rounded-lg px-3 py-2 hover:bg-zinc-100" href="../contact.html">문의</a>
        </nav>
      </aside>

      <main class="flex justify-center px-4 py-8 sm:px-8 lg:px-14 lg:py-14">
        <article class="article-paper w-full max-w-4xl bg-white px-6 py-10 sm:px-12 sm:py-14 lg:px-20 lg:py-20">
          <header class="mx-auto max-w-2xl text-center">
            <p class="text-xs font-black uppercase tracking-[0.22em] text-emerald-700">${escapeHtml(post.category)}</p>
            <h1 class="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl">${escapeHtml(post.title)}</h1>
            <p class="mx-auto mt-5 max-w-xl text-base leading-8 text-zinc-500">${escapeHtml(post.summary)}</p>
            <div class="mt-7 flex flex-wrap items-center justify-center gap-3 text-sm text-zinc-500">
              <span>업데이트 2026.07.02</span>
              <span class="h-1 w-1 rounded-full bg-zinc-300"></span>
              <span>검색 흐름 참고</span>
              <span class="h-1 w-1 rounded-full bg-zinc-300"></span>
              <span>읽는 시간 ${escapeHtml(post.readingTime)}</span>
            </div>
            <div class="mt-6 flex flex-wrap justify-center gap-2">
              ${tagsHtml}
            </div>
          </header>

          <div class="post-content mx-auto mt-14 max-w-2xl">
            ${bodyHtml}
          </div>

          <section class="mx-auto my-14 max-w-2xl border-y border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500" aria-label="광고 영역">
            <p class="font-bold text-zinc-700">Google AdSense 광고</p>
            <ins class="adsbygoogle" style="display: block" data-ad-client="ca-pub-0000000000000000" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins>
          </section>

          <section class="mx-auto mt-14 max-w-2xl bg-zinc-950 px-6 py-7 text-white sm:px-8">
            <p class="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Note</p>
            <h2 class="mt-3 text-2xl font-black tracking-tight">계약 전에는 원자료를 함께 확인하세요</h2>
            <p class="mt-3 leading-7 text-zinc-300">
              이 글은 정보성 글입니다. 실제 계약, 대출, 세금 판단은 공공 자료와 전문가 상담을 함께 확인하는 편이 좋습니다.
            </p>
          </section>
        </article>
      </main>
    </div>
    <script src="../script.js"></script>
  </body>
</html>
`;
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
