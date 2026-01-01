type contact = {
  name: string;
  email: string;
  message: string;
};

export function createContactHtml(contact: contact): string {
  return `
    <div>
      <p><span style="font-weight: bold;">Name:</span> ${contact.name}</p>
      <p><span style="font-weight: bold;">Email:</span> ${contact.email}</p>
      <p><span style="font-weight: bold;">Message:</span> ${contact.message}</p>
    </div>
  `;
}
