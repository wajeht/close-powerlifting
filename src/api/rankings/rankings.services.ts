import Axios from '../../utils/axios';
const api = new Axios(true).instance();

import { getRankingsType } from './rankings.validations';
import { buildPagination } from '../../utils/helpers';

export async function getRankings({
  current_page = 1,
  per_page = 100,
  cache = true,
}: getRankingsType) {
  try {
    const paginationQuery = buildPagination({ current_page, per_page });
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
      cache,
      pagination: {
        items: rankings.total_length,
        pages: Math.floor(rankings.total_length / per_page),
        per_page,
        current_page,
        last_page: Math.floor(rankings.total_length / per_page),
        first_page: 1,
        from: current_page * per_page,
        to: current_page * per_page + per_page,
      },
    };
  } catch (e: any) {
    throw new Error(`Something went wrong while processing rankings data!`);
  }
}
