import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: ({ image }) =>
    z.object({
      date: z.coerce.date(),
      author: z.string(),
      location: z
        .object({
          lat: z.number(),
          lng: z.number(),
          name: z.string(),
        })
        .optional(),
      tags: z.array(z.string()).optional().default([]),
      images: z
        .array(
          z.object({
            src: image(),
            width: z.number(),
            height: z.number(),
          }),
        )
        .optional()
        .default([]),
    }),
});

export const collections = { posts };
