import { nameToSlug } from "../utils/ingest";

interface LiftSeed {
  name: string;
  sex: string;
  event: string;
  equipment: string;
  age: number | null;
  age_class: string;
  division: string;
  bodyweight_kg: number;
  weight_class_kg: number;
  squat1_kg: number | null;
  squat2_kg: number | null;
  squat3_kg: number | null;
  squat4_kg: number | null;
  bench1_kg: number | null;
  bench2_kg: number | null;
  bench3_kg: number | null;
  bench4_kg: number | null;
  deadlift1_kg: number | null;
  deadlift2_kg: number | null;
  deadlift3_kg: number | null;
  deadlift4_kg: number | null;
  best3_squat_kg: number;
  best3_bench_kg: number;
  best3_deadlift_kg: number;
  total_kg: number;
  place: string;
  dots: number;
  federation: string;
  date: string;
  meet_country: string;
  meet_state: string | null;
  meet_name: string;
}

function makeRow(seed: LiftSeed): LiftSeed & { name_slug: string } {
  return { ...seed, name_slug: nameToSlug(seed.name) };
}

export const johnHaackRows = [
  makeRow({
    name: "John Haack",
    sex: "M",
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
    squat4_kg: null,
    bench1_kg: 230,
    bench2_kg: 245,
    bench3_kg: -260,
    bench4_kg: null,
    deadlift1_kg: 390,
    deadlift2_kg: 410,
    deadlift3_kg: -425,
    deadlift4_kg: null,
    best3_squat_kg: 365,
    best3_bench_kg: 245,
    best3_deadlift_kg: 410,
    total_kg: 1020,
    place: "1",
    dots: 605.4,
    federation: "WRPF",
    date: "2024-05-12",
    meet_country: "USA",
    meet_state: "CA",
    meet_name: "WRPF AMERICAN PRO",
  }),
  makeRow({
    name: "John Haack",
    sex: "M",
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
    squat4_kg: null,
    bench1_kg: 220,
    bench2_kg: 235,
    bench3_kg: -250,
    bench4_kg: null,
    deadlift1_kg: 380,
    deadlift2_kg: 400,
    deadlift3_kg: 420,
    deadlift4_kg: null,
    best3_squat_kg: 355,
    best3_bench_kg: 235,
    best3_deadlift_kg: 420,
    total_kg: 1010,
    place: "1",
    dots: 600.1,
    federation: "USAPL",
    date: "2023-10-15",
    meet_country: "USA",
    meet_state: "TX",
    meet_name: "USAPL Raw Nationals",
  }),
];

export const kristyHawkinsRows = [
  makeRow({
    name: "Kristy Hawkins",
    sex: "F",
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
    squat4_kg: null,
    bench1_kg: 120,
    bench2_kg: 130,
    bench3_kg: -140,
    bench4_kg: null,
    deadlift1_kg: 230,
    deadlift2_kg: 245,
    deadlift3_kg: -255,
    deadlift4_kg: null,
    best3_squat_kg: 232.5,
    best3_bench_kg: 130,
    best3_deadlift_kg: 245,
    total_kg: 607.5,
    place: "1",
    dots: 612.3,
    federation: "WRPF",
    date: "2024-05-12",
    meet_country: "USA",
    meet_state: "CA",
    meet_name: "WRPF AMERICAN PRO",
  }),
  makeRow({
    name: "Kristy Hawkins",
    sex: "F",
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
    squat4_kg: null,
    bench1_kg: 115,
    bench2_kg: 125,
    bench3_kg: -135,
    bench4_kg: null,
    deadlift1_kg: 220,
    deadlift2_kg: 235,
    deadlift3_kg: 245,
    deadlift4_kg: null,
    best3_squat_kg: 225,
    best3_bench_kg: 125,
    best3_deadlift_kg: 245,
    total_kg: 595,
    place: "1",
    dots: 605.0,
    federation: "USAPL",
    date: "2023-09-20",
    meet_country: "USA",
    meet_state: "TX",
    meet_name: "USAPL Raw Pro",
  }),
];

export const liftSeedRows = [...johnHaackRows, ...kristyHawkinsRows];
