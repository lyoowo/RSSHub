import { load } from 'cheerio';

import type { Route } from '@/types';
import ofetch from '@/utils/ofetch';
import { parseDate } from '@/utils/parse-date';

const types = {
    upcoming: { name: 'Upcoming', path: '/en' },
    years: { name: 'All Events', path: '/en/years' },
};

export const route: Route = {
    path: '/:type?',
    name: 'Event List',
    url: 'furrycons.cn',
    maintainers: ['lyoowo'],
    example: '/furrycons',
    parameters: {
        type: '`upcoming` for upcoming events (default), `years` for all events',
    },
    description: 'Furry conventions and events listed on furrycons.cn',
    categories: ['social-media'],
    features: {
        requireConfig: false,
        requirePuppeteer: false,
        antiCrawler: false,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['furrycons.cn/en'],
            target: '/furrycons',
        },
        {
            source: ['furrycons.cn/en/years'],
            target: '/furrycons/years',
        },
    ],
    handler,
};

async function handler(ctx) {
    const type = ctx.req.param('type') ?? 'upcoming';
    const typeInfo = types[type];
    if (!typeInfo) {
        throw new Error(`Invalid type: ${type}. Available types: ${Object.keys(types).join(', ')}`);
    }

    const baseUrl = 'https://furrycons.cn';
    const link = `${baseUrl}${typeInfo.path}`;
    const response = await ofetch(link);
    const $ = load(response);
    const data = JSON.parse($('script#__NEXT_DATA__').text());
    const events = data.props.pageProps.events;

    const items = events.map((event) => {
        const description = [event.organization.name, event.region.localName, event.address, event.scale, event.type].filter(Boolean).join('<br>');

        return {
            title: event.name,
            link: `${baseUrl}/en/${event.organization.slug}/${event.slug}`,
            guid: event.id,
            pubDate: parseDate(event.startAt),
            description,
        };
    });

    return { title: `FurryCons - ${typeInfo.name}`, link, item: items };
}
