type ReachingApiLimitTextParams = {
  name: string;
  percent: number;
};

export function createReachingApiLimitText(params: ReachingApiLimitTextParams): string {
  return `Hi ${params.name},

Heads up! You've used ${params.percent}% of your monthly API calls.

A few tips to reduce usage:
- Cache responses when possible
- Use pagination to fetch smaller datasets
- Batch your requests during off-peak hours

Your limit resets at the start of each month. Need a higher limit? Reply to this email and let us know.

Cheers,
The Close Powerlifting Team
`;
}
