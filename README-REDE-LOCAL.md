# Análise de Fluxo na rede local

Esta configuração transforma um computador em servidor da Análise de Fluxo. Todos os
computadores que abrirem o endereço exibido usarão a mesma base local de
registros, status, observações e acessos recentes.

## Início rápido no Windows

1. Instale o **Node.js 22 LTS** no computador que será o servidor.
2. Mantenha a pasta completa da Análise de Fluxo nesse computador.
3. Clique duas vezes em `iniciar-analise-de-fluxo-rede.bat`.
4. Na primeira execução, autorize o acesso do Node.js em **redes privadas** no
   Firewall do Windows.
5. A janela mostrará um endereço semelhante a `http://192.168.1.20:4173`.
   Digite esse endereço no navegador dos outros computadores da mesma rede.

O computador-servidor precisa permanecer ligado e a janela do servidor deve
ficar aberta. Para encerrar, pressione `Ctrl+C`.

## Início pelo terminal

```bash
npm ci
npm run rede
```

Para escolher outra porta:

- Windows PowerShell: `$env:VIGI_FLUXO_PORT=4180; npm run rede`
- Linux/macOS: `VIGI_FLUXO_PORT=4180 npm run rede`

## Dados e cópia de segurança

- O banco compartilhado da rede fica na pasta `.wrangler` do servidor.
- Para fazer backup, encerre o servidor e copie a pasta `.wrangler` inteira.
- Não execute duas cópias do servidor ao mesmo tempo. Os demais computadores
  devem apenas abrir o endereço no navegador.
- Recomenda-se reservar o endereço IP do computador-servidor no roteador para
  que o link não mude.

O banco da rede local é separado do banco do site publicado na internet; não há
sincronização automática entre eles.
