type param = {
  name: string;
  key: string;
};

export default function newAPIKeyHTML(param: param): string {
  return `
  <div>
    <p>Hi ${param.name},</p>
    <br>

    <p>We've received a request to reset a new api key. Here below is your API key to access Close Powerlifting!</p>

    <br>
    <div style="background: #171717; text-decoration: none; color: white; display:inline-block; padding: 5px;">${param.key}</div>
    <br>

    <br>
    <p>Welcome to the Close Powerlifting,</p>
    <p>Let's make all kinds of gains. All kindszzzz.!</p>
  </div>
  `;
}
