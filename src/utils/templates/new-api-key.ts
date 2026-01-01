type NewApiKeyTextParams = {
  name: string;
  key: string;
};

export function createNewApiKeyText(params: NewApiKeyTextParams): string {
  return `Hi ${params.name},

Your API key has been reset. Here's your new key:

API Key: ${params.key}

Your previous key is now inactive. This new key expires in 3 months.

If you didn't request this change, please contact us immediately.

Cheers,
The Close Powerlifting Team
`;
}
