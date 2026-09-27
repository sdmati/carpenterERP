# 🪚 Stolarz ERP – System Zarządzania Produkcją Mebli Skrzyniowych

**Stolarz ERP** to zaawansowany system backendowy (REST API) zaprojektowany dla nowoczesnych stolarni, fabryk mebli oraz zakładów obróbki płyt drewnopochodnych. System digitalizuje i automatyzuje obieg technologiczny formatek meblowych na hali produkcyjnej – od magazynu surowców, przez rozkrój, okleinowanie krawędzi i wiercenie CNC, aż po pakowanie gotowych paczek mebli.

---

## 📖 Spis treści
1. [O projekcie i cel systemu](#-o-projekcie-i-cel-systemu)
2. [Główne moduły i możliwości](#-główne-moduły-i-możliwości)
3. [Przepływ technologiczny (Workstation Parity)](#-przepływ-technologiczny-workstation-parity)
4. [Role pracowników i model uprawnień (RBAC)](#-role-pracowników-i-model-uprawnień-rbac)
5. [Architektura i technologie](#-architektura-i-technologie)
6. [Instalacja i pierwsze uruchomienie (Jak używać)](#-instalacja-i-pierwsze-uruchomienie-jak-używać)
7. [Domyślne konta testowe](#-domyślne-konta-testowe)
8. [Przykładowy cykl produkcyjny krok po kroku (Tutorial)](#-przykładowy-cykl-produkcyjny-krok-po-kroku-tutorial)
9. [Pełna lista endpointów API](#-pełna-lista-endpointów-api)
10. [Testy i jakość kodu](#-testy-i-jakość-kodu)

---

## 🎯 O projekcie i cel systemu

Tradycyjna produkcja mebli skrzyniowych (kuchnie, szafy, komody) często boryka się z chaosem informacyjnym na hali produkcyjnej:
- formatki gubią się między gniazdami produkcyjnymi,
- brakuje bieżącej kontroli nad zużyciem drogich płyt laminowanych oraz obrzeży (okleiny),
- pracownicy wykonują operacje w złej kolejności (np. próba wiercenia otworów przed oklejeniem krawędzi lub cięciem),
- brak jest natychmiastowej weryfikacji, czy na magazynie jest wystarczająco dużo metrów bieżących okleiny w danym dekorze przed rozpoczęciem zlecenia.

**Stolarz ERP** rozwiązuje te problemy poprzez:
1. **Pełną sekwencję technologiczną**: wymuszenie prawidłowej kolejności obróbki (`CUT` $\rightarrow$ `EDGED` $\rightarrow$ `DRILLED` $\rightarrow$ `COMPLETED`).
2. **Śledzenie partii i formatki**: generowanie unikalnych kodów kreskowych (`barcode`) na wózki technologiczne i palety.
3. **Zrównanie stanowisk roboczych (Workstation Parity)**: dedykowane widoki, listy robocze i operacje hurtowe dla każdego z 4 gniazd produkcyjnych.
4. **Automatyczną gospodarkę magazynową**: precyzyjne przeliczanie metrów bieżących okleiny, sprawdzanie dostępności oraz ewidencję zużycia arkuszy płyt przez pilarza.

---

## 🧩 Główne moduły i możliwości

### 1. Kartoteka mebli i technologia (BOM – Bill of Materials)
- Ewidencja modeli mebli (`Product`) oraz ich części składowych (`PartDefinition`).
- Parametry technologiczne formatki: długość, szerokość, grubość, powiązany materiał płyty.
- Szczegółowe zdefiniowanie oklejania krawędzi: które z 4 krawędzi mają być oklejone (D1, D2, S1, S2), typ taśmy (ABS, PCV, Melamina), kolor i grubość obrzeża.
- Informacja o schemacie nawierceń wiertarki CNC (np. konfirmaty, kołki, mimośrody).

### 2. Magazyn płyt laminowanych (`Material`)
- Ewidencja płyt w pełnych arkuszach (np. 2800 x 2070 x 18 mm) z automatycznym przeliczaniem na metry kwadratowe ($m^2$).
- Możliwość rejestracji zużycia całych arkuszy przez operatora piły (`POST /materials/:id/consume` lub w powiązaniu ze zleceniem `POST /orders/:id/consume-sheets`).

### 3. Magazyn obrzeży meblowych (`EdgeTape`)
- Ewidencja rolek okleiny z dokładnością do typu (np. ABS, Melamina), dekoru/koloru, grubości (np. 0.8 mm, 1.0 mm, 2.0 mm) oraz szerokości taśmy.
- Stany magazynowe prowadzone w **metrach bieżących (mb)**.
- **Automatyczna analiza dostępności**: algorytm przelicza obwód oklejanych krawędzi wszystkich elementów w zleceniu i sprawdza, czy stan magazynowy jest wystarczający lub ile metrów brakuje.
- **Ręczne i automatyczne zdejmowanie ze stanu**:
  - Ręczne odliczenie przez operatora okleiniarki (np. odpad przy rozruchu maszyny lub dla całego zlecenia).
  - Automatyczne zdjęcie odpowiedniej ilości metrów po spakowaniu serii mebli (`PACKED` / `COMPLETED`).

### 4. Zlecenia produkcyjne i partie (`ProductionOrder` & `ProductionTask`)
- Złożenie zamówienia na określoną liczbę mebli w danym kolorze automatycznie generuje zlecenia na formatki dla hali produkcyjnej.
- Przeliczenie ilości: np. zamówienie na 50 szafek $\times$ 2 boki = partia 100 formatek.
- Unikalny kod kreskowy na partię/wózek ułatwiający skanowanie czytnikiem na hali.

---

## ⚙️ Przepływ technologiczny (Workstation Parity)

System wspiera cztery gniazda produkcyjne, z których każde posiada dedykowane widoki robocze oraz operacje wsadowe (batch):

```mermaid
flowchart LR
    A["1. PENDING\n(Utworzenie zlecenia)"] --> B["2. CUT\n(Piła panelowa)"]
    B --> C{"Czy wymaga\noklejenia?"}
    C -- Tak --> D["3. EDGED\n(Okleiniarka)"]
    C -- Nie --> E["4. DRILLED\n(Wiertarka CNC)"]
    D --> E
    E --> F["5. COMPLETED\n(Pakownia / Spakowane)"]
    F --> G["Zlecenie PACKED\nAutomatyczny odpis okleiny"]
```

1. **Piła panelowa / Rozkrój (`SAW_OPERATOR`)**:
   - Korzysta z listy rozkroju (`GET /tasks/cutting-list`), która grupuje formatki o identycznych wymiarach i materiale.
   - Może jednym żądaniem oznaczyć całą grupę wymiarową jako `CUT` (`PATCH /tasks/cutting-list/cut`).
   - Wpisuje liczbę zużytych arkuszy płyty.
2. **Okleiniarka (`EDGE_BANDER_OPERATOR`)**:
   - Pobiera listę zapotrzebowania na oklejanie (`GET /tasks/edge-banding`), gdzie widzi metry bieżące na sztukę i łącznie na partię.
   - Oznacza pojedyncze zadanie lub całą partię jako `EDGED` (`PATCH /tasks/edge-banding/edge`). Wymaga uprzedniego wycięcia formatki (`CUT`).
3. **Centrum wiertarskie CNC (`DRILL_OPERATOR`)**:
   - Pobiera listę wiertarską (`GET /tasks/drilling-list?readyOnly=true`), która filtruje wyłącznie elementy gotowe technologicznie do nawiercenia.
   - Formatki wymagające obrzeża muszą mieć status `EDGED`; formatki surowe mogą przejść do wiercenia bezpośrednio po `CUT`.
   - Oznacza partię jako `DRILLED` (`PATCH /tasks/drilling-list/drill`).
4. **Pakownia (`PACKER`)**:
   - Widzi elementy gotowe do spakowania (`GET /tasks/packing-list`), czyli takie, które pomyślnie przeszły etap wiercenia (`DRILLED`).
   - Monitoruje wskaźnik kompletacji zlecenia (`GET /tasks/packing-summary`).
   - Oznacza partie jako spakowane (`PATCH /tasks/packing-list/pack`).
   - Gdy wszystkie elementy zostaną spakowane, całe zlecenie uzyskuje status `PACKED`/`COMPLETED`, co wyzwala automatyczne rozliczenie surowców.

---

## 🔐 Role pracowników i model uprawnień (RBAC)

Każde stanowisko na hali produkcyjnej posiada własne konto zabezpieczone tokenem JWT. System rygorystycznie pilnuje reguł bezpieczeństwa:

| Rola w systemie | Stanowisko / Maszyna | Dozwolone akcje na statusach | Dodatkowe uprawnienia |
| :--- | :--- | :--- | :--- |
| `SAW_OPERATOR` | Piła panelowa / Formatówka | `CUT` | Rozkrój grupowy, wpisywanie zużycia arkuszy płyty |
| `EDGE_BANDER_OPERATOR` | Okleiniarka wąskich płaszczyzn | `EDGED` | Masowe oklejanie partii, ręczne odpisywanie metrów okleiny |
| `DRILL_OPERATOR` | Centrum wiertarskie CNC | `DRILLED` | Masowe wiercenie partii gotowych technologicznie |
| `PACKER` | Pakownia i kontrola jakości | `COMPLETED` | Masowe pakowanie partii, oznaczanie zlecenia jako `PACKED` |
| `ADMIN` | Kierownik produkcji / Szef | Pełne uprawnienia do wszystkich statusów | Pełne CRUD: produkty, materiały, okleiny, zlecenia, użytkownicy |

---

## 🛠 Architektura i technologie

- **Framework**: [NestJS 12](https://nestjs.com/) (Node.js w trybie ESM)
- **Język**: TypeScript 6
- **Baza danych**: PostgreSQL (wersja $\ge$ 15, w kontenerze Docker)
- **ORM**: [Prisma ORM 6](https://www.prisma.io/)
- **Uwierzytelnianie**: Passport JWT, bcryptjs
- **Walidacja danych**: `class-validator`, `class-transformer`
- **Dokumentacja API**: Swagger UI / OpenAPI 3.0
- **Testy**: [Vitest 4](https://vitest.dev/), Supertest (testy jednostkowe oraz integracyjne E2E)
- **Linter**: [oxlint](https://oxc.rs/)

---

## 🚀 Instalacja i pierwsze uruchomienie (Jak używać)

### Wymagania wstępne
- Zainstalowany **Node.js** (wersja LTS $\ge$ 20.x) oraz menedżer pakietów **npm**.
- Zainstalowany **Docker** oraz **Docker Compose** (do uruchomienia bazy PostgreSQL).

### Krok 1: Klonowanie repozytorium i instalacja zależności
```bash
git clone https://github.com/sdmati/carpenterERP.git
cd carpenterERP
npm install
```

### Krok 2: Konfiguracja zmiennych środowiskowych
Skopiuj plik `.env.example` do `.env`:
```bash
cp .env.example .env
```
Domyślna zawartość pliku `.env` dostosowana do dockera:
```env
DATABASE_URL="postgresql://uzytkownik:haslo@localhost:5432/stolarz_erp?schema=public"
```

### Krok 3: Uruchomienie bazy danych PostgreSQL
W katalogu projektu uruchom kontener z bazą danych:
```bash
docker compose up -d
```
Kontener `stolarz-erp-db` zostanie uruchomiony na porcie `5432`.

### Krok 4: Migracje bazy danych i wgranie danych demonstracyjnych (Seed)
Wykonaj migracje Prisma oraz uruchom skrypt seedujący:
```bash
npx prisma migrate dev
npm run seed
```
Skrypt seedujący utworzy:
- domyślne konta pracowników dla każdej roli,
- park maszynowy (piła, okleiniarka, wiertarka),
- stany magazynowe płyt meblowych (Dąb Sonoma, Biała) i obrzeży (ABS, Melamina),
- mebel demonstracyjny (*Szafka dolna kuchenna 60*) wraz ze strukturą formatek i oklejaniem,
- przykładowe zlecenie produkcyjne na 5 szafek (partie z kodami kreskowymi).

### Krok 5: Uruchomienie aplikacji
```bash
# Tryb deweloperski (z hot-reload)
npm run start:dev

# Tryb produkcyjny
npm run build
npm run start:prod
```
Serwer uruchomi się domyślnie pod adresem: `http://localhost:3000`.

### Krok 6: Interaktywna dokumentacja Swagger UI
Otwórz przeglądarkę pod adresem:
👉 **[http://localhost:3000/api](http://localhost:3000/api)**

W Swagger UI możesz:
- Zalogować się endpointem `POST /auth/login` i skopiować token JWT.
- Kliknąć przycisk **Authorize** (w prawym górnym rogu) i wkleić token w formacie: `Bearer <TWÓJ_TOKEN>`.
- Testować dowolne endpointy bezpośrednio w przeglądarce.

---

## 👥 Domyślne konta testowe

Po wykonaniu `npm run seed` w systemie dostępne są następujące konta:

| Login | Hasło | Rola | Zastosowanie |
| :--- | :--- | :--- | :--- |
| `admin` | `admin123` | `ADMIN` | Zarządzanie produkcją, zamówienia, pełne uprawnienia |
| `saw_operator` | `saw123` | `SAW_OPERATOR` | Rozkrój płyt, wpisywanie zużycia arkuszy (`CUT`) |
| `edge_operator` | `edge123` | `EDGE_BANDER_OPERATOR` | Okleinowanie krawędzi, zużycie okleiny (`EDGED`) |
| `drill_operator` | `drill123` | `DRILL_OPERATOR` | Nawiercanie formatek CNC (`DRILLED`) |
| `packer` | `packer123` | `PACKER` | Pakowanie paczek, zamykanie zleceń (`COMPLETED`) |

---

## 📋 Przykładowy cykl produkcyjny krok po kroku (Tutorial)

Poniżej przedstawiono przykładowy, kompletny scenariusz realizacji zlecenia na hali:

### 1. Logowanie pracowników
Każdy pracownik loguje się swoim loginem, aby uzyskać token JWT:
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "saw_operator", "password": "saw123"}'
```
W odpowiedzi serwer zwraca `{ "accessToken": "eyJhbGciOi..." }`. Używaj tego tokenu w nagłówku:
`Authorization: Bearer <accessToken>`.

### 2. Sprawdzenie dostępności okleiny przed cięciem
Kierownik lub operator sprawdza, czy w magazynie wystarczy okleiny na zlecenie #1:
```bash
curl -X GET http://localhost:3000/orders/1/edge-tape-check
```
Odpowiedź zwraca `isStockSufficient: true/false` oraz zestawienie metrów potrzebnych vs dostępnych.

### 3. Stanowisko 1: Rozkrój płyt (Pilarz)
Pilarz pobiera listę formatek pogrupowaną wg wymiarów dla zlecenia:
```bash
curl -X GET "http://localhost:3000/tasks/cutting-list?orderId=1"
```
Następnie pilarz wycina grupę formatek o wymiarach 720 x 510 mm i oznacza je jako `CUT`:
```bash
curl -X PATCH http://localhost:3000/tasks/cutting-list/cut \
  -H "Authorization: Bearer <TOKEN_PILARZA>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": 1, "length": 720, "width": 510, "sheetsUsed": 2}'
```
System zaktualizował status pasujących formatek na `CUT` i odliczył 2 arkusze z magazynu płyt.

### 4. Stanowisko 2: Okleiniarka (Operator okleiniarki)
Operator pobiera listę partii do oklejenia:
```bash
curl -X GET "http://localhost:3000/tasks/edge-banding?orderId=1"
```
Gdy oklei elementy, oznacza hurtowo całe zlecenie (lub listę partii) jako `EDGED`:
```bash
curl -X PATCH http://localhost:3000/tasks/edge-banding/edge \
  -H "Authorization: Bearer <TOKEN_OKLEINIARZA>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": 1}'
```

### 5. Stanowisko 3: Wiertarka CNC (Wiertacz)
Operator wiertarki pobiera listę zadań gotowych do nawiercenia:
```bash
curl -X GET "http://localhost:3000/tasks/drilling-list?orderId=1&readyOnly=true"
```
Po wykonaniu nawierceń oznacza partię hurtowo jako `DRILLED`:
```bash
curl -X PATCH http://localhost:3000/tasks/drilling-list/drill \
  -H "Authorization: Bearer <TOKEN_WIERTACZA>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": 1}'
```

### 6. Stanowisko 4: Pakownia (Pakowacz)
Pakowacz sprawdza stan skompletowania paczek:
```bash
curl -X GET "http://localhost:3000/tasks/packing-summary?orderId=1"
```
Gdy elementy zostaną spakowane do kartonów, oznacza je jako `COMPLETED`:
```bash
curl -X PATCH http://localhost:3000/tasks/packing-list/pack \
  -H "Authorization: Bearer <TOKEN_PAKOWACZA>" \
  -H "Content-Type: application/json" \
  -d '{"orderId": 1}'
```
> [!NOTE]
> Gdy wszystkie partie w zleceniu osiągną status `COMPLETED`, całe zlecenie automatycznie przechodzi w status `COMPLETED`, a system samoczynnie zdejmuje wyliczone metry bieżące obrzeży ze stanu magazynowego!

---

## 📡 Pełna lista endpointów API

### Autoryzacja (`/auth`)
- `POST /auth/login` – Logowanie i zwrot tokenu JWT Bearer.
- `GET /auth/me` – Zwraca dane aktualnie zalogowanego pracownika.

### Magazyn materiałów płytowych (`/materials`)
- `GET /materials` – Lista płyt na stanie (długość, szerokość, grubość, kolor, arkusze, $m^2$).
- `POST /materials` – Dodanie nowej płyty do magazynu (`ADMIN`).
- `GET /materials/:id` – Szczegóły materiału.
- `POST /materials/:id/consume` – Ręczne wpisanie zużycia arkuszy płyty (`SAW_OPERATOR` / `ADMIN`).

### Magazyn okleiny i obrzeży (`/edge-tapes`)
- `GET /edge-tapes` – Lista taśm okleinowych i ich stan magazynowy w mb.
- `POST /edge-tapes` – Dodanie nowego typu/koloru okleiny (`ADMIN`).
- `GET /edge-tapes/:id` – Szczegóły danej okleiny.
- `GET /edge-tapes/check-availability?orderId=:id` – Sprawdzenie dostępności okleiny dla zlecenia.
- `POST /edge-tapes/:id/consume` – Ręczne odliczenie metrów bieżących okleiny (`EDGE_BANDER_OPERATOR` / `ADMIN`).

### Zlecenia produkcyjne (`/orders`)
- `POST /orders` – Utworzenie nowego zlecenia (automatycznie generuje partie zadań na halę).
- `GET /orders` – Lista wszystkich zleceń produkcyjnych.
- `GET /orders/:id` – Szczegóły zlecenia wraz z partiami.
- `GET /orders/:id/tasks` – Lista elementów zlecenia.
- `GET /orders/:id/cutting-list` – Lista rozkroju dla wskazanego zlecenia.
- `GET /orders/:id/edge-banding` – Zestawienie zapotrzebowania na okleinę dla zlecenia.
- `GET /orders/:id/edge-tape-check` – Analiza dostępności okleiny dla zlecenia.
- `GET /orders/:id/drilling-list` – Lista formatek do nawiercenia dla zlecenia.
- `GET /orders/:id/drilling-summary` – Podsumowanie postępu nawierceń w zleceniu.
- `GET /orders/:id/packing-list` – Lista formatek do spakowania dla zlecenia.
- `GET /orders/:id/packing-summary` – Podsumowanie pakowania w zleceniu.
- `POST /orders/:id/consume-sheets` – Wpisanie zużycia arkuszy dla zlecenia (`SAW_OPERATOR` / `ADMIN`).
- `POST /orders/:id/deduct-edge-tape` – Ręczne odliczenie okleiny dla zlecenia (`EDGE_BANDER_OPERATOR` / `ADMIN`).
- `PATCH /orders/:id/status` – Zmiana statusu zlecenia (np. `PACKED` przez `PACKER`).

### Zadania produkcyjne i stanowiska (`/tasks`)
- `GET /tasks` – Lista partii (opcjonalny filtr po `orderId` lub `status`).
- `GET /tasks/:id` – Szczegóły pojedynczej partii.
- `GET /tasks/barcode/:barcode` – Wyszukanie zadania po kodzie kreskowym na wózku.
- `PATCH /tasks/:id/status` – Zmiana statusu partii (`CUT`, `EDGED`, `DRILLED`, `COMPLETED`).
- **Piła panelowa (Rozkrój)**:
  - `GET /tasks/cutting-list` – Lista rozkroju pogrupowana wymiarami i materiałem.
  - `PATCH /tasks/cutting-list/cut` – Grupowe oznaczenie wymiaru jako `CUT` (`SAW_OPERATOR` / `ADMIN`).
- **Okleiniarka**:
  - `GET /tasks/edge-banding` – Lista partii z parametrami oklejania krawędzi.
  - `GET /tasks/:id/edge-banding` – Wyliczenie metrów okleiny dla konkretnej partii.
  - `PATCH /tasks/edge-banding/edge` – Hurtowe oznaczenie partii jako `EDGED` (`EDGE_BANDER_OPERATOR` / `ADMIN`).
- **Wiertarka CNC**:
  - `GET /tasks/drilling-list` – Lista partii do nawiercenia z flagą `isReadyToDrill`.
  - `GET /tasks/drilling-summary` – Statystyka nawierceń dla zlecenia.
  - `PATCH /tasks/drilling-list/drill` – Hurtowe oznaczenie partii jako `DRILLED` (`DRILL_OPERATOR` / `ADMIN`).
- **Pakownia**:
  - `GET /tasks/packing-list` – Lista partii do spakowania z flagą `isReadyToPack`.
  - `GET /tasks/packing-summary` – Procentowy postęp kompletacji i pakowania zlecenia.
  - `PATCH /tasks/packing-list/pack` – Hurtowe oznaczenie partii jako `COMPLETED` (`PACKER` / `ADMIN`).
- **Operacja uniwersalna**:
  - `PATCH /tasks/batch-status` – Masowa zmiana statusu z weryfikacją uprawnień zalogowanej roli.

---

## 🧪 Testy i jakość kodu

Projekt objęty jest kompleksowym zestawem testów jednostkowych, integracyjnych i reguł lintera:

```bash
# Uruchomienie testów jednostkowych (Vitest)
npm test

# Uruchomienie testów integracyjnych E2E (Supertest + Vitest)
npm run test:e2e

# Raport pokrycia kodu testami
npm run test:cov

# Szybka weryfikacja kodu linterem (oxlint)
npm run lint

# Formatowanie kodu (Prettier)
npm run format
```

---

## 📄 Licencja

Projekt objęty jest licencją [MIT](LICENSE).
