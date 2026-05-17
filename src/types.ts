// Shared API response shapes. Per-endpoint request/response types live next
// to their routes. Data-model shapes for the in-memory store live in
// src/data/types.ts.

export interface ApiResponse<T> {
  data: T | null;
  pagination?: Pagination;
}

export interface Pagination {
  items: number;
  pages: number;
  per_page: number;
  current_page: number;
  last_page: number;
  first_page: number;
  from: number;
  to: number;
}

export interface RankingRow {
  id: number;
  rank: number;
  full_name: string;
  username: string;
  user_profile: string;
  country: string;
  location: string;
  fed: string;
  federation_url: string;
  date: string;
  country_two: string;
  state: string;
  meet_code: string;
  meet_url: string;
  sex: string;
  equip: string;
  age: number;
  open: string;
  body_weight: number;
  weight_class: number;
  squat: number;
  bench: number;
  deadlift: number;
  total: number;
  dots: number;
}

export interface RecordCategory {
  title: string;
  records: Record<string, string>[];
}

export interface PersonalBestEntry {
  value: string;
  meet: string;
  date: string;
  federation: string;
}

export interface PersonalBestsByEquipment {
  equipment: string;
  squat: PersonalBestEntry;
  bench: PersonalBestEntry;
  deadlift: PersonalBestEntry;
  total: PersonalBestEntry;
  dots: PersonalBestEntry;
}

export interface ProgressionPoint {
  date: string;
  meet: string;
  federation: string;
  equipment: string;
  weight_class: string;
  bodyweight: string;
  squat: string;
  bench: string;
  deadlift: string;
  total: string;
  dots: string;
  place: string;
}

export interface UserProfile {
  name: string;
  username: string;
  sex: string;
  personal_best: Record<string, string>[];
  competition_results: Record<string, string>[];
}

export interface UserComparisonSummary {
  name: string;
  username: string;
  sex: string;
  total_meets: number;
  best_total: string;
  best_dots: string;
  best_squat: string;
  best_bench: string;
  best_deadlift: string;
  first_meet_date: string;
  last_meet_date: string;
}

export interface SharedMeetEntry {
  date: string;
  meet: string;
  federation: string;
  a_total: string;
  a_dots: string;
  a_place: string;
  b_total: string;
  b_dots: string;
  b_place: string;
}

export interface UserComparison {
  a: UserComparisonSummary;
  b: UserComparisonSummary;
  shared_meets: SharedMeetEntry[];
}

export interface UserRank {
  username: string;
  name: string;
  sex: string;
  best_total: string;
  best_dots: string;
  best_equipment: string;
  best_weight_class: string;
  global_rank: number | null;
}

export interface MeetHighlightLifter {
  place: string;
  name: string;
  sex: string;
  weight_class: string;
  bodyweight: string;
  squat: string;
  bench: string;
  deadlift: string;
  total: string;
  dots: string;
}

export interface MeetHighlights {
  title: string;
  date: string;
  location: string;
  total_lifters: number;
  weight_classes_contested: string[];
  top_by_dots: MeetHighlightLifter[];
  top_by_total: MeetHighlightLifter[];
}

export interface FederationYearStat {
  year: number;
  meets: number;
}

export interface FederationStats {
  federation: string;
  total_meets: number;
  earliest_year: number | null;
  latest_year: number | null;
  meets_by_year: FederationYearStat[];
}

export interface MeetResult extends Record<string, string> {
  rank: string;
  lifter: string;
  sex: string;
  age: string;
  equip: string;
  class: string;
  weight: string;
  squat: string;
  bench: string;
  deadlift: string;
  total: string;
  dots: string;
}

export interface MeetData {
  title: string;
  date: string;
  location: string;
  results: MeetResult[];
}
