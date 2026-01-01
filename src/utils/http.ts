import { config } from "../config";

const defaultHeaders = {
  Cookie: "units=lbs;",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.14; rv:88.0) Gecko/20100101 Firefox/88.0",
  Pragma: "no-cache",
};

export async function fetchApi(path: string): Promise<any> {
  const response = await fetch(`${config.app.apiUrl}${path}`, {
    headers: defaultHeaders,
  });
  return response.json();
}

export async function fetchHtml(path: string): Promise<string> {
  const response = await fetch(`${config.app.baseUrl}${path}`, {
    headers: defaultHeaders,
  });
  return response.text();
}

export async function fetchWithAuth(
  baseUrl: string,
  path: string,
  token: string,
): Promise<{ ok: boolean; url: string; date: string | null }> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    return {
      ok: response.ok,
      url: path,
      date: response.headers.get("date"),
    };
  } catch {
    return {
      ok: false,
      url: path,
      date: new Date().toISOString(),
    };
  }
}

export async function postForm(url: string, body: string): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  return response.json();
}

export async function fetchJson(url: string, headers?: Record<string, string>): Promise<any> {
  const response = await fetch(url, { headers });
  return response.json();
}
