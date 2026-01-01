type AdminNewApiKeyTextParams = {
  name: string;
  password: string;
  apiKey: string;
};

export function createAdminNewApiKeyText(params: AdminNewApiKeyTextParams): string {
  return `Hi ${params.name},

Your admin credentials have been updated:

Password: ${params.password}
API Key: ${params.apiKey}

Please change your password after logging in and store your API key securely.

Cheers,
The Close Powerlifting Team
`;
}
