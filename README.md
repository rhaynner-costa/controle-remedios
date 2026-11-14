# 💊 Controle de Remédios

Aplicativo mobile **100% offline** para gerenciamento de medicamentos, ciclos de tratamento e lembretes de doses diárias, construído com **React Native (Expo)** e **SQLite**.

---

## ✨ Funcionalidades

- **Cadastro Local sem Login:** Onboarding simples com nome, data de nascimento e observações de saúde armazenados exclusivamente no dispositivo.
- **Catálogo de Medicamentos:**
  - Registro de nome comercial, princípio ativo, concentração/dosagem e tipo (`comprimido`, `cápsula`, `líquido`, `gotas`, `pomada`, `injetável`, `spray`, `outro`).
  - Foto da caixa do medicamento (câmera ou galeria, comprimida e salva localmente em Base64).
  - Personalização visual do medicamento (formato e cores primária/secundária) para fácil identificação.
  - Controle de status (`ativo`, `inativo`, `arquivado`) sem exclusão física de registros, preservando todo o histórico.
- **Ciclos de Tratamento e Posologia:**
  - Recorrência por intervalo de horas (ex: de 8 em 8h), horários fixos ou dias específicos da semana.
  - Suporte a tratamentos **contínuos** ou **temporários** (por número de doses/ocorrências ou duração em dias).
  - Retomada de tratamentos anteriores criando novos ciclos vinculados ao mesmo medicamento.
- **Agenda Diária e Controle de Doses:**
  - Visualização das doses do dia com confirmação de tomada (`tomado`), opção de pular (`pulado`) ou adiar (`soneca`).
  - Contabilização automática do progresso de doses e encerramento automático de ciclos finitos ao atingir a meta.
- **Notificações Locais Offline:**
  - Agendamento de lembretes nativos com `expo-notifications` e canais de alta prioridade no Android.
- **Histórico e Backup Portátil:**
  - Histórico completo de doses filtrável por período e status.
  - Exportação e importação de backup completo em arquivo `.json` (incluindo perfil, medicamentos, fotos, ciclos e histórico).

---

## 🛠️ Tecnologias Utilizadas

- **[Expo](https://expo.dev/) (SDK 52)** & **[React Native](https://reactnative.dev/) (0.76)**
- **[Expo Router](https://docs.expo.dev/router/introduction/)** — Navegação baseada em arquivos (File-based routing)
- **[Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/)** + **[Drizzle ORM](https://orm.drizzle.team/)** — Banco de dados relacional embarcado e tipado
- **[NativeWind v4](https://www.nativewind.dev/)** + **Tailwind CSS** — Estilização utilitária
- **[Expo Notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)** — Agendamento de alarmes e notificações locais
- **[Lucide React Native](https://lucide.dev/)** & **React Native SVG** — Ícones e ilustrações vetoriais dos comprimidos
- **TypeScript** — Tipagem estática de ponta a ponta

---

## 📁 Estrutura do Projeto

```text
controle-remedios/
├── assets/                  # Ícones do app
├── src/
│   ├── app/                 # Rotas e telas (Expo Router)
│   │   ├── (tabs)/          # Abas principais: Hoje, Remédios, Histórico, Perfil
│   │   ├── medication/      # Cadastro (new.tsx) e Detalhes ([id].tsx) do medicamento
│   │   ├── _layout.tsx      # Layout raiz e inicialização do banco/notificações
│   │   └── onboarding.tsx   # Cadastro inicial do usuário
│   ├── components/          # Componentes reutilizáveis (DoseCard, MedicationCard, PillIcon, etc.)
│   ├── db/                  # Configuração do SQLite (client.ts) e tabelas Drizzle (schema.ts)
│   ├── services/            # Regras de negócio (medicamentos, agenda, notificações, imagens, backup)
│   └── utils/               # Utilitários de manipulação e formatação de datas
├── app.json                 # Configurações e permissões do Expo
├── drizzle.config.ts        # Configuração do Drizzle Kit
└── package.json             # Dependências e scripts
```

---

## 🚀 Como Executar o Projeto

### Pré-requisitos

- **Node.js** (v18 ou superior)
- **npm** ou **yarn**
- **Android Studio** (para emulador/build Android) ou **Xcode** (para simulador iOS no macOS)
- Dispositivo físico com **Expo Go** ou Dev Client instalado (opcional)

### 1. Instalar dependências

```bash
npm install
```

### 2. Iniciar o servidor de desenvolvimento

```bash
npm start
```

### 3. Executar no Android ou iOS (Build Nativo Local)

```bash
# Android
npm run android

# iOS
npm run ios
```

### 4. Gerar APK de Release (Android)

Caso a pasta `android/` já tenha sido gerada (via `npx expo prebuild` ou `npm run android`):

```bash
cd android
./gradlew assembleRelease
```

O APK compilado estará disponível em `android/app/build/outputs/apk/release/app-release.apk`.

---

## 🧪 Scripts Disponíveis

| Comando | Descrição |
| :--- | :--- |
| `npm start` | Inicia o Metro Bundler do Expo |
| `npm run android` | Compila e executa o app no emulador ou dispositivo Android |
| `npm run ios` | Compila e executa o app no simulador ou dispositivo iOS |
| `npm run web` | Inicia a versão web para inspeção rápida |
| `npm run typecheck` | Executa a verificação de tipos do TypeScript (`tsc --noEmit`) |
| `npm run db:generate` | Gera artefatos de migração do Drizzle Kit |

---

## 📄 Licença

Distribuído sob a licença **ISC**. Desenvolvido por **Rhaynner Costa**.
