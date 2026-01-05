import "express-session";

export interface SessionUser {
  id: number;
  email: string;
  name: string;
  admin: boolean;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
    oauthState?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user: Pick<User, "id" | "name" | "email">;
    }
  }
}

export interface User {
  id: number;
  name: string;
  email: string;
  api_call_count: number;
  api_key_version: number;
  api_call_limit: number;
  api_key: string | null;
  admin: boolean;
  deleted: boolean;
  verification_token: string | null;
  magic_link_expires_at: string | null;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export type CreateUserInput = Pick<User, "name" | "email"> &
  Partial<Omit<User, "id" | "name" | "email" | "created_at" | "updated_at">>;

export type UpdateUserInput = Partial<Omit<User, "id" | "created_at">>;

export type UserParams = {
  userId: string;
  name: string;
  email: string;
};

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

export interface Federation extends Record<string, string> {
  name: string;
  meetsentered: string;
  status: string;
  newmeetdetection: string;
  resultsformat: string;
  easeofimport: string;
  maintainers: string;
}

export interface StatusData {
  server_version: string;
  meets: string;
  federations: Federation[];
}

export interface Meet extends Record<string, string> {
  federation: string;
  date: string;
  meetname: string;
  location: string;
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

export interface RankingsApiResponse {
  rows: (string | number)[][];
  total_length: number;
}

export interface PersonalBest {
  [key: string]: string;
}

export interface CompetitionResult {
  [key: string]: string;
}

export interface UserProfile {
  name: string;
  username: string;
  sex: string;
  instagram: string;
  instagram_url: string;
  personal_best: PersonalBest[];
  competition_results: CompetitionResult[];
}

export interface RecordCategory {
  title: string;
  records: Record<string, string>[];
}
