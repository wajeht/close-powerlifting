import type { Knex } from "knex";

import { nameToSlug } from "../utils/ingest";

interface LifterSeed {
  name: string;
  sex: "M" | "F";
  country?: string;
  state?: string;
  instagram?: string;
}

interface FederationSeed {
  code: string;
  parent_code?: string;
}

interface MeetSeed {
  federation_code: string;
  date: string;
  meet_name: string;
  meet_country?: string;
  meet_state?: string;
  sanctioned?: boolean;
}

interface LiftSeed {
  lifter_name: string;
  federation_code: string;
  meet_date: string;
  meet_name: string;
  event: "SBD" | "BD" | "SD" | "SB" | "S" | "B" | "D";
  equipment: "Raw" | "Wraps" | "Single-ply" | "Multi-ply" | "Unlimited" | "Straps";
  age?: number;
  age_class?: string;
  division?: string;
  bodyweight_kg?: number;
  weight_class_kg?: number;
  squat1_kg?: number;
  squat2_kg?: number;
  squat3_kg?: number;
  bench1_kg?: number;
  bench2_kg?: number;
  bench3_kg?: number;
  deadlift1_kg?: number;
  deadlift2_kg?: number;
  deadlift3_kg?: number;
  best3_squat_kg: number;
  best3_bench_kg: number;
  best3_deadlift_kg: number;
  total_kg: number;
  place_rank?: number;
  place_status?: string;
  dots: number;
  wilks?: number;
  glossbrenner?: number;
  goodlift?: number;
  tested?: boolean;
}

const federations: FederationSeed[] = [
  { code: "WRPF" },
  { code: "USAPL" },
];

const lifters: LifterSeed[] = [
  { name: "John Haack", sex: "M", country: "USA", state: "WI" },
  { name: "Kristy Hawkins", sex: "F", country: "USA", state: "GA", instagram: "kristy_hawkins" },
];

const meets: MeetSeed[] = [
  {
    federation_code: "WRPF",
    date: "2024-05-12",
    meet_name: "WRPF AMERICAN PRO",
    meet_country: "USA",
    meet_state: "CA",
    sanctioned: true,
  },
  {
    federation_code: "USAPL",
    date: "2023-10-15",
    meet_name: "USAPL Raw Nationals",
    meet_country: "USA",
    meet_state: "TX",
    sanctioned: true,
  },
  {
    federation_code: "USAPL",
    date: "2023-09-20",
    meet_name: "USAPL Raw Pro",
    meet_country: "USA",
    meet_state: "TX",
    sanctioned: true,
  },
];

const lifts: LiftSeed[] = [
  {
    lifter_name: "John Haack",
    federation_code: "WRPF",
    meet_date: "2024-05-12",
    meet_name: "WRPF AMERICAN PRO",
    event: "SBD",
    equipment: "Raw",
    age: 28,
    age_class: "24-34",
    division: "Open",
    bodyweight_kg: 99.5,
    weight_class_kg: 100,
    squat1_kg: 350,
    squat2_kg: 365,
    squat3_kg: -380,
    bench1_kg: 230,
    bench2_kg: 245,
    bench3_kg: -260,
    deadlift1_kg: 390,
    deadlift2_kg: 410,
    deadlift3_kg: -425,
    best3_squat_kg: 365,
    best3_bench_kg: 245,
    best3_deadlift_kg: 410,
    total_kg: 1020,
    place_rank: 1,
    dots: 605.4,
    tested: false,
  },
  {
    lifter_name: "John Haack",
    federation_code: "USAPL",
    meet_date: "2023-10-15",
    meet_name: "USAPL Raw Nationals",
    event: "SBD",
    equipment: "Raw",
    age: 27,
    age_class: "24-34",
    division: "Open",
    bodyweight_kg: 97,
    weight_class_kg: 100,
    squat1_kg: 340,
    squat2_kg: 355,
    squat3_kg: -370,
    bench1_kg: 220,
    bench2_kg: 235,
    bench3_kg: -250,
    deadlift1_kg: 380,
    deadlift2_kg: 400,
    deadlift3_kg: 420,
    best3_squat_kg: 355,
    best3_bench_kg: 235,
    best3_deadlift_kg: 420,
    total_kg: 1010,
    place_rank: 1,
    dots: 600.1,
    tested: true,
  },
  {
    lifter_name: "Kristy Hawkins",
    federation_code: "WRPF",
    meet_date: "2024-05-12",
    meet_name: "WRPF AMERICAN PRO",
    event: "SBD",
    equipment: "Raw",
    age: 35,
    age_class: "35-39",
    division: "Open",
    bodyweight_kg: 74.5,
    weight_class_kg: 75,
    squat1_kg: 220,
    squat2_kg: 232.5,
    squat3_kg: -245,
    bench1_kg: 120,
    bench2_kg: 130,
    bench3_kg: -140,
    deadlift1_kg: 230,
    deadlift2_kg: 245,
    deadlift3_kg: -255,
    best3_squat_kg: 232.5,
    best3_bench_kg: 130,
    best3_deadlift_kg: 245,
    total_kg: 607.5,
    place_rank: 1,
    dots: 612.3,
    tested: false,
  },
  {
    lifter_name: "Kristy Hawkins",
    federation_code: "USAPL",
    meet_date: "2023-09-20",
    meet_name: "USAPL Raw Pro",
    event: "SBD",
    equipment: "Raw",
    age: 34,
    age_class: "24-34",
    division: "Open",
    bodyweight_kg: 73,
    weight_class_kg: 75,
    squat1_kg: 215,
    squat2_kg: 225,
    squat3_kg: -240,
    bench1_kg: 115,
    bench2_kg: 125,
    bench3_kg: -135,
    deadlift1_kg: 220,
    deadlift2_kg: 235,
    deadlift3_kg: 245,
    best3_squat_kg: 225,
    best3_bench_kg: 125,
    best3_deadlift_kg: 245,
    total_kg: 595,
    place_rank: 1,
    dots: 605.0,
    tested: true,
  },
];

export async function seedLifts(knex: Knex): Promise<void> {
  await knex("lifts").delete();
  await knex("meets").delete();
  await knex("lifters").delete();
  await knex("federations").delete();

  const federationIds = new Map<string, number>();
  for (const fed of federations) {
    const [row] = await knex("federations")
      .insert({
        code: fed.code,
        slug: nameToSlug(fed.code),
        parent_slug: fed.parent_code ? nameToSlug(fed.parent_code) : null,
      })
      .returning("id");
    federationIds.set(fed.code, Number((row as { id: number }).id));
  }

  const lifterIds = new Map<string, number>();
  for (const lifter of lifters) {
    const [row] = await knex("lifters")
      .insert({
        name: lifter.name,
        name_slug: nameToSlug(lifter.name),
        sex: lifter.sex,
        country: lifter.country ?? null,
        state: lifter.state ?? null,
        instagram: lifter.instagram ?? null,
      })
      .returning("id");
    lifterIds.set(lifter.name, Number((row as { id: number }).id));
  }

  const meetIds = new Map<string, number>();
  for (const meet of meets) {
    const federationId = federationIds.get(meet.federation_code)!;
    const [row] = await knex("meets")
      .insert({
        federation_id: federationId,
        date: meet.date,
        meet_name: meet.meet_name,
        meet_slug: nameToSlug(meet.meet_name),
        meet_country: meet.meet_country ?? null,
        meet_state: meet.meet_state ?? null,
        sanctioned: meet.sanctioned ? 1 : 0,
      })
      .returning("id");
    const key = `${meet.federation_code}|${meet.date}|${meet.meet_name}`;
    meetIds.set(key, Number((row as { id: number }).id));
  }

  for (const lift of lifts) {
    const lifterId = lifterIds.get(lift.lifter_name)!;
    const meetId = meetIds.get(`${lift.federation_code}|${lift.meet_date}|${lift.meet_name}`)!;
    await knex("lifts").insert({
      lifter_id: lifterId,
      meet_id: meetId,
      event: lift.event,
      equipment: lift.equipment,
      age: lift.age ?? null,
      age_class: lift.age_class ?? null,
      division: lift.division ?? null,
      bodyweight_kg: lift.bodyweight_kg ?? null,
      weight_class_kg: lift.weight_class_kg ?? null,
      squat1_kg: lift.squat1_kg ?? null,
      squat2_kg: lift.squat2_kg ?? null,
      squat3_kg: lift.squat3_kg ?? null,
      bench1_kg: lift.bench1_kg ?? null,
      bench2_kg: lift.bench2_kg ?? null,
      bench3_kg: lift.bench3_kg ?? null,
      deadlift1_kg: lift.deadlift1_kg ?? null,
      deadlift2_kg: lift.deadlift2_kg ?? null,
      deadlift3_kg: lift.deadlift3_kg ?? null,
      best3_squat_kg: lift.best3_squat_kg,
      best3_bench_kg: lift.best3_bench_kg,
      best3_deadlift_kg: lift.best3_deadlift_kg,
      total_kg: lift.total_kg,
      place_rank: lift.place_rank ?? null,
      place_status: lift.place_status ?? null,
      dots: lift.dots,
      wilks: lift.wilks ?? null,
      glossbrenner: lift.glossbrenner ?? null,
      goodlift: lift.goodlift ?? null,
      tested: lift.tested ? 1 : 0,
    });
  }

  await knex.raw("INSERT INTO lifters_fts(lifters_fts) VALUES('rebuild')");
  await knex.raw("INSERT INTO meets_fts(meets_fts) VALUES('rebuild')");
}
