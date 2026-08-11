import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://eu.china-mission.gov.cn/eng/';

const sections = {
    mh: { name: 'Mission Headlines', path: './mh/' },
    ChinaEURelations: { name: 'China-EU Relations', path: './ChinaEURelations/' },
    PO: { name: 'China-EU Relations: Politics', path: './ChinaEURelations/PO/' },
    zglx: { name: 'Study in China', path: './zglx/' },
    fyrjh: { name: "Spokesperson's Remarks", path: './fyrjh/' },
    mhs: { name: 'China News', path: './mhs/' },
    Newsletter: { name: 'Newsletter', path: './Newsletter/' },
};

export const route: Route = {
    path: '/:section',
    name: 'News',
    url: 'eu.china-mission.gov.cn',
    maintainers: ['lyoowo'],
    example: '/missionchinaeu/mh',
    parameters: {
        section: `Section of the website, see below.

| mh | ChinaEURelations | PO | zglx | fyrjh | mhs | Newsletter |
| --- | --- | --- | --- | --- | --- | --- |
| Mission Headlines | China-EU Relations | China-EU Relations: Politics | Study in China | Spokesperson's Remarks | China News | Newsletter |`,
    },
    description: "News, statements and remarks from the Mission of the People's Republic of China to the European Union",
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
        source: [`eu.china-mission.gov.cn/eng/${path.slice(2)}`],
        target: `/missionchinaeu/${key}`,
    })),
    handler,
};

async function handler(ctx) {
    const section = ctx.req.param('section');
    const sectionInfo = sections[section];
    if (!sectionInfo) {
        throw new Error(`Invalid section: ${section}. Available sections: ${Object.keys(sections).join(', ')}`);
    }

    const link = new URL(sectionInfo.path, baseUrl).href;
    const response = await ofetch(link);
    const $ = load(response);

    const items = $('li')
        .toArray()
        .flatMap((li) => {
            const $li = $(li);
            const a = $li.find('a[href]').first();
            const href = a.attr('href');
            const dateMatch = $li.text().match(/（(\d{4}-\d{2}-\d{2})）/);
            if (!href || !dateMatch) {
                return [];
            }
            return [
                {
                    title: a.text().trim(),
                    link: new URL(href, link).href,
                    pubDate: parseDate(dateMatch[1]),
                },
            ];
        });

    return {
        title: `${sectionInfo.name} - Mission of China to the EU`,
        link,
        item: items,
    };
}
