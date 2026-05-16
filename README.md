# Rapporthjelper – gratis AI med GitHub Models

Dette er en enkel nettside der tekniker kan lime inn rapporttekst og få ferdig formulert rapport direkte på siden.

## Bruker

- GitHub Models for AI
- Vercel for gratis hosting/backend
- Ingen OpenAI API-nøkkel

## Viktig

GitHub Models er gratis med rate limits. Det betyr gratis, men ikke ubegrenset.

## Environment Variables i Vercel

Legg inn:

GITHUB_TOKEN=din GitHub personal access token
GITHUB_MODEL=openai/gpt-4.1-mini

Token må ha scope/permission: models:read.

## Deploy

1. Last opp filene til GitHub
2. Importer repoet i Vercel
3. Legg inn environment variables
4. Deploy
