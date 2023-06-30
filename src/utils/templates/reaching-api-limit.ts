type param = { name: string };

export default function welcomeHTML(param: param): string {
  return `
  <div>
    <p>Hi ${param.name},</p>
    <br>

    <p>Your API calls are reaching the limit of 70. Please optimize your usage to avoid interruptions.</p>

    <br>
    <p>Let us know if you need help</p>
    <p>Let's make all kinds of gains. All kindszzzz.!</p>
  </div>
  `;
}
