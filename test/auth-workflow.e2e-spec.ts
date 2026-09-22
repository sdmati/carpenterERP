import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { TaskStatus } from '@prisma/client';

describe('Role-based Task Workflow (e2e)', () => {
  let app: INestApplication<App>;
  let sawToken: string;
  let drillToken: string;
  let packerToken: string;
  let adminToken: string;
  let taskId: number;
  let uncutTaskId: number;

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

    // 2. Zaloguj wiertacza
    const drillRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'drill_operator', password: 'drill123' })
      .expect(200);
    drillToken = drillRes.body.accessToken;

    // 3. Zaloguj pakowacza
    const packerRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'packer', password: 'packer123' })
      .expect(200);
    packerToken = packerRes.body.accessToken;

    // 4. Zaloguj admina
    const adminRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    adminToken = adminRes.body.accessToken;

    // Pobierz listę zadań ze zlecenia
    const tasksRes = await request(app.getHttpServer())
      .get('/tasks')
      .expect(200);

    expect(tasksRes.body.length).toBeGreaterThanOrEqual(2);
    taskId = tasksRes.body[0].id;
    uncutTaskId = tasksRes.body[1].id;
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
  });

  it('Brak tokenu blokuje zmianę statusu (401 Unauthorized)', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .send({ status: TaskStatus.CUT })
      .expect(401);
  });

  it('SAW_OPERATOR może oznaczyć formatkę jako CUT', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${sawToken}`)
      .send({ status: TaskStatus.CUT })
      .expect(200);

    expect(res.body.status).toBe(TaskStatus.CUT);
  });

  it('SAW_OPERATOR NIE MOŻE oznaczyć formatki jako DRILLED (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${sawToken}`)
      .send({ status: TaskStatus.DRILLED })
      .expect(403);
  });

  it('SAW_OPERATOR NIE MOŻE oznaczyć formatki jako COMPLETED (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${sawToken}`)
      .send({ status: TaskStatus.COMPLETED })
      .expect(403);
  });

  it('DRILL_OPERATOR NIE MOŻE nawiercić niewyciętej formatki (PENDING) (400 Bad Request)', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${uncutTaskId}/status`)
      .set('Authorization', `Bearer ${drillToken}`)
      .send({ status: TaskStatus.DRILLED })
      .expect(400);
  });

  it('DRILL_OPERATOR NIE MOŻE oznaczyć formatki jako CUT (403 Forbidden)', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${uncutTaskId}/status`)
      .set('Authorization', `Bearer ${drillToken}`)
      .send({ status: TaskStatus.CUT })
      .expect(403);
  });

  it('DRILL_OPERATOR może oznaczyć wyciętą formatkę (CUT) jako DRILLED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${drillToken}`)
      .send({ status: TaskStatus.DRILLED })
      .expect(200);

    expect(res.body.status).toBe(TaskStatus.DRILLED);
  });

  it('PACKER NIE MOŻE oznaczyć nienawierconej formatki jako COMPLETED (400 Bad Request)', async () => {
    await request(app.getHttpServer())
      .patch(`/tasks/${uncutTaskId}/status`)
      .set('Authorization', `Bearer ${packerToken}`)
      .send({ status: TaskStatus.COMPLETED })
      .expect(400);
  });

  it('PACKER może oznaczyć nawierconą formatkę (DRILLED) jako COMPLETED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${packerToken}`)
      .send({ status: TaskStatus.COMPLETED })
      .expect(200);

    expect(res.body.status).toBe(TaskStatus.COMPLETED);
  });

  it('ADMIN ma wszystkie uprawnienia i może zmienić status na dowolny', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: TaskStatus.PENDING })
      .expect(200);

    expect(res.body.status).toBe(TaskStatus.PENDING);
  });

  it('Pobieranie zadań/elementów dla konkretnego zlecenia działa poprawnie', async () => {
    const ordersRes = await request(app.getHttpServer())
      .get('/orders')
      .expect(200);

    const orderId = ordersRes.body[0].id;

    // Przez /orders/:id/tasks
    const tasksRes1 = await request(app.getHttpServer())
      .get(`/orders/${orderId}/tasks`)
      .expect(200);

    expect(Array.isArray(tasksRes1.body)).toBe(true);
    expect(tasksRes1.body.length).toBeGreaterThan(0);

    // Przez /tasks/order/:orderId
    const tasksRes2 = await request(app.getHttpServer())
      .get(`/tasks/order/${orderId}`)
      .expect(200);

    expect(tasksRes2.body.length).toBe(tasksRes1.body.length);
  });

  describe('Zlecenie: status PACKED dla całego zlecenia dopiero gdy wszystkie części są DRILLED', () => {
    it('PACKER NIE MOŻE oznaczyć zlecenia jako PACKED gdy części są PENDING (400 Bad Request)', async () => {
      const ordersRes = await request(app.getHttpServer())
        .get('/orders')
        .expect(200);
      const orderId = ordersRes.body[0].id;

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ status: 'PACKED' })
        .expect(400);
    });

    it('PACKER NIE MOŻE oznaczyć zlecenia jako PACKED gdy części są tylko CUT, a nie DRILLED (400 Bad Request)', async () => {
      const ordersRes = await request(app.getHttpServer())
        .get('/orders')
        .expect(200);
      const orderId = ordersRes.body[0].id;

      // Wytnij części
      const tasksRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}/tasks`)
        .expect(200);

      for (const t of tasksRes.body) {
        await request(app.getHttpServer())
          .patch(`/tasks/${t.id}/status`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ status: TaskStatus.CUT })
          .expect(200);
      }

      // Pakowacz próbuje spakować wycięte, ale nienawiercone elementy -> 400 Bad Request
      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ status: 'PACKED' })
        .expect(400);
    });

    it('Gdy wszystkie części zostaną nawiercone (DRILLED), tylko PACKER lub ADMIN może ustawić PACKED', async () => {
      const ordersRes = await request(app.getHttpServer())
        .get('/orders')
        .expect(200);
      const orderId = ordersRes.body[0].id;

      // Nawierć wszystkie części
      const tasksRes = await request(app.getHttpServer())
        .get(`/orders/${orderId}/tasks`)
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
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${sawToken}`)
        .send({ status: 'PACKED' })
        .expect(403);

      // PACKER oznacza całe zlecenie jako PACKED -> 200 OK!
      const packRes = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${packerToken}`)
        .send({ status: 'PACKED' })
        .expect(200);

      expect(packRes.body.status).toBe('PACKED');

      // Sprawdzenie czy zadania w zleceniu zostały ukończone (COMPLETED)
      const updatedTasks = await request(app.getHttpServer())
        .get(`/orders/${orderId}/tasks`)
        .expect(200);

      expect(updatedTasks.body.every((t: any) => t.status === TaskStatus.COMPLETED)).toBe(true);
    });
  });
});
