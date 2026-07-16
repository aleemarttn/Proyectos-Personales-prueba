import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const camposComunes = {
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  faq: z
    .array(
      z.object({
        pregunta: z.string(),
        respuesta: z.string(),
      }),
    )
    .optional(),
};

const averias = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/averias' }),
  schema: z.object({
    ...camposComunes,
    sistemaAfectado: z.enum([
      'motor',
      'electrico',
      'transmision',
      'aire-acondicionado',
      'suspension',
      'frenos',
      'refrigeracion',
    ]),
    motoresAfectados: z.array(z.enum(['1.6', '1.7-cdti', '1.8', '1.9-cdti'])).optional(),
    kilometrajeYCoste: z.string(),
  }),
});

const motorizaciones = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/motorizaciones' }),
  schema: z.object({
    ...camposComunes,
    motor: z.enum(['1.6', '1.7-cdti', '1.8', '1.9-cdti']),
    potenciaCV: z.number(),
    consumoMedioL100km: z.number(),
    fiabilidad: z.enum(['alta', 'media', 'baja']),
  }),
});

const carrocerias = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/carrocerias' }),
  schema: z.object({
    ...camposComunes,
    variante: z.enum(['opc', 'gtc']),
    numeroPuertas: z.number(),
  }),
});

const mantenimiento = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/mantenimiento' }),
  schema: z.object({
    ...camposComunes,
    tipoTarea: z.enum(['calendario', 'guia-paso-a-paso']),
    kilometrajeServicio: z.number().optional(),
  }),
});

const recursos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/recursos' }),
  schema: z.object({
    ...camposComunes,
    tipoRecurso: z.enum(['esquema-electrico', 'manual-fusibles', 'documentacion']),
  }),
});

export const collections = {
  averias,
  motorizaciones,
  carrocerias,
  mantenimiento,
  recursos,
};
