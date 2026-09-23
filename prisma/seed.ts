import { PrismaClient, Role, Color, TaskStatus, OrderStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Czyszczenie danych testowych ---');
  // Usunięcie powiązanych danych
  await prisma.productionTask.deleteMany();
  await prisma.productionOrder.deleteMany();
  await prisma.partDefinition.deleteMany();
  await prisma.product.deleteMany();
  await prisma.material.deleteMany();
  await prisma.edgeTape.deleteMany();
  await prisma.machine.deleteMany();
  await prisma.user.deleteMany();

  console.log('--- Tworzenie użytkowników z rolami ---');
  const passwordHashAdmin = await bcrypt.hash('admin123', 10);
  const passwordHashSaw = await bcrypt.hash('saw123', 10);
  const passwordHashEdge = await bcrypt.hash('edge123', 10);
  const passwordHashDrill = await bcrypt.hash('drill123', 10);
  const passwordHashPacker = await bcrypt.hash('packer123', 10);

  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      password: passwordHashAdmin,
      name: 'Administrator Główny',
      role: Role.ADMIN,
    },
  });

  const sawUser = await prisma.user.create({
    data: {
      username: 'saw_operator',
      password: passwordHashSaw,
      name: 'Jan Pilarz',
      role: Role.SAW_OPERATOR,
    },
  });

  const edgeUser = await prisma.user.create({
    data: {
      username: 'edge_operator',
      password: passwordHashEdge,
      name: 'Marek Okleiniarz',
      role: Role.EDGE_BANDER_OPERATOR,
    },
  });

  const drillUser = await prisma.user.create({
    data: {
      username: 'drill_operator',
      password: passwordHashDrill,
      name: 'Piotr Wiertacz',
      role: Role.DRILL_OPERATOR,
    },
  });

  const packerUser = await prisma.user.create({
    data: {
      username: 'packer',
      password: passwordHashPacker,
      name: 'Adam Pakowacz',
      role: Role.PACKER,
    },
  });

  console.log('Utworzono użytkowników:', {
    admin: admin.username,
    saw: sawUser.username,
    edge: edgeUser.username,
    drill: drillUser.username,
    packer: packerUser.username,
  });

  console.log('--- Tworzenie maszyn na hali ---');
  await prisma.machine.createMany({
    data: [
      { name: 'Piła panelowa Giben SP', type: 'SAW' },
      { name: 'Okleiniarka Brandt Ambition', type: 'EDGE_BANDER' },
      { name: 'Centrum wiertarskie CNC Biesse Skipper 100', type: 'DRILL' },
    ],
  });

  console.log('--- Tworzenie materiałów magazynowych ---');
  const matSonoma = await prisma.material.create({
    data: {
      name: 'Płyta laminowana Dąb Sonoma 18mm',
      length: 2800,
      width: 2070,
      thickness: 18,
      color: Color.SONOMA,
      stockQuantity: 50,
      stockArea: (2800 * 2070 * 50) / 1_000_000,
    },
  });

  const matWhite = await prisma.material.create({
    data: {
      name: 'Płyta laminowana Biała 18mm',
      length: 2800,
      width: 2070,
      thickness: 18,
      color: Color.WHITE,
      stockQuantity: 80,
      stockArea: (2800 * 2070 * 80) / 1_000_000,
    },
  });

  console.log('--- Tworzenie magazynu okleiny (obrzeża meblowe) ---');
  await prisma.edgeTape.createMany({
    data: [
      {
        name: 'Okleina ABS Dąb Sonoma 1.0mm',
        type: 'ABS',
        color: Color.SONOMA,
        thickness: 1.0,
        width: 22,
        stockMeters: 500,
      },
      {
        name: 'Okleina Melamina Dąb Sonoma 0.8mm',
        type: 'Melamina',
        color: Color.SONOMA,
        thickness: 0.8,
        width: 22,
        stockMeters: 300,
      },
      {
        name: 'Okleina ABS Biała 1.0mm',
        type: 'ABS',
        color: Color.WHITE,
        thickness: 1.0,
        width: 22,
        stockMeters: 400,
      },
      {
        name: 'Okleina Melamina Biała 0.8mm',
        type: 'Melamina',
        color: Color.WHITE,
        thickness: 0.8,
        width: 22,
        stockMeters: 250,
      },
    ],
  });

  console.log('--- Tworzenie katalogu mebli i części ---');
  const product = await prisma.product.create({
    data: {
      name: 'Szafka dolna kuchenna 60',
      parts: {
        create: [
          {
            name: 'Bok lewy',
            quantity: 1,
            length: 720,
            width: 510,
            thickness: 18,
            edgeLength1: true,
            edgeLength2: false,
            edgeWidth1: true,
            edgeWidth2: false,
            edgeTapeType: 'ABS',
            edgeTapeColor: Color.SONOMA,
            edgeTapeThickness: 1.0,
            materialId: matSonoma.id,
          },
          {
            name: 'Bok prawy',
            quantity: 1,
            length: 720,
            width: 510,
            thickness: 18,
            edgeLength1: true,
            edgeLength2: false,
            edgeWidth1: true,
            edgeWidth2: false,
            edgeTapeType: 'ABS',
            edgeTapeColor: Color.SONOMA,
            edgeTapeThickness: 1.0,
            materialId: matSonoma.id,
          },
          {
            name: 'Wieniec dolny',
            quantity: 1,
            length: 564,
            width: 510,
            thickness: 18,
            edgeLength1: true,
            edgeLength2: false,
            edgeWidth1: false,
            edgeWidth2: false,
            edgeTapeType: 'ABS',
            edgeTapeColor: Color.SONOMA,
            edgeTapeThickness: 1.0,
            materialId: matSonoma.id,
          },
          {
            name: 'Półka wewnętrzna',
            quantity: 1,
            length: 564,
            width: 490,
            thickness: 18,
            edgeLength1: true,
            edgeLength2: false,
            edgeWidth1: false,
            edgeWidth2: false,
            edgeTapeType: 'Melamina',
            edgeTapeColor: Color.SONOMA,
            edgeTapeThickness: 0.8,
            materialId: matSonoma.id,
          },
          {
            name: 'Trawers górny',
            quantity: 2,
            length: 564,
            width: 100,
            thickness: 18,
            edgeLength1: false,
            edgeLength2: false,
            edgeWidth1: false,
            edgeWidth2: false,
            materialId: matSonoma.id,
          },
        ],
      },
    },
    include: {
      parts: true,
    },
  });

  console.log('--- Tworzenie przykładowego zlecenia produkcyjnego ---');
  const orderQuantity = 5; // 5 sztuk szafek
  const order = await prisma.productionOrder.create({
    data: {
      productId: product.id,
      quantity: orderQuantity,
      color: Color.SONOMA,
      status: OrderStatus.PENDING,
      tasks: {
        create: product.parts.map((part) => ({
          partDefId: part.id,
          quantity: part.quantity * orderQuantity,
          status: TaskStatus.PENDING,
          barcode: `ORD-001-PART-${part.id}`,
        })),
      },
    },
    include: {
      tasks: {
        include: {
          partDefinition: true,
        },
      },
    },
  });

  console.log(`Zlecenie #${order.id} utworzone z ${order.tasks.length} partiami produkcyjnymi.`);
  console.log('--- Seeding zakończony sukcesem ---');
}

main()
  .catch((e) => {
    console.error('Błąd podczas seedowania:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
