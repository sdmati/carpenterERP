import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { TaskStatus } from '@prisma/client';

describe('Role-based Task Workflow and Edge Banding (e2e)', () => {
  let app: INestApplication<App>;
  let sawToken: string;
  let edgeToken: string;
  let drillToken: string;
  let packerToken: string;
  let adminToken: string;
  let edgedTaskId: number;
  let uncutTaskId: number;
  let noEdgeTaskId: number;
  let freshOrderId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    // 1. Zaloguj pilarza
    const sawRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'saw_operator', password: 'saw123' })
      .expect(200);
    sawToken = sawRes.body.accessToken;

    // 2. Zaloguj okleiniarza
    const edgeRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'edge_operator', password: 'edge123' })
      .expect(200);
    edgeToken = edgeRes.body.accessToken;

    // 3. Zaloguj wiertacza
    const drillRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'drill_operator', password: 'drill123' })
      .expect(200);
    drillToken = drillRes.body.accessToken;

    // 4. Zaloguj pakowacza
    const packerRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'packer', password: 'packer123' })
      .expect(200);
    packerToken = packerRes.body.accessToken;

    // 5. Zaloguj admina
    const adminRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    adminToken = adminRes.body.accessToken;

    // Utwórz świeże zlecenie ze statusem PENDING do testów workflow
    const productsRes = await request(app.getHttpServer()).get('/products').expect(200);
    const productId = productsRes.body[0].id;

    const freshOrderRes = await request(app.getHttpServer())
      .post('/orders')
      .send({
        productId,
        quantity: 1,
        color: 'SONOMA',
      })
      .expect(201);

    freshOrderId = freshOrderRes.body.id;
    const tasks = freshOrderRes.body.tasks;
    expect(tasks.length).toBeGreaterThanOrEqual(3);

    // Znajdź zadanie dla części wymagającej okleinowania (np. Bok lewy lub Bok prawy)
    const edgedTask = tasks.find(
      (t: any) =>
        t.partDefinition.edgeLength1 ||
        t.partDefinition.edgeLength2 ||
        t.partDefinition.edgeWidth1 ||
        t.partDefinition.edgeWidth2,
    );
    expect(edgedTask).toBeDefined();
    edgedTaskId = edgedTask.id;

    // Znajdź zadanie dla części NIE wymagającej okleinowania (np. Trawers górny)
    const noEdgeTask = tasks.find(
      (t: any) =>
        !t.partDefinition.edgeLength1 &&
        !t.partDefinition.edgeLength2 &&
        !t.partDefinition.edgeWidth1 &&
        !t.partDefinition.edgeWidth2,
    );
    expect(noEdgeTask).toBeDefined();
    noEdgeTaskId = noEdgeTask.id;

    // Pozostałe zadanie do testów blokad (niepocięte)
    const otherTask = tasks.find((t: any) => t.id !== edgedTaskId && t.id !== noEdgeTaskId);
    uncutTaskId = otherTask ? otherTask.id : noEdgeTaskId;
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/me zwraca dane zalogowanego pracownika', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${sawToken}`)
      .expect(200);

    expect(res.body.username).toBe('saw_operator');
    expect(res.body.role).toBe('SAW_OPERATOR');

    const edgeMe = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${edgeToken}`)
      .expect(200);

    expect(edgeMe.body.username).toBe('edge_operator');
    expect(edgeMe.body.role).toBe('EDGE_BANDER_OPERATOR');
  });

  it('Brak tokenu blokuje zmianę statusu (401 Unauthorized)', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${edgedTaskId}/status`)
      .send({ status: TaskStatus.CUT })
      .expect(401);
  });

  describe('Etap 1: Rozkrój (SAW_OPERATOR)', () => {
    it('SAW_OPERATOR może oznaczyć formatkę jako CUT', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ status: TaskStatus.CUT })
        .expect(200);

      expect(res.body.status).toBe(TaskStatus.CUT);
    });

    it('SAW_OPERATOR NIE MOŻE oznaczyć formatki jako EDGED (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ status: TaskStatus.EDGED })
        .expect(403);
    });

    it('SAW_OPERATOR NIE MOŻE oznaczyć formatki jako DRILLED (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ status: TaskStatus.DRILLED })
        .expect(403);
    });

    it('SAW_OPERATOR NIE MOŻE oznaczyć formatki jako COMPLETED (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ status: TaskStatus.COMPLETED })
        .expect(403);
    });
  });

  describe('Etap 2: Okleinowanie (EDGE_BANDER_OPERATOR)', () => {
    it('EDGE_BANDER_OPERATOR NIE MOŻE okleić formatki o statusie PENDING (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${uncutTaskId}/status`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({ status: TaskStatus.EDGED })
        .expect(400);
    });

    it('EDGE_BANDER_OPERATOR NIE MOŻE ustawić statusu CUT (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${uncutTaskId}/status`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({ status: TaskStatus.CUT })
        .expect(403);
    });

    it('EDGE_BANDER_OPERATOR NIE MOŻE ustawić statusu DRILLED (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({ status: TaskStatus.DRILLED })
        .expect(403);
    });

    it('EDGE_BANDER_OPERATOR może oznaczyć wyciętą formatkę (CUT) jako EDGED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({ status: TaskStatus.EDGED })
        .expect(200);

      expect(res.body.status).toBe(TaskStatus.EDGED);
    });
  });

  describe('Etap 3: Wiercenie (DRILL_OPERATOR)', () => {
    it('DRILL_OPERATOR NIE MOŻE nawiercić formatki o statusie PENDING (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${uncutTaskId}/status`)
        .set('Authorization', `Bearer ${drillToken}`)
        .send({ status: TaskStatus.DRILLED })
        .expect(400);
    });

    it('DRILL_OPERATOR NIE MOŻE nawiercić wyciętej formatki (CUT) jeśli wymaga ona oklejenia (400 Bad Request)', async () => {
      // Przestaw zadanie tymczasowo na CUT przez ADMIN
      await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: TaskStatus.CUT })
        .expect(200);

      // Próba wiercenia bezpośrednio po CUT formatki wymagającej oklejenia
      await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${drillToken}`)
        .send({ status: TaskStatus.DRILLED })
        .expect(400);

      // Przywróć stan EDGED
      await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({ status: TaskStatus.EDGED })
        .expect(200);
    });

    it('DRILL_OPERATOR może nawiercić formatkę po oklejeniu (EDGED -> DRILLED)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${drillToken}`)
        .send({ status: TaskStatus.DRILLED })
        .expect(200);

      expect(res.body.status).toBe(TaskStatus.DRILLED);
    });

    it('Formatka bez oklejenia może przejść bezpośrednio z CUT do DRILLED', async () => {
      // 1. Rozkrój przez SAW_OPERATOR
      await request(app.getHttpServer())
        .patch(`/tasks/${noEdgeTaskId}/status`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ status: TaskStatus.CUT })
        .expect(200);

      // 2. Wiercenie bezpośrednio przez DRILL_OPERATOR
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${noEdgeTaskId}/status`)
        .set('Authorization', `Bearer ${drillToken}`)
        .send({ status: TaskStatus.DRILLED })
        .expect(200);

      expect(res.body.status).toBe(TaskStatus.DRILLED);
    });
  });

  describe('Etap 4: Pakowanie (PACKER)', () => {
    it('PACKER NIE MOŻE oznaczyć nienawierconej formatki jako COMPLETED (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .patch(`/tasks/${uncutTaskId}/status`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ status: TaskStatus.COMPLETED })
        .expect(400);
    });

    it('PACKER może oznaczyć nawierconą formatkę (DRILLED) jako COMPLETED', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ status: TaskStatus.COMPLETED })
        .expect(200);

      expect(res.body.status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('ADMIN i ogólne uprawnienia', () => {
    it('ADMIN ma wszystkie uprawnienia i może zmienić status na dowolny', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/tasks/${edgedTaskId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: TaskStatus.PENDING })
        .expect(200);

      expect(res.body.status).toBe(TaskStatus.PENDING);
    });
  });

  describe('Zapotrzebowanie na okleinę (Edge Banding Summary)', () => {
    it('GET /orders/:id/edge-banding zwraca poprawne przeliczenia metrów okleiny dla całego zlecenia', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${freshOrderId}/edge-banding`)
        .expect(200);

      expect(res.body.orderId).toBe(freshOrderId);
      expect(res.body.productName).toBe('Szafka dolna kuchenna 60');
      expect(res.body.totalMeters).toBeGreaterThan(0);
      expect(Array.isArray(res.body.tapeBreakdown)).toBe(true);
      expect(res.body.tapeBreakdown.length).toBeGreaterThan(0);

      // Sprawdź czy podsumowanie taśm zawiera obrzeże ABS
      const absTape = res.body.tapeBreakdown.find((t: any) => t.tapeType === 'ABS');
      expect(absTape).toBeDefined();
      expect(absTape.totalMeters).toBeGreaterThan(0);
      expect(absTape.totalPieces).toBeGreaterThan(0);

      // Sprawdź zadania
      expect(Array.isArray(res.body.tasks)).toBe(true);
      const bokTask = res.body.tasks.find((t: any) => t.partName === 'Bok lewy');
      expect(bokTask).toBeDefined();
      expect(bokTask.requiresEdgeBanding).toBe(true);
      expect(bokTask.edges.edgeLength1).toBe(true);
      expect(bokTask.edges.edgeWidth1).toBe(true);
      expect(bokTask.metersPerPiece).toBe(1.23); // (720 + 510) / 1000 = 1.23 m
    });

    it('GET /tasks/edge-banding zwraca listę partii z wyliczeniami dla okleiniarki', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tasks/edge-banding?orderId=${freshOrderId}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const item = res.body[0];
      expect(item).toHaveProperty('metersPerPiece');
      expect(item).toHaveProperty('totalMeters');
      expect(item).toHaveProperty('edges');
    });

    it('GET /tasks/:id/edge-banding zwraca zapotrzebowanie dla pojedynczej partii', async () => {
      const res = await request(app.getHttpServer())
        .get(`/tasks/${edgedTaskId}/edge-banding`)
        .expect(200);

      expect(res.body.taskId).toBe(edgedTaskId);
      expect(res.body.metersPerPiece).toBeGreaterThan(0);
      expect(res.body.totalMeters).toBeGreaterThan(0);
    });
  });

  describe('Zlecenie: status PACKED dla całego zlecenia dopiero gdy wszystkie części są DRILLED', () => {
    let packOrderId: number;

    beforeAll(async () => {
      const productsRes = await request(app.getHttpServer()).get('/products').expect(200);
      const productId = productsRes.body[0].id;

      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .send({
          productId,
          quantity: 1,
          color: 'SONOMA',
        })
        .expect(201);

      packOrderId = orderRes.body.id;
    });

    it('PACKER NIE MOŻE oznaczyć zlecenia jako PACKED gdy części są PENDING (400 Bad Request)', async () => {
      await request(app.getHttpServer())
        .patch(`/orders/${packOrderId}/status`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ status: 'PACKED' })
        .expect(400);
    });

    it('PACKER NIE MOŻE oznaczyć zlecenia jako PACKED gdy części są CUT lub EDGED, a nie DRILLED (400 Bad Request)', async () => {
      const tasksRes = await request(app.getHttpServer())
        .get(`/orders/${packOrderId}/tasks`)
        .expect(200);

      // Ustaw formatki na EDGED / CUT
      for (const t of tasksRes.body) {
        await request(app.getHttpServer())
          .patch(`/tasks/${t.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: TaskStatus.EDGED })
          .expect(200);
      }

      // Pakowacz próbuje spakować oklejone, ale nienawiercone elementy -> 400 Bad Request
      await request(app.getHttpServer())
        .patch(`/orders/${packOrderId}/status`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ status: 'PACKED' })
        .expect(400);
    });

    it('Gdy wszystkie części zostaną nawiercone (DRILLED), tylko PACKER lub ADMIN może ustawić PACKED', async () => {
      // Nawierć wszystkie części
      const tasksRes = await request(app.getHttpServer())
        .get(`/orders/${packOrderId}/tasks`)
        .expect(200);

      for (const t of tasksRes.body) {
        await request(app.getHttpServer())
          .patch(`/tasks/${t.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: TaskStatus.DRILLED })
          .expect(200);
      }

      // SAW_OPERATOR próbuje spakować zlecenie -> 403 Forbidden
      await request(app.getHttpServer())
        .patch(`/orders/${packOrderId}/status`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ status: 'PACKED' })
        .expect(403);

      // EDGE_BANDER_OPERATOR próbuje spakować zlecenie -> 403 Forbidden
      await request(app.getHttpServer())
        .patch(`/orders/${packOrderId}/status`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({ status: 'PACKED' })
        .expect(403);

      // PACKER oznacza całe zlecenie jako PACKED -> 200 OK!
      const packRes = await request(app.getHttpServer())
        .patch(`/orders/${packOrderId}/status`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ status: 'PACKED' })
        .expect(200);

      expect(packRes.body.status).toBe('PACKED');

      // Sprawdzenie czy zadania w zleceniu zostały ukończone (COMPLETED)
      const updatedTasks = await request(app.getHttpServer())
        .get(`/orders/${packOrderId}/tasks`)
        .expect(200);

      expect(updatedTasks.body.every((t: any) => t.status === TaskStatus.COMPLETED)).toBe(true);
    });
  });

  describe('Lista rozkroju dla SAW_OPERATOR (grupowanie po wymiarach)', () => {
    let testOrderId: number;

    beforeAll(async () => {
      const productsRes = await request(app.getHttpServer()).get('/products').expect(200);
      const productId = productsRes.body[0].id;

      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .send({
          productId,
          quantity: 2,
          color: 'SONOMA',
        })
        .expect(201);

      testOrderId = orderRes.body.id;
    });

    it('GET /orders/:id/cutting-list grupuje części po wymiarach i sumuje ilości', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}/cutting-list`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);

      const group720 = res.body.find(
        (g: any) => g.dimensions.length === 720 && g.dimensions.width === 510,
      );

      expect(group720).toBeDefined();
      expect(group720.totalQuantity).toBe(4);
      expect(group720.pendingQuantity).toBe(4);
      expect(group720.cutQuantity).toBe(0);
      expect(group720.isFullyCut).toBe(false);
      expect(group720.parts).toHaveLength(2);
      expect(group720.parts.map((p: any) => p.partName)).toEqual(
        expect.arrayContaining(['Bok lewy', 'Bok prawy']),
      );
    });

    it('SAW_OPERATOR może oznaczyć całą grupę wymiarową jako CUT jednym żądaniem', async () => {
      const cutRes = await request(app.getHttpServer())
        .patch('/tasks/cutting-list/cut')
        .set('Authorization', `Bearer ${sawToken}`)
        .send({
          orderId: testOrderId,
          length: 720,
          width: 510,
        })
        .expect(200);

      expect(cutRes.body.updatedCount).toBe(2);
      expect(cutRes.body.totalCutQuantity).toBe(4);

      const listRes = await request(app.getHttpServer())
        .get(`/orders/${testOrderId}/cutting-list`)
        .expect(200);

      const group720 = listRes.body.find(
        (g: any) => g.dimensions.length === 720 && g.dimensions.width === 510,
      );

      expect(group720.isFullyCut).toBe(true);
      expect(group720.cutQuantity).toBe(4);
      expect(group720.pendingQuantity).toBe(0);
    });

    it('DRILL_OPERATOR NIE MOŻE wywołać rozkroju grupy (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .patch('/tasks/cutting-list/cut')
        .set('Authorization', `Bearer ${drillToken}`)
        .send({
          orderId: testOrderId,
          length: 564,
          width: 510,
        })
        .expect(403);
    });
  });

  describe('Ręczne wpisywanie zużycia arkuszy płyty (SAW_OPERATOR)', () => {
    let materialId: number;
    let orderForSawId: number;

    beforeAll(async () => {
      const matRes = await request(app.getHttpServer()).get('/materials').expect(200);
      materialId = matRes.body[0].id;

      const prodRes = await request(app.getHttpServer()).get('/products').expect(200);
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .send({
          productId: prodRes.body[0].id,
          quantity: 2,
          color: 'SONOMA',
        })
        .expect(201);
      orderForSawId = orderRes.body.id;
    });

    it('SAW_OPERATOR może wpisać zużycie arkuszy bezpośrednio dla materiału (POST /materials/:id/consume)', async () => {
      const matBefore = await request(app.getHttpServer())
        .get(`/materials/${materialId}`)
        .expect(200);
      const stockBefore = matBefore.body.stockQuantity;

      const res = await request(app.getHttpServer())
        .post(`/materials/${materialId}/consume`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ sheetsCount: 3 })
        .expect(201);

      expect(res.body.sheetsConsumed).toBe(3);
      expect(res.body.previousStock).toBe(stockBefore);
      expect(res.body.currentStock).toBe(stockBefore - 3);

      const matAfter = await request(app.getHttpServer())
        .get(`/materials/${materialId}`)
        .expect(200);
      expect(matAfter.body.stockQuantity).toBe(stockBefore - 3);
    });

    it('SAW_OPERATOR może wpisać zużycie arkuszy powiązane ze zleceniem (POST /orders/:id/consume-sheets)', async () => {
      const orderTasks = await request(app.getHttpServer())
        .get(`/orders/${orderForSawId}/tasks`)
        .expect(200);
      const targetMatId = orderTasks.body[0].partDefinition.materialId;

      const matBefore = await request(app.getHttpServer())
        .get(`/materials/${targetMatId}`)
        .expect(200);
      const stockBefore = matBefore.body.stockQuantity;

      const res = await request(app.getHttpServer())
        .post(`/orders/${orderForSawId}/consume-sheets`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ sheetsCount: 2 })
        .expect(201);

      expect(res.body.orderId).toBe(orderForSawId);
      expect(res.body.sheetsConsumed).toBe(2);
      expect(res.body.orderSheetsUsed).toBe(2);
      expect(res.body.materialRemainingStock).toBe(stockBefore - 2);

      const orderAfter = await request(app.getHttpServer())
        .get(`/orders/${orderForSawId}`)
        .expect(200);
      expect(orderAfter.body.sheetsUsed).toBe(2);
    });

    it('Inne role NIE MOGĄ wpisywać zużycia arkuszy płyty (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post(`/materials/${materialId}/consume`)
        .set('Authorization', `Bearer ${drillToken}`)
        .send({ sheetsCount: 1 })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/materials/${materialId}/consume`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({ sheetsCount: 1 })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/orders/${orderForSawId}/consume-sheets`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ sheetsCount: 1 })
        .expect(403);
    });

    it('Wpisanie liczby arkuszy <= 0 zwraca 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post(`/materials/${materialId}/consume`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ sheetsCount: 0 })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/orders/${orderForSawId}/consume-sheets`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ sheetsCount: -5 })
        .expect(400);
    });

    it('Wpisanie zużycia większego niż stan magazynowy zwraca 400 Bad Request', async () => {
      await request(app.getHttpServer())
        .post(`/materials/${materialId}/consume`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ sheetsCount: 999999 })
        .expect(400);
    });
  });

  describe('Magazyn okleiny (EdgeTape), kalkulacja dostępności i ręczne odliczenie (EDGE_BANDER_OPERATOR)', () => {
    let absSonomaId: number;
    let orderForEdgeId: number;

    beforeAll(async () => {
      const tapesRes = await request(app.getHttpServer()).get('/edge-tapes').expect(200);
      expect(Array.isArray(tapesRes.body)).toBe(true);
      expect(tapesRes.body.length).toBeGreaterThan(0);

      const absSonoma = tapesRes.body.find(
        (t: any) => t.type === 'ABS' && t.color === 'SONOMA' && t.thickness === 1.0,
      );
      expect(absSonoma).toBeDefined();
      absSonomaId = absSonoma.id;

      const prodRes = await request(app.getHttpServer()).get('/products').expect(200);
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .send({
          productId: prodRes.body[0].id,
          quantity: 3,
          color: 'SONOMA',
        })
        .expect(201);
      orderForEdgeId = orderRes.body.id;
    });

    it('GET /edge-tapes zwraca listę oklein z aktualnymi stanami magazynowymi w mb', async () => {
      const res = await request(app.getHttpServer()).get('/edge-tapes').expect(200);
      const tape = res.body.find((t: any) => t.id === absSonomaId);
      expect(tape).toBeDefined();
      expect(tape.stockMeters).toBeGreaterThan(0);
    });

    it('GET /orders/:id/edge-tape-check i GET /orders/:id/edge-banding automatycznie obliczają czy jest wystarczająco okleiny', async () => {
      const checkRes = await request(app.getHttpServer())
        .get(`/orders/${orderForEdgeId}/edge-tape-check`)
        .expect(200);

      expect(checkRes.body.orderId).toBe(orderForEdgeId);
      expect(checkRes.body.isStockSufficient).toBe(true);
      expect(Array.isArray(checkRes.body.tapeBreakdown)).toBe(true);

      const absItem = checkRes.body.tapeBreakdown.find((t: any) => t.tapeType === 'ABS');
      expect(absItem).toBeDefined();
      expect(absItem.isSufficient).toBe(true);
      expect(absItem.missingMeters).toBe(0);
      expect(absItem.availableStockMeters).toBeGreaterThan(absItem.totalMeters);

      // Sprawdź czy GET /orders/:id/edge-banding również zawiera te pola
      const bandingRes = await request(app.getHttpServer())
        .get(`/orders/${orderForEdgeId}/edge-banding`)
        .expect(200);
      expect(bandingRes.body.isStockSufficient).toBe(true);
      expect(bandingRes.body.edgeTapeDeducted).toBe(false);
      expect(bandingRes.body.tapeBreakdown[0].isSufficient).toBe(true);
    });

    it('EDGE_BANDER_OPERATOR może ręcznie odliczyć daną ilość okleiny (POST /edge-tapes/:id/consume)', async () => {
      const tapeBefore = await request(app.getHttpServer())
        .get(`/edge-tapes/${absSonomaId}`)
        .expect(200);
      const stockBefore = tapeBefore.body.stockMeters;

      const res = await request(app.getHttpServer())
        .post(`/edge-tapes/${absSonomaId}/consume`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({
          meters: 12.5,
          reason: 'Odpad przy ustawianiu agregatu frezującego',
        })
        .expect(201);

      expect(res.body.metersConsumed).toBe(12.5);
      expect(res.body.previousStockMeters).toBe(stockBefore);
      expect(res.body.currentStockMeters).toBe(stockBefore - 12.5);
      expect(res.body.reason).toBe('Odpad przy ustawianiu agregatu frezującego');

      const tapeAfter = await request(app.getHttpServer())
        .get(`/edge-tapes/${absSonomaId}`)
        .expect(200);
      expect(tapeAfter.body.stockMeters).toBe(stockBefore - 12.5);
    });

    it('Inne role NIE MOGĄ ręcznie odliczać okleiny (403 Forbidden)', async () => {
      await request(app.getHttpServer())
        .post(`/edge-tapes/${absSonomaId}/consume`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ meters: 5 })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/edge-tapes/${absSonomaId}/consume`)
        .set('Authorization', `Bearer ${drillToken}`)
        .send({ meters: 5 })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/orders/${orderForEdgeId}/deduct-edge-tape`)
        .set('Authorization', `Bearer ${packerToken}`)
        .expect(403);
    });

    it('EDGE_BANDER_OPERATOR może ręcznie odliczyć okleinę dla konkretnego zlecenia (POST /orders/:id/deduct-edge-tape)', async () => {
      await request(app.getHttpServer())
        .get(`/orders/${orderForEdgeId}/edge-banding`)
        .expect(200);

      const tapeBefore = await request(app.getHttpServer())
        .get(`/edge-tapes/${absSonomaId}`)
        .expect(200);
      const stockBefore = tapeBefore.body.stockMeters;

      const deductRes = await request(app.getHttpServer())
        .post(`/orders/${orderForEdgeId}/deduct-edge-tape`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .expect(201);

      expect(deductRes.body.orderId).toBe(orderForEdgeId);
      expect(deductRes.body.edgeTapeDeducted).toBe(true);
      expect(deductRes.body.deductions.length).toBeGreaterThan(0);

      const absDeduction = deductRes.body.deductions.find((d: any) => d.edgeTapeId === absSonomaId);
      expect(absDeduction).toBeDefined();

      const tapeAfter = await request(app.getHttpServer())
        .get(`/edge-tapes/${absSonomaId}`)
        .expect(200);
      expect(tapeAfter.body.stockMeters).toBeLessThan(stockBefore);

      // Kolejne wywołanie nie dubluje odliczenia
      const secondRes = await request(app.getHttpServer())
        .post(`/orders/${orderForEdgeId}/deduct-edge-tape`)
        .set('Authorization', `Bearer ${edgeToken}`)
        .expect(201);

      expect(secondRes.body.deductions).toHaveLength(0);
      expect(secondRes.body.message).toContain('została już wcześniej odliczona');
    });
  });

  describe('Automatyczne odejmowanie okleiny po ukończeniu serii mebli (PACKED / COMPLETED)', () => {
    let autoOrderId: number;
    let tapeId: number;

    beforeAll(async () => {
      const prodRes = await request(app.getHttpServer()).get('/products').expect(200);
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .send({
          productId: prodRes.body[0].id,
          quantity: 2,
          color: 'SONOMA',
        })
        .expect(201);
      autoOrderId = orderRes.body.id;

      const tapesRes = await request(app.getHttpServer()).get('/edge-tapes').expect(200);
      const absSonoma = tapesRes.body.find(
        (t: any) => t.type === 'ABS' && t.color === 'SONOMA' && t.thickness === 1.0,
      );
      tapeId = absSonoma.id;
    });

    it('Stan okleiny odejmuje się automatycznie po spakowaniu serii mebli (PACKED)', async () => {
      // 1. Nawierć wszystkie części
      const tasksRes = await request(app.getHttpServer())
        .get(`/orders/${autoOrderId}/tasks`)
        .expect(200);

      for (const t of tasksRes.body) {
        await request(app.getHttpServer())
          .patch(`/tasks/${t.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: TaskStatus.DRILLED })
          .expect(200);
      }

      const tapeBefore = await request(app.getHttpServer())
        .get(`/edge-tapes/${tapeId}`)
        .expect(200);
      const stockBefore = tapeBefore.body.stockMeters;

      // 2. PACKER oznacza zlecenie jako PACKED
      await request(app.getHttpServer())
        .patch(`/orders/${autoOrderId}/status`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ status: 'PACKED' })
        .expect(200);

      // 3. Sprawdź czy stan okleiny został automatycznie pomniejszony
      const tapeAfter = await request(app.getHttpServer())
        .get(`/edge-tapes/${tapeId}`)
        .expect(200);
      expect(tapeAfter.body.stockMeters).toBeLessThan(stockBefore);

      // 4. Sprawdź czy zlecenie ma flagę edgeTapeDeducted = true
      const orderAfter = await request(app.getHttpServer())
        .get(`/orders/${autoOrderId}`)
        .expect(200);
      expect(orderAfter.body.edgeTapeDeducted).toBe(true);
    });
  });

  describe('Masowe oznaczanie partii (batch) oraz obsługa DRILL i PACK', () => {
    let batchOrderId: number;

    beforeAll(async () => {
      const prodRes = await request(app.getHttpServer()).get('/products').expect(200);
      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .send({
          productId: prodRes.body[0].id,
          quantity: 1,
          color: 'SONOMA',
        })
        .expect(201);
      batchOrderId = orderRes.body.id;
    });

    it('Pobieranie drilling-list oraz drilling-summary przez query i per-order endpoint', async () => {
      const listByTasks = await request(app.getHttpServer())
        .get(`/tasks/drilling-list?orderId=${batchOrderId}`)
        .expect(200);
      expect(Array.isArray(listByTasks.body)).toBe(true);
      expect(listByTasks.body.length).toBeGreaterThan(0);

      const listByOrders = await request(app.getHttpServer())
        .get(`/orders/${batchOrderId}/drilling-list`)
        .expect(200);
      expect(listByOrders.body.length).toBe(listByTasks.body.length);

      const summaryByTasks = await request(app.getHttpServer())
        .get(`/tasks/drilling-summary?orderId=${batchOrderId}`)
        .expect(200);
      expect(summaryByTasks.body.orderId).toBe(batchOrderId);
      expect(summaryByTasks.body.totalTasksCount).toBe(listByTasks.body.length);

      const summaryByOrders = await request(app.getHttpServer())
        .get(`/orders/${batchOrderId}/drilling-summary`)
        .expect(200);
      expect(summaryByOrders.body.totalTasksCount).toBe(summaryByTasks.body.totalTasksCount);
    });

    it('Pobieranie packing-list oraz packing-summary przez query i per-order endpoint', async () => {
      const listByTasks = await request(app.getHttpServer())
        .get(`/tasks/packing-list?orderId=${batchOrderId}`)
        .expect(200);
      expect(Array.isArray(listByTasks.body)).toBe(true);

      const listByOrders = await request(app.getHttpServer())
        .get(`/orders/${batchOrderId}/packing-list`)
        .expect(200);
      expect(listByOrders.body.length).toBe(listByTasks.body.length);

      const summary = await request(app.getHttpServer())
        .get(`/tasks/packing-summary?orderId=${batchOrderId}`)
        .expect(200);
      expect(summary.body.orderId).toBe(batchOrderId);
      expect(summary.body.packedTasksCount).toBe(0);
    });

    it('Pełny cykl produkcyjny z operacjami hurtowymi: CUT -> batch EDGED -> batch DRILLED -> batch COMPLETED', async () => {
      // 1. Pilarz tnie całe zlecenie (CUT)
      const tasksRes = await request(app.getHttpServer())
        .get(`/orders/${batchOrderId}/tasks`)
        .expect(200);

      for (const t of tasksRes.body) {
        await request(app.getHttpServer())
          .patch(`/tasks/${t.id}/status`)
          .set('Authorization', `Bearer ${sawToken}`)
          .send({ status: TaskStatus.CUT })
          .expect(200);
      }

      // 2. Batch EDGED: Wiertacz nie może oklejać (403)
      await request(app.getHttpServer())
        .patch('/tasks/edge-banding/edge')
        .set('Authorization', `Bearer ${drillToken}`)
        .send({ orderId: batchOrderId })
        .expect(403);

      // Operator okleiniarki wykonuje batch EDGED
      const edgeBatchRes = await request(app.getHttpServer())
        .patch('/tasks/edge-banding/edge')
        .set('Authorization', `Bearer ${edgeToken}`)
        .send({ orderId: batchOrderId })
        .expect(200);
      expect(edgeBatchRes.body.updatedCount).toBeGreaterThan(0);

      // 3. Batch DRILLED: Pilarz nie może wiercić (403)
      await request(app.getHttpServer())
        .patch('/tasks/drilling-list/drill')
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ orderId: batchOrderId })
        .expect(403);

      // Operator wiertarki wykonuje batch DRILLED
      const drillBatchRes = await request(app.getHttpServer())
        .patch('/tasks/drilling-list/drill')
        .set('Authorization', `Bearer ${drillToken}`)
        .send({ orderId: batchOrderId })
        .expect(200);
      expect(drillBatchRes.body.updatedCount).toBeGreaterThan(0);

      // Po nawierceniu drilling-summary pokazuje pełne nawiercenie
      const drillSummary = await request(app.getHttpServer())
        .get(`/tasks/drilling-summary?orderId=${batchOrderId}`)
        .expect(200);
      expect(drillSummary.body.isFullyDrilled).toBe(true);

      // 4. Batch PACK / COMPLETED: Operator wiertarki nie może pakować (403)
      await request(app.getHttpServer())
        .patch('/tasks/packing-list/pack')
        .set('Authorization', `Bearer ${drillToken}`)
        .send({ orderId: batchOrderId })
        .expect(403);

      // Pakowacz wykonuje batch pack (COMPLETED)
      const packBatchRes = await request(app.getHttpServer())
        .patch('/tasks/packing-list/pack')
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ orderId: batchOrderId })
        .expect(200);
      expect(packBatchRes.body.updatedCount).toBeGreaterThan(0);

      // Zlecenie powinno zostać automatycznie ukończone (COMPLETED)
      const orderFinal = await request(app.getHttpServer())
        .get(`/orders/${batchOrderId}`)
        .expect(200);
      expect(orderFinal.body.status).toBe('COMPLETED');
    });

    it('Generic batch-status weryfikuje uprawnienia ról RBAC', async () => {
      // Pakowacz próbuje hurtowo ustawić CUT (403)
      await request(app.getHttpServer())
        .patch('/tasks/batch-status')
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ orderId: batchOrderId, status: TaskStatus.CUT })
        .expect(403);

      // Pilarz próbuje hurtowo ustawić DRILLED (403)
      await request(app.getHttpServer())
        .patch('/tasks/batch-status')
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ orderId: batchOrderId, status: TaskStatus.DRILLED })
        .expect(403);
    });
  });
});
