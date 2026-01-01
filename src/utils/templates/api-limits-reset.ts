type ApiLimitResetParams = {
  name: string;
};

export function createApiLimitResetText(params: ApiLimitResetParams): string {
  return `Hi ${params.name},

Your API call limit has been reset. You can now continue using our services without restrictions.

Thank you for using Close Powerlifting!

- The Close Powerlifting Team
`;
}
