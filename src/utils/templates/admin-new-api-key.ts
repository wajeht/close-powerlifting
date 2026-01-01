type AdminNewApiKeyParams = {
  name: string;
  password: string;
  apiKey: string;
};

export function createAdminNewApiKeyText(params: AdminNewApiKeyParams): string {
  return `Hi ${params.name},

Here are your credentials to access Close Powerlifting:

Admin Password: ${params.password}

API Key: ${params.apiKey}

- The Close Powerlifting Team
`;
}
