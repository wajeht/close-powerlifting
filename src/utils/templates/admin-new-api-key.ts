type AdminNewApiKeyTextParams = {
  name: string;
  password: string;
  apiKey: string;
};

export function createAdminNewApiKeyText(params: AdminNewApiKeyTextParams): string {
  return `Hi ${params.name},

Here are your credentials to access Close Powerlifting:

Admin Password: ${params.password}

API Key: ${params.apiKey}

- The Close Powerlifting Team
`;
}
