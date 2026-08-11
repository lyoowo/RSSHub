import { load } from 'cheerio';

import type { Route } from '@/types';
import cache from '@/utils/cache';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://www.wrsa.net';

const sections = {
    toutiao: { name: '头条', node: '1002153' },
    yaowen: { name: '要闻', node: '1009087' },
    huizong: { name: '总会信息', node: '1000566' },
    gonggao: { name: '公告公示', node: '1000591' },
    gedidongtai: { name: '各地动态', node: '1000567' },
    redianjujiao: { name: '热点聚焦', node: '1000568' },
    liuxueshijie: { name: '留学视界', node: '1000602' },
    huiyuanfengcai: { name: '会员风采', node: '1000571' },
    fuwushehui: { name: '服务社会', node: '1000573' },
    minjianwaijiao: { name: '民间外交', node: '1000574' },
    zhengcejiedu: { name: '政策解读', node: '1000570' },
    liuxuexinxi: { name: '留学信息', node: '1000583' },
    haiguigushi: { name: '海归故事', node: '1009301' },
};

const months = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
};

export const route: Route = {
    path: '/:section',
    name: '欧美同学会新闻',
    url: 'www.wrsa.net',
    maintainers: ['lyoowo'],
    example: '/wrsa/liuxueshijie',
    parameters: {
        section: `Section of the website, see below.

| toutiao | yaowen | huizong | gonggao | gedidongtai | redianjujiao | liuxueshijie |
| ------- | ------ | ------- | ------- | ----------- | ------------ | ------------ |
| 头条 | 要闻 | 总会信息 | 公告公示 | 各地动态 | 热点聚焦 | 留学视界 |

| huiyuanfengcai | fuwushehui | minjianwaijiao | zhengcejiedu | liuxuexinxi | haiguigushi |
| -------------- | ---------- | -------------- | ------------ | ----------- | ----------- |
| 会员风采 | 服务社会 | 民间外交 | 政策解读 | 留学信息 | 海归故事 |`,
    },
    description: 'News from Western Returned Scholars Association (欧美同学会) columns',
    categories: ['government'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: Object.entries(sections).map(([key, { node }]) => ({
        source: [`www.wrsa.net/node_${node}.htm`],
        target: `/wrsa/${key}`,
    })),
    handler,
};

async function handler(ctx) {
    const section = ctx.req.param('section');
    const sectionInfo = sections[section];
    if (!sectionInfo) {
        throw new Error(`Invalid section: ${section}. Available sections: ${Object.keys(sections).join(', ')}`);
    }

    const link = `${baseUrl}/node_${sectionInfo.node}.htm`;
    const response = await ofetch(link);
    const $ = load(response);

    const list = $('ul.mylist li.List')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const a = $item.find('dd h2 a');
            const href = a.attr('href')!;
            const absolute = new URL(href, link);
            const pathMatch = absolute.pathname.match(/^\/(\d+)\/(\d{4})\/(\d{2})-(\d{2})\/content_\d+\.htm$/);
            const day = $item.find('span.listtitle em').text().trim();
            const month = months[$item.find('i.month').text().trim()];
            return {
                title: a.text().trim(),
                link: absolute.href,
                pubDate: pathMatch && day && month ? parseDate(`${pathMatch[2]}-${month}-${day}`) : undefined,
            };
        })
        .filter((item) => item.title && item.link);

    const items = await Promise.all(
        list.map((item) =>
            cache.tryGet(item.link, async () => {
                const detailResponse = await ofetch(item.link);
                const $detail = load(detailResponse);

                const contentEl = $detail('#Content');
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
        title: `${sectionInfo.name} - 欧美同学会`,
        link,
        item: items,
    };
}
