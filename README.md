# The First Defense — Painel Online Fácil

Este projeto usa apenas:

- GitHub Pages
- Firebase Authentication
- Firebase Firestore

Não usa Firebase Storage, Vercel, Netlify nem criação manual de personagens.

## Como funciona

- Cada jogador entra com e-mail e senha.
- O próprio painel dele é criado automaticamente usando o UID da conta.
- O jogador salva apenas o próprio painel.
- O mestre, pelo e-mail definido em `firebase-config.js`, vê todos os painéis.
- A foto é comprimida e salva em partes no Firestore para não quebrar o salvamento.

## Arquivos

Suba todos estes arquivos na raiz do GitHub:

- index.html
- painel.html
- online.css
- app.js
- firebase-config.js
- firestore.rules
- README.md

## Único arquivo que precisa editar

`firebase-config.js`

Cole nele as credenciais do Firebase e confirme o e-mail do mestre.

## Regras

No Firebase > Firestore Database > Regras, cole o conteúdo de:

`firestore.rules`

## Fluxo recomendado

1. Criar GitHub.
2. Subir estes arquivos.
3. Ativar GitHub Pages.
4. Criar Firebase.
5. Ativar Authentication > Email/Senha.
6. Criar Firestore em modo produção.
7. Colar as regras.
8. Editar `firebase-config.js`.
9. Criar usuários no Authentication.
10. Entrar no site e salvar.
