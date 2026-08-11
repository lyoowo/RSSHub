import crypto from 'node:crypto';

import { load } from 'cheerio';
import { Agent } from 'undici';

import { config } from '@/config';
import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.studyinchina.edu.cn';

const agent = new Agent({
    connect: {
        // fix unsafe legacy renegotiation disabled
        secureOptions: crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
        rejectUnauthorized: false,
    },
});

const sections = {
    news: { name: '最新资讯', type: '2fe6c123b6924b01a6c7d653240c0dfb' },
    careerfair: { name: '招聘会', type: '9c01f1293290454395cc2409b641f88a' },
    essay: { name: '征文大赛', type: '1481b95096aa4117ab54e3dccca0792b' },
    enterprise: { name: '走进企业', type: 'f18bfb09aa73430d92843115616b44ca' },
    campus: { name: '校园活动', type: 'e11f0bf58ddb4f4b866c2bd5f1628f3b' },
    chineseedu: { name: '国际中文教育', type: '8ec7a15950a9454991190a517565640d' },
};

const sectionPages = {
    news: '/livingInChina/latestNews',
    careerfair: '/livingInChina/colorfulActivities?activeId=tab1',
    essay: '/livingInChina/colorfulActivities?activeId=tab2',
    enterprise: '/livingInChina/colorfulActivities?activeId=tab3',
    campus: '/livingInChina/colorfulActivities?activeId=tab4',
    chineseedu: '/studyOversea/introductionChineseEducation',
};

export const route: Route = {
    path: '/:section',
    name: '栏目',
    url: 'www.studyinchina.edu.cn',
    maintainers: ['lyoowo'],
    example: '/studyinchina/news',
    parameters: {
        section: `栏目，见下表，默认为 \`news\`

| section     | 栏目       |
| ----------- | ---------- |
| news        | 最新资讯   |
| careerfair  | 招聘会     |
| essay       | 征文大赛   |
| enterprise  | 走进企业   |
| campus      | 校园活动   |
| chineseedu  | 国际中文教育 |`,
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: Object.keys(sections).map((key) => ({
        source: [new URL(sectionPages[key], baseUrl).host + sectionPages[key]],
        target: `/studyinchina/${key}`,
    })),
    handler,
};

async function handler(ctx) {
    const section = ctx.req.param('section') ?? 'news';

    if (!Object.keys(sections).includes(section)) {
        throw new Error(`Unsupported section: ${section}`);
    }

    const response = await ofetch(`${baseUrl}/api/lxzgw/cms/GetArticleLst`, {
        method: 'POST',
        dispatcher: agent,
        headers: {
            'Content-Type': 'application/json;charset=UTF-8',
            'User-Agent': config.trueUA,
        },
        body: JSON.stringify({ type: sections[section].type, pageNo: 1, pageSize: 20 }),
    });

    const items = response.data.records
        .filter((record) => record.entityType === 'HTML')
        .map((record) => {
            const $ = load(record.content);
            $('img').each((_, img) => {
                const src = $(img).attr('src');
                if (src) {
                    $(img).attr('src', new URL(src, baseUrl).href);
                }
            });
            return {
                title: record.title,
                link: `${baseUrl}/articleDetail?arcId=${record.id}`,
                guid: record.id,
                pubDate: record.showDate ? parseDate(record.showDate) : undefined,
                description: $.html(),
            };
        });

    return {
        title: `${sections[section].name} - 留学中国`,
        link: new URL(sectionPages[section], baseUrl).href,
        item: items,
    };
}
