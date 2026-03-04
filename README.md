# 🐒 Monkeytype Ranking

Sistema de ranking de digitação por turma, usando a API pública do Monkeytype.
Atualização automática diária via cron. Sem banco de dados. Sem login.

---

## Estrutura

```
project/
├── data/
│   ├── students.json       ← lista de alunos (edite aqui)
│   └── ranking.json        ← gerado automaticamente pelo script
├── scripts/
│   └── updateRanking.js    ← busca API e gera ranking.json
├── public/
│   └── index.html          ← frontend com autocomplete por turma
├── server.js               ← servidor Express (API + static)
├── package.json
└── README.md
```

---

## Instalação

```bash
npm install
```

---

## Configuração dos Alunos

Edite `data/students.json`:

```json
{
  "turmas": {
    "3A": [
      { "username": "usuario_monkeytype", "displayName": "Nome Exibido" }
    ],
    "3B": [
      { "username": "outro_usuario", "displayName": "Outro Aluno" }
    ]
  }
}
```

> O campo `username` deve ser o nome de usuário **público** do aluno no Monkeytype.

---

## Atualizar o Ranking Manualmente

```bash
node scripts/updateRanking.js
```

Isso vai buscar todos os perfis e salvar `data/ranking.json`.

---

## Iniciar o Servidor

```bash
npm start
# ou
node server.js
```

Acesse: **http://localhost:3000**

---

## Cron Diário (Linux)

Para atualizar automaticamente todo dia às 03h00:

```bash
crontab -e
```

Adicione:

```
0 3 * * * /usr/bin/node /caminho/completo/project/scripts/updateRanking.js >> /var/log/monkeytype-ranking.log 2>&1
```

> Substitua `/caminho/completo/project` pelo caminho real do projeto.

Para descobrir o caminho do node:
```bash
which node
```

---

## Endpoints da API

| Método | Rota                   | Descrição                        |
|--------|------------------------|----------------------------------|
| GET    | `/api/turmas`          | Lista todas as turmas disponíveis |
| GET    | `/api/ranking/:turma`  | Ranking de uma turma específica  |

---

## Regras de Pontuação

- Considera **todos** os `personalBests.time` (15s, 30s, 60s, 120s…)
- Sem filtro por idioma ou dificuldade
- Apenas registros com `timestamp` dos **últimos 90 dias**
- O WPM mais alto é a pontuação final — sem cálculo adicional
- Alunos sem registros válidos **não aparecem** no ranking
