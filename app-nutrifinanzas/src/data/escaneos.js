// "Tickets" preparados de antemano que el escáner SIMULADO rellena al azar.
// No hay OCR real: tras un spinner de ~1,5s elegimos uno de estos y se rellena el formulario.

export const ESCANEOS_SIMULADOS = [
  {
    titulo: 'Ticket Mercadona',
    supermercado: 'Mercadona',
    alimento: {
      nombre: 'Salmón fresco',
      cantidad: '500 g',
      kcal: 208,
      precio: 7.45,
      categoria: 'Proteínas',
    },
  },
  {
    titulo: 'Ticket Lidl',
    supermercado: 'Lidl',
    alimento: {
      nombre: 'Aguacate (2 ud)',
      cantidad: '2 ud',
      kcal: 160,
      precio: 1.79,
      categoria: 'Grasas',
    },
  },
  {
    titulo: 'Ticket Carrefour',
    supermercado: 'Carrefour',
    alimento: {
      nombre: 'Lentejas cocidas (bote)',
      cantidad: '400 g',
      kcal: 116,
      precio: 0.85,
      categoria: 'Hidratos',
    },
  },
]
