type ContactTextParams = {
  name: string;
  email: string;
  message: string;
};

export function createContactText(params: ContactTextParams): string {
  return `New Contact Request

Name: ${params.name}
Email: ${params.email}

Message:
${params.message}
`;
}
