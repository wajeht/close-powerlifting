type ReachingApiLimitTextParams = {
  name: string;
  percent: number;
};

export function createReachingApiLimitText(params: ReachingApiLimitTextParams): string {
  return `Hi ${params.name},

Your API calls are reaching ${params.percent}% of your limit. Please optimize your usage to avoid interruptions.

Let us know if you need help.

- The Close Powerlifting Team
`;
}
