# Configuração Supabase

## Credenciais do Supabase

Use as strings de conexão obtidas no painel do Supabase:

### DATABASE_URL (Transaction Pooler)
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

### DIRECT_URL (Direct Connection)
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

## Local Development

1. Crie um arquivo `.env` na raiz com as credenciais acima
2. Execute as migrações:
   ```bash
   npx prisma migrate dev --name init
   ```
3. Popule os dados iniciais:
   ```bash
   npm run seed
   ```

## Deploy na Vercel

1. Vá para **Settings** → **Environment Variables** no painel da Vercel
2. Adicione as variáveis (substitua `[PROJECT-REF]` e `[PASSWORD]`):

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | `postgresql://postgres.[PROJECT-REF]:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres` |
| `NEXTAUTH_SECRET` | Gere uma string aleatória segura |
| `NEXTAUTH_URL` | `https://seu-app.vercel.app` |
| `SETUP_SECRET` | Uma chave para o endpoint `/api/setup` |

3. Faça push para GitHub (dispara deployment automático)
4. Vercel vai rodar `prisma migrate deploy` automaticamente no build

## Testando Localmente

Após as migrações e seed:

```bash
npm run dev
```

Acesse `http://localhost:3000` e faça login com:
- Email: `admin@demo.com`
- Senha: `123456`

## Testando a Migração

Para testar se a migração foi bem-sucedida:

```bash
npx prisma studio
```

Isso abre uma interface para visualizar e gerenciar os dados.
