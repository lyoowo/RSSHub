import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://isc.bit.edu.cn';

const sections = {
    eventsnotices: { name: 'Events & Notices', path: '/eventsnotices/index.htm' },
    xyhd: { name: 'Alumni Events', path: '/Alumninew/xyhd/index.htm' },
    xyfc: { name: 'Alumni Stories', path: '/Alumninew/xyfc/index.htm' },
};

export const route: Route = {
    path: '/isc/:section',
    name: 'News',
    url: 'isc.bit.edu.cn',
    maintainers: ['lyoowo'],
    example: '/bit/isc/eventsnotices',
    parameters: {
        section: `Section of the website, see below.

| eventsnotices | xyhd | xyfc |
| ------------- | ---- | ---- |
| Events & Notices | Alumni Events | Alumni Stories |`,
    },
    description: 'Events, notices and alumni news from the Office of International Students, Beijing Institute of Technology',
    categories: ['university'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: Object.entries(sections).map(([key, { path }]) => ({
        source: [`isc.bit.edu.cn${path}`],
        target: `/bit/isc/${key}`,
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

    const list = $('ul.nl.nl1 li a.nLink')
        .toArray()
        .map((item) => {
            const a = $(item);
            const href = a.attr('href')!;
            const absolute = new URL(href, link);
            return {
                title: a.text().trim(),
                link: absolute.href,
                internal: absolute.origin === baseUrl,
            };
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        list.map((item) => {
            if (!item.internal) {
                return { title: item.title, link: item.link };
            }
            return cache.tryGet(item.link, async () => {
                const detailResponse = await ofetch(item.link);
                const $detail = load(detailResponse);

                const pubDate = $detail('meta[name="PubDate"]').attr('content');
                const contentEl = $detail('.field-item[property="content:encoded"]');
                contentEl.find('img').each((_, img) => {
                    const src = $(img).attr('src');
                    if (src) {
                        $(img).attr('src', new URL(src, item.link).href);
                    }
                });

                return {
                    title: item.title,
                    link: item.link,
                    pubDate: pubDate ? parseDate(pubDate) : undefined,
                    description: contentEl.html() ?? '',
                };
            });
        })
    );

    return {
        title: `${sectionInfo.name} - 北京理工大学留学生中心`,
        link,
        item: items,
    };
}
