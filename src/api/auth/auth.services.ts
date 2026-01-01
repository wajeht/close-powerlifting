import axios from "axios";
import qs from "qs";

import { oauthConfig } from "../../config/constants";
import logger from "../../utils/logger";

export interface GoogleOauthToken {
  access_token: string;
  id_token: string;
  expires_in: number;
  refresh_token: string;
  token_type: string;
  scope: string;
}

export interface GoogleUserResult {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
}

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string;
  email: string;
}

export type GitHubOauthToken = {
  access_token: string;
};

export async function getGoogleOauthToken({ code }: { code: string }): Promise<GoogleOauthToken> {
  const rootURl = "https://oauth2.googleapis.com/token";

  const options = {
    code,
    client_id: oauthConfig.google.client_id,
    client_secret: oauthConfig.google.client_secret,
    redirect_uri: oauthConfig.google.oauth_redirect_url,
    grant_type: "authorization_code",
  };

  try {
    const { data } = await axios.post<GoogleOauthToken>(rootURl, qs.stringify(options), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    return data;
  } catch (error: any) {
    logger.error("Failed to fetch Google Oauth Tokens");
    throw error;
  }
}

export async function getGoogleUser({
  id_token,
  access_token,
}: {
  id_token: string;
  access_token: string;
}): Promise<GoogleUserResult> {
  try {
    const { data } = await axios.get<GoogleUserResult>(
      `https://www.googleapis.com/oauth2/v1/userinfo?alt=json&access_token=${access_token}`,
      {
        headers: {
          Authorization: `Bearer ${id_token}`,
        },
      },
    );

    return data;
  } catch (error: any) {
    logger.error("Failed to fetch Google User info");
    throw error;
  }
}

type Email = {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
};

export async function getGithubUserEmails({
  access_token,
}: {
  access_token: string;
}): Promise<Email[]> {
  try {
    const { data } = await axios.get<Email[]>("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    return data;
  } catch (error: any) {
    logger.error("Failed to fetch Github User emails");
    throw error;
  }
}

export async function getGithubUser({
  access_token,
}: {
  access_token: string;
}): Promise<GitHubUser> {
  try {
    const { data } = await axios.get<GitHubUser>("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    return data;
  } catch (error: any) {
    logger.error("Failed to fetch Github User info");
    throw error;
  }
}

export async function getGithubOauthToken({ code }: { code: string }): Promise<GitHubOauthToken> {
  const rootUrl = "https://github.com/login/oauth/access_token";
  const options = {
    client_id: oauthConfig.google.client_id,
    client_secret: oauthConfig.google.client_secret,
    code,
  };

  const queryString = qs.stringify(options);

  try {
    const { data } = await axios.post(`${rootUrl}?${queryString}`, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    const decoded = qs.parse(data) as GitHubOauthToken;

    return decoded;
  } catch (error: any) {
    logger.error("Failed to fetch Github Oauth Tokens");
    throw error;
  }
}
