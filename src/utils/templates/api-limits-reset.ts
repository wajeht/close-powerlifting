type ApiLimitResetTextParams = {
  name: string;
};

export function createApiLimitResetText(params: ApiLimitResetTextParams): string {
  return `Hi ${params.name},

Good news! Your API limit has been reset and you're back to full capacity.

Thanks for using Close Powerlifting. Happy lifting!

Cheers,
The Close Powerlifting Team
`;
}
