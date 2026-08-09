import crypto from 'node:crypto';

import { load } from 'cheerio';
import { Agent } from 'undici';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const baseUrl = 'https://france.lxgz.org.cn';

const agent = new Agent({
    connect: {
        // fix unsafe legacy renegotiation disabled
        secureOptions: crypto.constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION,
        rejectUnauthorized: false,
    },
});

const sections = {
    lxzg: { name: 'Études en Chine', path: '/france/lxzg/index.html' },
    xwdt: { name: '新闻动态', path: '/france/xwdt/index.html' },
    tzgg: { name: '通知公告', path: '/france/tzgg/index.html' },
    lxels: { name: '留学法国', path: '/france/lxels/index.html' },
    zehzjl: { name: '教育交流', path: '/france/zehzjl/index.html' },
    gjzwjy1: { name: '国际中文教育', path: '/france/gjzwjy1/index.html' },
    jysx: { name: '招聘信息', path: '/france/jysx/index.html' },
};

export const route: Route = {
    path: '/:section',
    name: '栏目',
    url: 'france.lxgz.org.cn',
    maintainers: ['lyoowo'],
    example: '/lxgz/xwdt',
    parameters: {
        section: `栏目，见下表，默认为 \`xwdt\`

| section  | 栏目       |
| -------- | ---------- |
| lxzg     | Études en Chine |
| xwdt     | 新闻动态   |
| tzgg     | 通知公告   |
| lxels    | 留学法国   |
| zehzjl   | 教育交流   |
| gjzwjy1  | 国际中文教育 |
| jysx     | 招聘信息   |`,
    },
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: Object.entries(sections).map(([key, value]) => ({
        source: [new URL(value.path, baseUrl).host + value.path],
        target: `/lxgz/${key}`,
    })),
    handler,
};

async function handler(ctx) {
    const section = ctx.req.param('section') ?? 'xwdt';

    if (!Object.keys(sections).includes(section)) {
        throw new Error(`Unsupported section: ${section}`);
    }

    const url = new URL(sections[section].path, baseUrl);
    const response = await ofetch(url.href, { dispatcher: agent });
    const $ = load(response);

    const items = $('ul.listCon > li.clearfix')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const a = $item.find('a[href][title]');
            return {
                title: a.attr('title') ?? a.text().trim(),
                link: new URL(a.attr('href')!, baseUrl).href,
                pubDate: parseDate($item.find('span').text()),
            };
        });

    return {
        title: `${sections[section].name} - 驻法国大使馆教育处`,
        link: url.href,
        item: items,
    };
}
