import Axios from '../../utils/axios';
import { buildPagination } from '../../utils/helpers';
// @ts-ignore
import redis from '../../utils/redis';
import { getRankType, getRankingsType } from './rankings.validations';

const api = new Axios(false).instance();

export async function fetchRankings(paginationQuery: string) {
  try {
    const rankings = await (await api.get('/rankings' + '?' + paginationQuery)).data;

    // TODO!: there is probably a better way to do this!
    const data = rankings.rows.map((r: any) => {
      return {
        id: r[0],
        rank: r[1],
        full_name: r[2],
        username: r[3],
        user_profile: `/api/users/${r[3]}`,
        instagram: r[4],
        username_color: r[5],
        country: r[6],
        location: r[7],
        fed: r[8],
        date: r[9],
        country_two: r[10],
        state: r[11],
        meet_code: r[12],
        meet_url: `/api/meets/${r[12]}`,
        sex: r[13],
        equip: r[14],
        age: parseInt(r[15]),
        open: r[16],
        body_weight: parseFloat(r[17]),
        weight_class: parseFloat(r[18]),
        squat: parseFloat(r[19]),
        bench: parseFloat(r[20]),
        deadlift: parseFloat(r[21]),
        total: parseFloat(r[22]),
        dots: parseFloat(r[23]),
      };
    });

    return {
      data,
      total_length: rankings?.total_length,
    };
  } catch (e) {
    return null;
  }
}

export async function getRankings({
  current_page = 1,
  per_page = 100,
  cache = true,
}: getRankingsType) {
  try {
    const paginationQuery = buildPagination({ current_page, per_page });

    if (cache === false) {
      const rankings = await fetchRankings(paginationQuery);
      return {
        data: rankings?.data,
        cache,
        pagination: {
          items: rankings?.total_length,
          pages: Math.floor(rankings?.total_length / per_page),
          per_page,
          current_page,
          last_page: Math.floor(rankings?.total_length / per_page),
          first_page: 1,
          from: current_page * per_page,
          to: current_page * per_page + per_page,
        },
      };
    }

    // @ts-ignore
    let rankings = JSON.parse(await redis.get(`close-powerlifting-rankings`));

    if (rankings === null) {
      rankings = await fetchRankings(paginationQuery);
      // @ts-ignore
      const r = await redis.set(`close-powerlifting-rankings`, JSON.stringify(rankings));
    }

    return {
      data: rankings.data,
      cache,
      pagination: {
        items: rankings?.total_length,
        pages: Math.floor(rankings?.total_length / per_page),
        per_page,
        current_page,
        last_page: Math.floor(rankings?.total_length / per_page),
        first_page: 1,
        from: current_page * per_page,
        to: current_page * per_page + per_page,
      },
    };
  } catch (e: any) {
    throw new Error(`Something went wrong while processing rankings data!`);
  }
}

export async function getRank({ rank }: getRankType) {
  let r = parseInt(rank) - 1;

  // pagination
  const cache = false;
  let current_page = 1;
  let per_page = 100;

  // r = 300

  if (r > per_page) {
    current_page = Math.floor(r / per_page);
  }

  // console.log({ rank: r, current_page, per_page });

  const { data } = await getRankings({ cache, current_page, per_page });

  const index = r % per_page;

  // @ts-ignore
  return data.at(index);
}
