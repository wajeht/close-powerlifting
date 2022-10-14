import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { RANKINGS_URL } from '../../config/constants';

import axios from '../../utils/axios';

export async function getRankings(req: Request, res: Response): Promise<any> {
  const x = `?start=0&end=100&lang=en&units=lbs`;
  const { rows, total_length } = await (await axios.get(RANKINGS_URL + x)).data;

  // TODO: there is probably a better way to do this!
  const data = rows.map((r: any) => {
    return {
      id: r[0],
      rank: r[1],
      full_name: r[2],
      username: r[3],
      instagram: r[4],
      username_color: r[5],
      country: r[6],
      location: r[7],
      fed: r[8],
      date: r[9],
      country_two: r[10],
      state: r[11],
      meet_code: r[12],
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

  return res.status(StatusCodes.OK).json({
    status: 'success',
    request_url: req.originalUrl,
    message: 'The resource was returned successfully!',
    data: {
      total: total_length,
      rows: data,
    },
  });
}
