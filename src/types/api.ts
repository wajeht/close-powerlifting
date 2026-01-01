/**
 * Shared types for OpenPowerlifting API scraping
 */

// Federation data from /status and /mlist pages
export interface Federation extends Record<string, string> {
  name: string;
  meetsentered: string;
  status: string;
  newmeetdetection: string;
  resultsformat: string;
  easeofimport: string;
  maintainers: string;
}

// Status page data
export interface StatusData {
  server_version: string;
  meets: string;
  federations: Federation[];
}

// Meet data from /mlist/{federation} and /m/{meet}
export interface Meet extends Record<string, string> {
  federation: string;
  date: string;
  meetname: string;
  location: string;
}

// Meet result entry from /m/{fed}/{id}
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

// Full meet data with metadata
export interface MeetData {
  title: string;
  date: string;
  location: string;
  results: MeetResult[];
}

// Rankings row from /api/rankings
export interface RankingRow {
  id: number;
  rank: number;
  full_name: string;
  username: string;
  user_profile: string;
  instagram: string;
  instagram_url: string;
  username_color: string;
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

// Raw API response from openpowerlifting
export interface RankingsApiResponse {
  rows: (string | number)[][];
  total_length: number;
}

// User personal best entry
export interface PersonalBest {
  [key: string]: string;
}

// User competition result
export interface CompetitionResult {
  [key: string]: string;
}

// User profile data
export interface UserProfile {
  name: string;
  username: string;
  personal_best: PersonalBest[];
  competition_results: CompetitionResult[];
}

// Record category
export interface RecordCategory {
  title: string;
  records: Record<string, string>[];
}

// Pagination metadata
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

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T | null;
  cache: boolean;
  pagination?: Pagination;
}

// Cache configuration
export interface CacheConfig {
  key: string;
  ttlSeconds?: number;
}
