# Paradoxo de Wilson — versão web

Abra **index.html** com dois cliques no Edge, Chrome ou Firefox. Não precisa instalar GameMaker, Node ou qualquer biblioteca para jogar. Funciona offline; mantenha `assets/`, `data.js`, `mechanics.js`, `game.js` e `styles.css` junto do HTML.

Esta é uma adaptação independente em HTML, CSS e JavaScript do projeto completo em `../ExpoGameJam-main`. Nenhum arquivo do projeto GameMaker foi modificado. Os PNGs foram copiados sem edição, e os mapas, colisores e diálogos foram exportados dos recursos originais. A interface foi adaptada para o navegador; não é uma exportação oficial do GameMaker nem uma reprodução pixel a pixel da interface.

## Controles

- **WASD:** movimentar Wilson.
- **E / espaço:** conversar e avançar diálogos.
- **1, 2, 3, 4:** ataque, cura, defesa e esquiva.
- **Números + Enter:** responder aos cálculos.
- **Esc:** pausar/retomar.
- **W/S ou setas + Enter:** navegar no menu.

Os botões também aceitam mouse. Controles de toque aparecem em dispositivos compatíveis; em celular, use preferencialmente a orientação horizontal. “Sair” orienta a fechar a aba, pois navegadores não permitem fechar automaticamente uma aba aberta pelo usuário.

## Conteúdo transportado

- Menu, cenário original do tutorial, Newton e diálogos das incursões.
- Escolha de fazer ou pular o treinamento **após a conversa com Newton**, não no menu.
- Quatro ações guiadas e combate livre contra Newton, com progressão matemática de 1 a 16.
- Portal para a floresta das cavernas, transmissão de Newton sem NPC físico e passagem pela borda direita ao vale dos ossos.
- Dois cenários completos, escalas dos personagens, colisão pelos pés, sombras, rastros e ambientação. Pássaros e dinossauros animados no segundo cenário.
- Isleide das Cavernas, diálogo incompreensível, 75 HP e cálculos fixos de nível 1.
- Aviso de Newton após a vitória; o portal abre primeiro e a cena do meteoro só começa quando Wilson entra nele.
- Dez frames do meteoro na ordem original, escala 0,28, clarão e cenário pós-impacto sem dinossauros, com fogo, fumaça e brasas animados. Enter retorna ao menu após dois segundos.

As regras mantêm os intervalos de dano, cura de 20 HP, chances de crítico e esquiva, redução de defesa, penalidade por resposta errada e comportamento de reinício do projeto original. A movimentação usa tempo decorrido, equivalendo a 2 pixels por quadro a 60 FPS. Não foram acrescentados áudio, salvamento ou fases além das presentes no jogo.

## Arquivos

- `index.html`: estrutura e telas.
- `styles.css`: interface, cores, adaptação de tamanho e controles de toque.
- `game.js`: exploração, entrada, diálogos, renderização, transições e cutscene.
- `mechanics.js`: matemática, combate e colisões.
- `data.js`: dados dos mapas, sprites e diálogos exportados.
- `assets/`: 52 imagens, distribuídas em 22 sprites, copiadas do projeto.
- `tools/export-assets.cjs`: exportador opcional que lê o GameMaker e grava apenas nesta pasta web.
- `source-snapshot.json`: hashes dos arquivos originais, usados para verificar que não foram alterados.
- `tests/`: testes de regras, integridade e fluxo no navegador.
- `qa/`: capturas locais produzidas pelos testes; não são necessárias para jogar.

## Verificação para desenvolvimento

Com Node instalado, execute a partir desta pasta:

```sh
node --test tests/mechanics.test.cjs
```

O teste opcional `node tests/browser.cjs` requer Playwright e Chromium instalados. Também aceita a variável `BROWSER_CHANNEL=msedge` para usar Edge. Ele abre uma sessão isolada, testa as duas opções do tutorial, o boss e o final, e grava capturas em `qa/`. Não interfere no navegador pessoal.

Os testes de regras verificam os 16 níveis matemáticos, dano, cura, defesa, esquiva, crítico, reinício, colisões, rotas transitáveis nos três mapas, recursos exportados e hashes do GameMaker. O acesso de diagnóstico `?test=1` só é habilitado para esses testes; não faz parte da partida normal.

Para uma nova exportação dos recursos, opcionalmente execute `node tools/export-assets.cjs`. Isso atualiza somente as cópias de assets, `data.js` e o snapshot nesta pasta; não converte automaticamente novas lógicas GML.
