import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const sections = {
    latest: { name: 'Latest', path: 'latest.html' },
    global: { name: 'Global', path: 'global.html' },
    gallery: { name: 'Gallery', path: 'gallery.html' },
    academics: { name: 'Academics', path: 'academics.html' },
    researchhighlights: { name: 'Research Highlights', path: 'researchhighlights.html' },
    undergraduate: { name: 'Undergraduate', path: 'undergraduate.html' },
    postgraduate: { name: 'Postgraduate', path: 'postgraduate.html' },
    summerandwinterprograms: { name: 'Summer and Winter Programs', path: 'summerandwinterprograms.html' },
    exchangeandstudyabroad: { name: 'Exchange and Study Abroad', path: 'exchangeandstudyabroad.html' },
    confuciusinstitute: { name: 'Confucius Institute', path: 'confuciusinstitute.html' },
    careers: { name: 'Careers', path: 'careers.html' },
    whychoosebit: { name: 'Why Choose BIT', path: 'whychoosebit.html' },
    officeofadmissions: { name: 'Office of Admissions', path: 'officeofadmissions.html' },
};

export const route: Route = {
    path: '/english/:section',
    name: 'News',
    url: 'english.bit.edu.cn',
    maintainers: ['lyoowo'],
    example: '/bit/english/latest',
    parameters: {
        section: `Section of the website, see below.

| latest | global | gallery | academics | researchhighlights |
| ------ | ------ | ------- | --------- | ------------------ |
| undergraduate | postgraduate | summerandwinterprograms | exchangeandstudyabroad | confuciusinstitute |
| careers | whychoosebit | officeofadmissions | | |`,
    },
    description: 'News and updates from english.bit.edu.cn',
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
        source: [`english.bit.edu.cn/${path}`],
        target: `/bit/english/${key}`,
    })),
    handler,
};

async function handler(ctx) {
    const section = ctx.req.param('section');
    const sectionInfo = sections[section];
    if (!sectionInfo) {
        throw new Error(`Invalid section: ${section}. Available sections: ${Object.keys(sections).join(', ')}`);
    }

    const baseUrl = 'https://english.bit.edu.cn';
    const link = `${baseUrl}/${sectionInfo.path}`;
    const response = await ofetch(link);
    const $ = load(response);

    const items = $('.List_Content li')
        .toArray()
        .map((item) => {
            const $item = $(item);
            const a = $item.find('h4 a');
            if (!a.length) {
                return null;
            }
            const h6 = $item.find('h6').text().trim();
            return {
                title: a.text().trim(),
                link: new URL(a.attr('href')!, baseUrl).href,
                description: $item.find('h5').text().trim(),
                ...(h6 && { pubDate: parseDate(h6) }),
            };
        })
        .filter((item) => item !== null);

    return { title: `BIT English - ${sectionInfo.name}`, link, item: items };
}
