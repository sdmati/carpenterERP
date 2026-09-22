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
  await prisma.machine.deleteMany();
  await prisma.user.deleteMany();

  console.log('--- Tworzenie użytkowników z rolami ---');
  const passwordHashAdmin = await bcrypt.hash('admin123', 10);
  const passwordHashSaw = await bcrypt.hash('saw123', 10);
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
    drill: drillUser.username,
    packer: packerUser.username,
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
            materialId: matSonoma.id,
          },
          {
            name: 'Bok prawy',
            quantity: 1,
            length: 720,
            width: 510,
            thickness: 18,
            materialId: matSonoma.id,
          },
          {
            name: 'Wieniec dolny',
            quantity: 1,
            length: 564,
            width: 510,
            thickness: 18,
            materialId: matSonoma.id,
          },
          {
            name: 'Półka wewnętrzna',
            quantity: 1,
            length: 564,
            width: 490,
            thickness: 18,
            materialId: matSonoma.id,
          },
          {
            name: 'Trawers górny',
            quantity: 2,
            length: 564,
            width: 100,
            thickness: 18,
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
