import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://english.beijing.gov.cn';

const sections = {
    news: { name: 'News', path: '/latest/news/' },
    specials: { name: 'Specials', path: '/latest/specials/' },
    programs: { name: 'Short-term Programs News', path: '/studyinginbeijing/programsnews/' },
    voice: { name: 'Student Voice', path: '/studyinginbeijing/studentvoice/' },
    exhibition: { name: 'Exhibition', path: '/whatson/events/exhibition/' },
    performance: { name: 'Performance', path: '/whatson/events/performance/' },
    sports: { name: 'Sports', path: '/whatson/events/sports/' },
    railway: { name: 'Railway', path: '/livinginbeijing/transportation/railway/' },
    airport: { name: 'Airport', path: '/livinginbeijing/transportation/airport/' },
    routes: { name: 'Hot Routes', path: '/travellinginbeijing/routes/' },
    trends: { name: 'Latest Trend', path: '/beijinginfo/sci/latesttrends/' },
    consuming: { name: 'News', path: '/consuminginbeijing/news/' },
    insurance: { name: 'Insurance', path: '/workinginbeijing/laborrights/insurance/' },
};

export const route: Route = {
    path: '/english/:section',
    name: 'Beijing Government English Portal',
    url: 'english.beijing.gov.cn',
    maintainers: ['lyoowo'],
    example: '/gov/beijing/english/news',
    parameters: {
        section: `Section of the website, see below.

| news | specials | programs | voice | exhibition | performance | sports |
| ---- | -------- | -------- | ----- | ---------- | ----------- | ------ |
| News | Specials | Short-term Programs News | Student Voice | Exhibition | Performance | Sports |

| railway | airport | routes | trends | consuming | insurance |
| ------- | ------- | ------ | ------ | --------- | --------- |
| Railway | Airport | Hot Routes | Latest Trend | News | Insurance |`,
    },
    description: 'News and events from the Beijing Government English portal',
    categories: ['government'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: Object.entries(sections).map(([key, { path }]) => ({
        source: [`english.beijing.gov.cn${path}`],
        target: `/gov/beijing/english/${key}`,
    })),
    handler,
};

async function handler(ctx) {
    const section = ctx.req.param('section');
    const sectionInfo = sections[section];
    if (!sectionInfo) {
        throw new Error(`Invalid section: ${section}. Available sections: ${Object.keys(sections).join(', ')}`);
    }

    const link = `${baseUrl}${sectionInfo.path}`;
    const response = await ofetch(link);
    const $ = load(response);

    const list = $('ul.Beijing-list-box-ul li, .Beijing-text-list-start li, .list-con')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const a = $item.find('.Beijing-text-list-title a').first().length
                ? $item.find('.Beijing-text-list-title a').first()
                : $item.find('.list-title a').first().length
                  ? $item.find('.list-title a').first()
                  : $item.find('a').first();
            const href = a.attr('href')!;
            const date = $item.find('span, .list-data').first().text().trim().split(' - ', 1)[0];
            const pubDate = date ? parseDate(date) : undefined;
            return {
                title: a.text().trim(),
                link: new URL(href, link).href,
                pubDate,
            };
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await ofetch(item.link);
                const $detail = load(detailResponse);

                const contentEl = $detail('.Beijing-content-text .view');
                contentEl.find('img').each((_, img) => {
                    const src = $(img).attr('src');
                    if (src) {
                        $(img).attr('src', new URL(src, item.link).href);
                    }
                });

                return {
                    title: item.title,
                    link: item.link,
                    pubDate: item.pubDate,
                    description: contentEl.html() ?? '',
                };
            })
        )
    );

    return {
        title: `${sectionInfo.name} - English.beijing.gov.cn`,
        link,
        item: items,
    };
}
