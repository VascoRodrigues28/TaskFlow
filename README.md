# TaskFlow em Windows

O frontend Next.js serve a interface e encaminha os pedidos de `/api` para o FastAPI. O login guarda o JWT num cookie HTTP-only. O backend usa SQLAlchemy com pg8000 para aceder ao PostgreSQL e Alembic para gerir o esquema.

## PostgreSQL existente

A instalação do TaskFlow neste computador está em `%LOCALAPPDATA%\TaskFlow\postgresql-17.12`. O cluster original está em `data` e escuta em `127.0.0.1:5433`. É iniciado manualmente pelo `pg_ctl`.

```powershell
$pg = Join-Path $env:LOCALAPPDATA 'TaskFlow\postgresql-17.12'
& "$pg\pgsql\bin\pg_ctl.exe" -D "$pg\data" status
if ($LASTEXITCODE -eq 3) {
    & "$pg\pgsql\bin\pg_ctl.exe" -D "$pg\data" -l "$pg\postgresql.log" -w start
}
& "$pg\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p 5433
```

Se o diretório tiver sido movido, localiza o cluster original pelo ficheiro `PG_VERSION` e confirma a porta em `postgresql.conf` antes de arrancar. Para parar o servidor no fim, usa `& "$pg\pgsql\bin\pg_ctl.exe" -D "$pg\data" -w stop`.

## Backend

Na raiz, usa o Python 3.13 para criar o ambiente do projeto e instalar as dependências. Os antigos `venv` e `backend/venv` podem ficar arquivados. No editor, seleciona `.venv\Scripts\python.exe`.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

Usa `backend/.env.example` como referência se precisares de criar `backend/.env`. Para uma configuração já existente, muda o prefixo `postgresql+psycopg://` para `postgresql+pg8000://`, preservando o resto do URL. Usa os valores da base original e um `JWT_SECRET` aleatório com pelo menos 32 bytes. Mantém as credenciais fora do Git.

```powershell
Set-Location backend
..\.venv\Scripts\python.exe -m alembic current
..\.venv\Scripts\python.exe -m alembic heads
..\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

Se houver migrações pendentes, confirma a base de destino, faz uma cópia de segurança e executa `..\.venv\Scripts\python.exe -m alembic upgrade head` antes de iniciar a API. A base original já estava em `0014` no momento da recuperação. A documentação da API está em `http://127.0.0.1:8000/docs`.

## Frontend

Noutro terminal, na raiz do projeto, instala as dependências com `npm ci` na primeira execução ou quando o lockfile mudar. O proxy usa `http://127.0.0.1:8000` por omissão. Se precisares de outro endereço para a API, configura `TASKFLOW_API_URL` em `frontend/.env.local`.

```powershell
Set-Location frontend
npm.cmd ci
npm.cmd run dev
```

Abre `http://localhost:3000` para iniciar sessão e usar a aplicação. `npm.cmd run lint` verifica o código e `npm.cmd run build` compila o frontend com as fontes Geist incluídas nas dependências.
