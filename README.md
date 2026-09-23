<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

**Stolarz ERP** to system zarządzania produkcją mebli, stanami magazynowymi płyt i zleceniami produkcyjnymi na hali produkcyjnej.

### Role użytkowników i uprawnienia do oznaczania etapów produkcji:
- **`SAW_OPERATOR` (Operator piły / rozkroju)**:
  - Może oznaczać formatki/partie jako **`CUT`** (po rozkroju).
  - Nie ma uprawnień do oznaczania `EDGED`, `DRILLED` ani `COMPLETED`.
- **`EDGE_BANDER_OPERATOR` (Operator okleiniarki)**:
  - Może oznaczać wycięte formatki (`CUT`) jako **`EDGED`** (po oklejeniu krawędzi).
  - Nie może oklejać niewyciętych formatek (`PENDING`) ani oznaczać jako `CUT`, `DRILLED` / `COMPLETED`.
- **`DRILL_OPERATOR` (Operator wiertarki CNC)**:
  - Może oznaczać formatki jako **`DRILLED`** (po nawierceniu).
  - Jeżeli formatka wymaga oklejenia krawędzi (przynajmniej jedna krawędź D1, D2, S1, S2), musi zostać najpierw oklejona (**`EDGED`**). Formatki niewymagające oklejenia mogą przejść bezpośrednio z **`CUT`** do **`DRILLED`**.
  - Nie może wiercić niewyciętych formatek ani oznaczać jako `CUT` / `COMPLETED`.
- **`PACKER` (Pakowacz)**:
  - Może oznaczyć **całe zlecenie produkcyjne** jako **`PACKED`** (poprzez `PATCH /orders/:id/status`), pod warunkiem że **wszystkie części w zleceniu zostały nawiercone (`DRILLED`)**. Po spakowaniu zlecenia zadania automatycznie uzyskują status `COMPLETED`.
  - Może również oznaczać poszczególne formatki jako `COMPLETED`.
- **`ADMIN` (Kierownik produkcji / Administrator)**:
  - Posiada pełne uprawnienia do wszystkich statusów zadań i zleceń (`PENDING`, `IN_PROGRESS`, `PACKED`, `COMPLETED`), zarządzania pracownikami, produktami, materiałami i zleceniami.

### Domyślne konta testowe (seed):
| Login | Hasło | Rola |
| :--- | :--- | :--- |
| `admin` | `admin123` | `ADMIN` |
| `saw_operator` | `saw123` | `SAW_OPERATOR` |
| `edge_operator` | `edge123` | `EDGE_BANDER_OPERATOR` |
| `drill_operator` | `drill123` | `DRILL_OPERATOR` |
| `packer` | `packer123` | `PACKER` |

### Kluczowe endpointy API:
- `POST /auth/login` – logowanie pracownika i pobranie tokenu JWT
- `GET /auth/me` – dane zalogowanego pracownika
- `GET /orders/:id/tasks` lub `GET /tasks/order/:orderId` – pobranie listy elementów potrzebnych do konkretnego zamówienia

#### 1. Piła panelowa / Rozkrój (CUT)
- `GET /orders/:id/cutting-list` lub `GET /tasks/cutting-list?orderId=:id` – **lista rozkroju dla pilarza**: formatki pogrupowane po wymiarach (długość x szerokość x grubość) i materiale, sumujące potrzebną liczbę płyt niezależnie od późniejszego wiercenia CNC
- `PATCH /tasks/cutting-list/cut` – grupowe oznaczenie wszystkich formatek o danym wymiarze w zleceniu jako `CUT` przez `SAW_OPERATOR` / `ADMIN` (opcjonalnie z parametrem `sheetsUsed`)
- `POST /materials/:id/consume` – **ręczne wpisanie zużycia arkuszy płyty przez pilarza (`SAW_OPERATOR` / `ADMIN`)**: odejmuje podaną liczbę całych arkuszy ze stanu magazynowego i aktualizuje powierzchnię w m2
- `POST /orders/:id/consume-sheets` – **wpisanie zużycia arkuszy płyty dla zlecenia przez pilarza (`SAW_OPERATOR` / `ADMIN`)**: odejmuje arkusze z magazynu i zapisuje sumę w zleceniu (`order.sheetsUsed`)

#### 2. Okleiniarka (EDGE-BANDING)
- `GET /edge-tapes` – **stany magazynowe okleiny**: lista obrzeży meblowych (typ, kolor, grubość, szerokość) i ich stan magazynowy w metrach bieżących (mb)
- `GET /edge-tapes/check-availability?orderId=:id` lub `GET /orders/:id/edge-tape-check` – **automatyczne sprawdzanie dostępności okleiny**: weryfikuje czy stan magazynowy pokrywa zapotrzebowanie zlecenia i wylicza ewentualne braki
- `GET /orders/:id/edge-banding` – **zapotrzebowanie na okleinowanie dla zlecenia**: wylicza metry bieżące okleiny (mb) dla całej partii zlecenia, grupuje zapotrzebowanie wg rodzaju obrzeża (typ, kolor, grubość), prezentuje dostępność magazynową oraz wyliczenia per element
- `GET /tasks/edge-banding?orderId=:id` – lista partii z informacjami o oklejaniu krawędzi (D1, D2, S1, S2, metry/szt, metry łącznie) dla operatora okleiniarki
- `GET /tasks/:id/edge-banding` – zapotrzebowanie na okleinę dla pojedynczej partii / zadania
- `PATCH /tasks/edge-banding/edge` – **hurtowe oznaczenie partii jako oklejone (`EDGED`)**: dla `EDGE_BANDER_OPERATOR` lub `ADMIN` (przyjmuje `orderId` lub `taskIds`)
- `POST /edge-tapes/:id/consume` – **ręczne odliczenie okleiny przez operatora okleiniarki (`EDGE_BANDER_OPERATOR` / `ADMIN`)**: pozwala odliczyć zadaną liczbę metrów bieżących (np. odpad przy ustawianiu maszyny)
- `POST /orders/:id/deduct-edge-tape` – **ręczne odliczenie okleiny dla zlecenia przez operatora okleiniarki (`EDGE_BANDER_OPERATOR` / `ADMIN`)**: zdejmuje wyliczone metry ze stanu magazynowego i oznacza zlecenie
- Automatyczne odejmowanie okleiny z magazynu następuje również samoczynnie po skończeniu serii mebli (status zlecenia `PACKED` lub `COMPLETED`)

#### 3. Wiertarka CNC (DRILLING)
- `GET /tasks/drilling-list?orderId=:id&readyOnly=true` – **lista zadań wiertarskich**: formatki z informacją o schemacie nawierceń, wymiarach i fladze gotowości technologicznej `isReadyToDrill`
- `GET /orders/:id/drilling-list?readyOnly=true` – lista nawierceń dla wskazanego zlecenia
- `GET /tasks/drilling-summary?orderId=:id` oraz `GET /orders/:id/drilling-summary` – **podsumowanie wiertarskie**: statystyka partii i sztuk gotowych do wiercenia, już nawierconych oraz flaga `isFullyDrilled`
- `PATCH /tasks/drilling-list/drill` – **hurtowe oznaczenie partii jako nawiercone (`DRILLED`)**: dla `DRILL_OPERATOR` lub `ADMIN` (przyjmuje `orderId` lub `taskIds`, pilnuje by formatki były uprzednio wycięte i oklejone)

#### 4. Pakownia (PACKING)
- `GET /tasks/packing-list?orderId=:id&readyOnly=true` – **lista partii do spakowania**: formatki z flagą gotowości do pakowania `isReadyToPack` (gotowe po etapie `DRILLED`)
- `GET /orders/:id/packing-list?readyOnly=true` – lista partii do spakowania dla konkretnego zlecenia
- `GET /tasks/packing-summary?orderId=:id` oraz `GET /orders/:id/packing-summary` – **podsumowanie pakowania**: postęp procentowy (`completionPercentage`), liczba formatek spakowanych oraz flaga `isFullyPacked`
- `PATCH /tasks/packing-list/pack` – **hurtowe oznaczenie partii jako spakowane (`COMPLETED`)**: dla `PACKER` lub `ADMIN` (przyjmuje `orderId` lub `taskIds`)
- `PATCH /orders/:id/status` – zmiana statusu całego zlecenia na `PACKED` przez `PACKER` (gdy wszystkie części są `DRILLED`)

#### Operacje ogólne i kod kreskowy
- `PATCH /tasks/batch-status` – uniwersalna hurtowa zmiana statusu partii (`CUT`, `EDGED`, `DRILLED`, `COMPLETED`) z weryfikacją uprawnień zalogowanej roli
- `GET /tasks/barcode/:barcode` – szybkie odszukanie zadania po kodzie kreskowym na wózku/palecie
- `PATCH /tasks/:id/status` – aktualizacja statusu pojedynczej formatki przez uprawnionego pracownika (`CUT`, `EDGED`, `DRILLED`, `COMPLETED`)
- `GET /api` – interaktywna dokumentacja Swagger UI z autoryzacją Bearer JWT


## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
