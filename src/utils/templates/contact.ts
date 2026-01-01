type ContactParams = {
  name: string;
  email: string;
  message: string;
};

export function createContactText(params: ContactParams): string {
  return `New Contact Request

Name: ${params.name}
Email: ${params.email}

Message:
${params.message}
`;
}
