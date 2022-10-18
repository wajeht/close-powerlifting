import { z } from 'zod';

export const getRecordsValidation = z.object({
  cache: z
    .string()
    .transform((val) => {
      if (val === 'true') {
        return true;
      }
      if (val === 'false') {
        return false;
      }
    })
    .optional(),
});

export type getRecordsType = z.infer<typeof getRecordsValidation>;
