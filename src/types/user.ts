export interface User {
  id: string;
  name: string;
  password: string;
  email: string;
  api_call_count: number;
  key: string;
  admin: boolean;
  deleted: boolean;
  verification_token: string;
  verified: boolean;
  verified_at: Date;
  created_at: Date;
}
