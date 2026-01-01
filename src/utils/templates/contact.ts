type ContactTextParams = {
  name: string;
  email: string;
  message: string;
};

export function createContactText(params: ContactTextParams): string {
  return `New message from ${params.name} <${params.email}>

${params.message}
`;
}
