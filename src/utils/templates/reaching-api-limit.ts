type param = { name: string; percent: number };

export function createReachingApiLimitHtml(param: param): string {
  return `
  <div>
    <p>Hi ${param.name},</p>
    <br>

    <p>Your API calls are reaching ${param.percent}% of given limit. Please optimize your usage to avoid interruptions.</p>

    <br>
    <p>Let us know if you need help</p>
    <p>Let's make all kinds of gains. All kindszzzz.!</p>
  </div>
  `;
}
