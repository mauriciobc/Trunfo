/**
 * Trunfo localization.
 *
 * Every string the interface shows lives here, in each language the game ships
 * with: `en` (the default) and `pt-BR`. English is the source of truth — the
 * catalogs must stay key-for-key identical, which `tests/i18n.test.js` enforces,
 * and a key the active catalog lacks falls back to English rather than showing
 * a raw key.
 *
 * The language is chosen once per page, in this order: a `?lang=` query
 * parameter (so a link can pin a language), the last explicit choice stored in
 * `localStorage`, the browser's own preference list, then `en`. A regional
 * variant without a catalog of its own (`pt-PT`) falls back to the closest
 * shipped language rather than to English. Only a browser has a preference to
 * consult: under Node the default is English until a caller sets one, so a
 * developer's `LANG` cannot change what the tests see.
 *
 * Usage:
 *   I18n.t('game.start')                   -> 'Start game'
 *   I18n.t('game.cards', { count: 3 })     -> 'cards'   (plural: *_one / *_other)
 *   I18n.t('over.score', { player: 9 })    -> numbers are formatted for the locale
 *   I18n.number(1020)                      -> '1.020' in pt-BR
 *   I18n.setLocale('pt-BR')                -> switches, persists and re-applies the DOM
 *   I18n.mount(document)                   -> data-i18n attributes + a language toggle button
 *
 * Markup is translated declaratively, so an element keeps readable English
 * copy in the source and is replaced at load:
 *   <button data-i18n="game.start">Start game</button>
 *   <input data-i18n-placeholder="create.deckNamePlaceholder" placeholder="…">
 * A language button just needs the marker; `mount()` gives it the active flag
 * and an accessible name for the switch it performs:
 *   <button type="button" data-locale-toggle></button>
 * A `trunfo:localechange` event fires on `document` after a switch, for the
 * controllers whose text is rendered rather than marked up.
 *
 * Works as a classic browser script (`window.TrunfoI18n`) and as a CommonJS
 * module for the Node tests. It also registers itself as `globalThis.TrunfoI18n`
 * in both worlds, so a module loaded after it — `decks.js`, `images.js` — finds
 * the same instance without a script order of its own.
 */
(function (global, factory) {
    'use strict';
    const api = factory(global);
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    // Also published globally, so later modules share this one instance.
    /** @type {Record<string, unknown>} */
    const host = /** @type {any} */ (global);
    host.TrunfoI18n = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (global) {
    'use strict';

    const DEFAULT_LOCALE = 'en';
    const STORAGE_KEY = 'trunfo.locale.v1';
    const EVENT_NAME = 'trunfo:localechange';

    /**
     * The shipped languages. `label` is an endonym — a language is always
     * listed in its own language — and `flag` decorates the switch button.
     *
     * The flag is a shorthand, not a claim about a country: `en` ships as one
     * catalog, so it takes the flag of the language's origin rather than
     * borrowing a region. A wrong-but-recognisable flag in a 42px button beats
     * an unreadable "English / Português" in the topbar.
     */
    const LOCALES = [
        { id: 'en', label: 'English', flag: '🇬🇧' },
        { id: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' }
    ];

    const EN = {
        'app.title': 'Trunfo — Top Trumps',
        'app.description':
            'A web-based single-player Top Trumps game: compare animal statistics against the computer and collect the whole deck.',
        'app.createTitle': 'Trunfo — Deck creator',
        'app.createDescription':
            'Create your own Trunfo deck: name it, choose up to five stats, and fill in the cards.',
        'app.switchLanguage': 'Switch language to {language}',

        /* Game page — controls */
        'game.deck': 'Deck',
        'game.newDeck': 'New',
        'game.newDeckTitle': 'Create a deck',
        'game.fast': 'Fast',
        'game.fastTitle': 'Shorten the reveal and think time',
        'game.rules': 'Rules',
        'game.rulesTitle': 'How to play',
        'game.restart': 'Restart',
        'game.computer': 'Computer',
        'game.you': 'You',
        'game.start': 'Start game',
        'game.round': 'Round',
        'game.pot': 'Pot',
        'game.cards_one': 'card',
        'game.cards_other': 'cards',
        /* The same noun with its number, where the value is shown on its own */
        'count.cards_one': '{count} card',
        'count.cards_other': '{count} cards',

        /* Game page — status line and round result */
        'game.idle': 'Press “Start game” to shuffle and deal.',
        'game.chooseFirst': 'Choose a category on your card to begin.',
        'game.chooseNext': 'Choose a category for the next round.',
        'game.gameOver': 'Game over.',
        'game.yourTurn': 'The computer chooses this round — hang tight.',
        'game.computerTurn': 'Computer won the last round — it is choosing a category…',
        'game.fastOn': 'Fast play on — rounds resolve quickly.',
        'game.fastOff': 'Fast play off.',
        'game.result.trump': 'Super Trunfo! ',
        'game.result.win': '{trump}You win the round! {score}{pot}',
        'game.result.lose': '{trump}Computer wins the round. {score}{pot}',
        'game.result.draw': 'It’s a draw — the cards go to the pot. {score}',
        'game.result.score': '{stat}{rule}: you {player} vs computer {computer}.',
        'game.result.lowestRule': ' (lowest wins)',
        'game.result.pot_one': ' {count} card in the pot.',
        'game.result.pot_other': ' {count} cards in the pot.',

        /* Game page — cards */
        'game.noCards': 'No cards left',
        'game.startPrompt': 'Press “Start game”',
        'game.attr.higher': 'Highest value wins.',
        'game.attr.lower': 'Lowest value wins.',
        'game.attr.compare': '{stat} {value}{unit}. {rule} Compare {stat}.',
        'game.attr.lowerTitle': 'Lowest value wins',
        'game.card.roundWin': 'Round win',
        'game.card.faceDown': 'Computer card, face down',
        'game.card.revealed': 'Computer card, revealed',

        /* Game page — rules panel */
        'rules.title': 'How to play',
        'rules.1': 'The deck is shuffled and split equally between you and the computer.',
        'rules.2':
            'You always see your top card; the computer’s card stays face down until the round resolves.',
        'rules.3': 'Click a category on your card to compare that stat.',
        'rules.4':
            'The higher value wins both cards — except on a stat marked ↓, where the lowest value wins. Won cards go to the bottom of the winner’s pile.',
        'rules.5': 'On a draw the cards go to a pot that the next round’s winner claims.',
        'rules.6': 'If the computer wins a round, it picks the next category.',
        'rules.7': 'The game ends when one player holds every card.',
        'rules.close': 'Got it',

        /* Game page — game over */
        'over.title': 'You win!',
        'over.playAgain': 'Play again',
        'over.win': 'You win!',
        'over.lose': 'Computer wins!',
        'over.draw': 'It’s a draw!',
        'over.winDetail': 'You collected every card in the deck.',
        'over.loseDetail': 'The computer collected every card in the deck.',
        'over.drawDetail': 'Nobody could claim the last cards.',
        'over.limitWin': 'You win on cards!',
        'over.limitLose': 'Computer wins on cards!',
        'over.limitDraw': 'It’s a stalemate!',
        'over.limitDetail':
            'Neither side could take the whole deck within {rounds} rounds, so the larger pile wins.',
        'over.limitLevel': ' Piles were level.',
        'over.score': ' Final score — you {player}, computer {computer}.',
        'over.potStayed_one': ' {count} card stayed in the pot.',
        'over.potStayed_other': ' {count} cards stayed in the pot.',

        /* Game page — match summary */
        'summary.rounds': 'Rounds played',
        'summary.playerRounds': 'Rounds you won',
        'summary.computerRounds': 'Rounds the computer won',
        'summary.draws': 'Draws',
        'summary.biggestPot': 'Biggest pot',
        'summary.contested': 'Contested most',
        'summary.superTrunfo': 'Super Trunfo rounds',
        'summary.ai': 'Computer picks',
        'summary.none': '—',

        /* The modes the computer draws from when it leads a round */
        'ai.random': 'Random stat',
        'ai.best': 'Best stat',
        'ai.adaptive': 'Best number',

        /* Stat names, for a deck whose stats carry no label of their own */
        'stat.size': 'Size',
        'stat.speed': 'Speed',
        'stat.lifespan': 'Lifespan',

        /* Deck creator — markup */
        'create.tag': 'Deck creator',
        'create.back': 'Back to game',
        'create.step1': '1 · Name the deck',
        'create.step2': '2 · Stats',
        'create.step3': '3 · Cards',
        'create.step4': '4 · Save',
        'create.stepSaved': 'Saved decks',
        'create.stepJson': 'Export / import JSON',
        'create.deckName': 'Deck name',
        'create.deckNamePlaceholder': 'e.g. Dinosaurs',
        'create.addStat': 'Add stat',
        'create.statsHint':
            'Each card compares these. Choose whether the highest or the lowest value wins — a 0–100 time, a price or a weight means the lowest wins. When the computer wins a round it picks the category itself, changing its mode from round to round.',
        'create.addCard': 'Add card',
        'create.cardsHint':
            'Every card needs a name and a number for each stat. An icon is optional — paste an emoji.',
        'create.saveDeck': 'Save deck',
        'create.template': 'Start from the built-in deck',
        'create.clear': 'Clear the form',
        'create.savedDeckLabel': 'Saved deck',
        'create.load': 'Load into the form',
        'create.delete': 'Delete',
        'create.exportDeck': 'Export to JSON',
        'create.jsonHint': 'Paste one deck or an array of decks into the box, or import a .json file.',
        'create.jsonLabel': 'Deck JSON',
        'create.jsonPlaceholder': '{"theme":"Dinosaurs","attributes":["length"],…}',
        'create.copy': 'Copy',
        'create.download': 'Download .json',
        'create.importText': 'Import from the box',
        'create.importFile': 'Import a .json file',

        /* Deck creator — stats panel and cards table */
        'create.statName': 'Name of stat {n}',
        'create.statUnit': 'Unit of stat {n}',
        'create.statRule': 'Which value wins for stat {n}',
        'create.removeStat': 'Remove stat {n}',
        'create.remove': 'Remove',
        'create.ruleHigh': 'Highest wins',
        'create.ruleLow': 'Lowest wins',
        'create.statPlaceholder': 'Stat name',
        'create.unitPlaceholder': 'unit',
        'create.statFallback': 'Stat {n}',
        'create.cardFallback': 'Card {n}',
        'create.cardName': 'Name of card {n}',
        'create.statForCard': '{stat} for card {n}',
        'create.emojiForCard': 'Emoji for card {n}',
        'create.imageForCard': 'Image for card {n}',
        'create.removeImage': 'Remove the image from card {n}',
        'create.removeCard': 'Remove card {n}',
        'create.image': 'Image',
        'create.imageTitle': 'Choose a picture for this card',
        'create.tableCard': 'Card',
        'create.tableUnit': 'Unit',
        'create.tableArtwork': 'Artwork',
        'create.ruleShort': '↓ lowest wins',
        'create.emptyCell': '—',

        /* Deck creator — status lines */
        'create.errorsTitle': 'This deck cannot be saved yet:',
        'create.saved': 'Saved “{theme}”. Pick it on the game page.',
        'create.fixProblems': 'Fix the problems above, then save again.',
        'create.saveFailed': 'Could not save: {message}',
        'create.prepareImage': 'Preparing “{name}”…',
        'create.imageAdded': 'Image added ({width}×{height}, {size}). Save the deck to keep it.',
        'create.imageRemoved': 'Image removed. Save the deck to keep the change.',
        'create.imageUnavailable': 'Image support is unavailable on this page.',
        'create.imported_one': '{count} deck imported.',
        'create.imported_other': '{count} decks imported.',
        'create.importPartial': '{saved} imported, {failed} failed: {errors}',
        'create.importFailed': 'Import failed: {message}',
        'create.nothingToDownload': 'There is nothing to download yet.',
        'create.downloaded': 'Downloaded trunfo-deck.json.',
        'create.downloadBlocked': 'The browser blocked the download. Copy the JSON instead.',
        'create.nothingToCopy': 'There is nothing to copy yet.',
        'create.copied': 'JSON copied to the clipboard.',
        'create.copyFailed': 'Copying failed. Select the text and copy it manually.',
        'create.copyManual': 'Press Ctrl/Cmd+C to copy the selected JSON.',
        'create.formCleared': 'Form cleared.',
        'create.loadedDeck': 'Loaded “{theme}” into the form.',
        'create.deleted': 'Deleted “{theme}”.',
        'create.exported': '“{theme}” is in the box below, artwork included — copy or download it.',
        'create.fileUnreadable': 'That file could not be read.',
        'create.noCustomDecks': 'No custom decks yet. Built-in decks can be loaded as a starting point.',
        'create.customDecks_one': '{count} custom deck saved.',
        'create.customDecks_other': '{count} custom decks saved.',
        'create.storage': ' Storage: {backend}',
        'create.storageIndexedDb': 'IndexedDB',
        'create.storageMemory': 'in memory (this session only)',
        'create.images_one': ' · {count} image ({size})',
        'create.images_other': ' · {count} images ({size})',
        'create.dbError': 'The local database could not be opened, so nothing will be saved: {error}',
        'create.noIndexedDb': 'This browser has no IndexedDB, so decks last only for this session.',
        'create.migrated_one': 'Moved {count} deck from the old browser storage into the database.',
        'create.migrated_other': 'Moved {count} decks from the old browser storage into the database.',
        'create.builtInSuffix': ' (built-in)',
        'create.templateLoaded': 'Loaded the built-in deck as a starting point. Give it a new name and save.',
        'create.copySuffix': ' (copy)',

        /* Store and artwork errors, surfaced by the deck creator */
        'error.deckObject': 'Deck must be a JSON object.',
        'error.deckName': 'Give the deck a name.',
        'error.minStats': 'Add at least one stat.',
        'error.maxStats': 'A card can have at most {max} stats.',
        'error.minCards': 'Add at least {min} cards.',
        'error.maxCards': 'A deck can have at most {max} cards.',
        'error.cardWhere': 'Card {n}',
        'error.cardWhereNamed': 'Card {n} ({name})',
        'error.cardName': 'Card {n}: give the card a name.',
        'error.cardValue': '{where}: "{stat}" needs a number.',
        'error.deckLabel': 'Deck {n}: ',
        'error.maxDecks': 'You can keep at most {max} custom decks.',
        'error.builtInDelete': 'The built-in deck cannot be deleted.',
        'error.deckMissing': 'Deck not found.',
        'error.saveFailed': 'Could not save to the local database: {message}',
        'error.deleteFailed': 'Could not delete: {message}',
        'error.notAnImage': 'That is not an image file.',
        'error.imageTooLarge': 'That image is too large (limit {limit} KB).',
        'error.imageSaveFailed': 'Could not save the image: {message}',
        'error.badJson': 'That is not valid JSON.',
        'error.dbOpen': 'Could not open the local database.',
        'error.dbBlocked': 'The local database is blocked by another tab.',
        'error.dbAborted': 'The database write was aborted.',
        'error.imageRead': 'That image could not be read.',
        'error.chooseImage': 'Choose an image file first.',
        'error.notAnImageFile': 'That file is not an image.',
        'error.imageTooBig': 'That image is larger than 25 MB.',
        'error.imageBrowserOnly': 'Images can only be prepared in a browser.',
        'error.imageNoPixels': 'That image has no pixels.',
        'error.imageNoCanvas': 'This browser cannot prepare images.'
    };

    const PT_BR = {
        'app.title': 'Trunfo — Jogo de cartas',
        'app.description':
            'Jogo de Trunfo (Top Trumps) para um jogador no navegador: compare as estatísticas das cartas contra o computador e fique com o baralho inteiro.',
        'app.createTitle': 'Trunfo — Criador de baralhos',
        'app.createDescription':
            'Crie o seu próprio baralho de Trunfo: dê um nome, escolha até cinco estatísticas e preencha as cartas.',
        'app.switchLanguage': 'Mudar o idioma para {language}',

        'game.deck': 'Baralho',
        'game.newDeck': 'Novo',
        'game.newDeckTitle': 'Criar um baralho',
        'game.fast': 'Rápido',
        'game.fastTitle': 'Encurtar o tempo de revelação e de escolha',
        'game.rules': 'Regras',
        'game.rulesTitle': 'Como jogar',
        'game.restart': 'Reiniciar',
        'game.computer': 'Computador',
        'game.you': 'Você',
        'game.start': 'Iniciar jogo',
        'game.round': 'Rodada',
        'game.pot': 'Pote',
        'game.cards_one': 'carta',
        'game.cards_other': 'cartas',
        'count.cards_one': '{count} carta',
        'count.cards_other': '{count} cartas',

        'game.idle': 'Aperte “Iniciar jogo” para embaralhar e distribuir.',
        'game.chooseFirst': 'Escolha uma categoria na sua carta para começar.',
        'game.chooseNext': 'Escolha uma categoria para a próxima rodada.',
        'game.gameOver': 'Fim de jogo.',
        'game.yourTurn': 'O computador escolhe nesta rodada — aguarde.',
        'game.computerTurn': 'O computador venceu a última rodada — ele está escolhendo uma categoria…',
        'game.fastOn': 'Modo rápido ligado — as rodadas terminam depressa.',
        'game.fastOff': 'Modo rápido desligado.',
        'game.result.trump': 'Super Trunfo! ',
        'game.result.win': '{trump}Você venceu a rodada! {score}{pot}',
        'game.result.lose': '{trump}O computador venceu a rodada. {score}{pot}',
        'game.result.draw': 'Empate — as cartas vão para o pote. {score}',
        'game.result.score': '{stat}{rule}: você {player} vs computador {computer}.',
        'game.result.lowestRule': ' (menor vence)',
        'game.result.pot_one': ' {count} carta no pote.',
        'game.result.pot_other': ' {count} cartas no pote.',

        'game.noCards': 'Sem cartas',
        'game.startPrompt': 'Aperte “Iniciar jogo”',
        'game.attr.higher': 'O maior valor vence.',
        'game.attr.lower': 'O menor valor vence.',
        'game.attr.compare': '{stat} {value}{unit}. {rule} Compare {stat}.',
        'game.attr.lowerTitle': 'O menor valor vence',
        'game.card.roundWin': 'Vitória na rodada',
        'game.card.faceDown': 'Carta do computador, virada para baixo',
        'game.card.revealed': 'Carta do computador, revelada',

        'rules.title': 'Como jogar',
        'rules.1': 'O baralho é embaralhado e dividido igualmente entre você e o computador.',
        'rules.2':
            'Você sempre vê a sua carta de cima; a carta do computador fica virada para baixo até o fim da rodada.',
        'rules.3': 'Clique em uma categoria da sua carta para comparar aquela estatística.',
        'rules.4':
            'O maior valor leva as duas cartas — exceto em uma estatística marcada com ↓, em que o menor valor vence. As cartas ganhas vão para o fim da pilha de quem venceu.',
        'rules.5': 'No empate as cartas vão para um pote, que fica com quem vencer a próxima rodada.',
        'rules.6': 'Se o computador vencer uma rodada, ele escolhe a próxima categoria.',
        'rules.7': 'O jogo termina quando um dos lados fica com todas as cartas.',
        'rules.close': 'Entendi',

        'over.title': 'Você venceu!',
        'over.playAgain': 'Jogar de novo',
        'over.win': 'Você venceu!',
        'over.lose': 'O computador venceu!',
        'over.draw': 'Empate!',
        'over.winDetail': 'Você ficou com todas as cartas do baralho.',
        'over.loseDetail': 'O computador ficou com todas as cartas do baralho.',
        'over.drawDetail': 'Ninguém conseguiu levar as últimas cartas.',
        'over.limitWin': 'Você venceu por número de cartas!',
        'over.limitLose': 'O computador venceu por número de cartas!',
        'over.limitDraw': 'Empate total!',
        'over.limitDetail':
            'Nenhum dos lados levou o baralho inteiro em {rounds} rodadas, então a maior pilha vence.',
        'over.limitLevel': ' As pilhas ficaram do mesmo tamanho.',
        'over.score': ' Placar final — você {player}, computador {computer}.',
        'over.potStayed_one': ' {count} carta ficou no pote.',
        'over.potStayed_other': ' {count} cartas ficaram no pote.',

        'summary.rounds': 'Rodadas jogadas',
        'summary.playerRounds': 'Rodadas que você venceu',
        'summary.computerRounds': 'Rodadas que o computador venceu',
        'summary.draws': 'Empates',
        'summary.biggestPot': 'Maior pote',
        'summary.contested': 'Mais disputada',
        'summary.superTrunfo': 'Rodadas com Super Trunfo',
        'summary.ai': 'Escolhas do computador',
        'summary.none': '—',

        'ai.random': 'Aleatória',
        'ai.best': 'Melhor estatística',
        'ai.adaptive': 'Melhor número',

        'stat.size': 'Tamanho',
        'stat.speed': 'Velocidade',
        'stat.lifespan': 'Tempo de vida',

        'create.tag': 'Criador de baralhos',
        'create.back': 'Voltar ao jogo',
        'create.step1': '1 · Nomeie o baralho',
        'create.step2': '2 · Estatísticas',
        'create.step3': '3 · Cartas',
        'create.step4': '4 · Salvar',
        'create.stepSaved': 'Baralhos salvos',
        'create.stepJson': 'Exportar / importar JSON',
        'create.deckName': 'Nome do baralho',
        'create.deckNamePlaceholder': 'ex.: Dinossauros',
        'create.addStat': 'Adicionar estatística',
        'create.statsHint':
            'Cada carta compara estas estatísticas. Escolha se o maior ou o menor valor vence — um tempo de 0 a 100, um preço ou um peso significa que o menor vence. Quando o computador vence uma rodada, ele escolhe a categoria, mudando de modo a cada rodada.',
        'create.addCard': 'Adicionar carta',
        'create.cardsHint':
            'Cada carta precisa de um nome e de um número para cada estatística. O ícone é opcional — cole um emoji.',
        'create.saveDeck': 'Salvar baralho',
        'create.template': 'Começar pelo baralho embutido',
        'create.clear': 'Limpar o formulário',
        'create.savedDeckLabel': 'Baralho salvo',
        'create.load': 'Carregar no formulário',
        'create.delete': 'Excluir',
        'create.exportDeck': 'Exportar para JSON',
        'create.jsonHint': 'Cole um baralho ou uma lista de baralhos na caixa, ou importe um arquivo .json.',
        'create.jsonLabel': 'JSON do baralho',
        'create.jsonPlaceholder': '{"theme":"Dinossauros","attributes":["comprimento"],…}',
        'create.copy': 'Copiar',
        'create.download': 'Baixar .json',
        'create.importText': 'Importar da caixa',
        'create.importFile': 'Importar um arquivo .json',

        'create.statName': 'Nome da estatística {n}',
        'create.statUnit': 'Unidade da estatística {n}',
        'create.statRule': 'Qual valor vence na estatística {n}',
        'create.removeStat': 'Remover estatística {n}',
        'create.remove': 'Remover',
        'create.ruleHigh': 'Maior vence',
        'create.ruleLow': 'Menor vence',
        'create.statPlaceholder': 'Nome da estatística',
        'create.unitPlaceholder': 'unidade',
        'create.statFallback': 'Estatística {n}',
        'create.cardFallback': 'Carta {n}',
        'create.cardName': 'Nome da carta {n}',
        'create.statForCard': '{stat} da carta {n}',
        'create.emojiForCard': 'Emoji da carta {n}',
        'create.imageForCard': 'Imagem da carta {n}',
        'create.removeImage': 'Remover a imagem da carta {n}',
        'create.removeCard': 'Remover carta {n}',
        'create.image': 'Imagem',
        'create.imageTitle': 'Escolha uma figura para esta carta',
        'create.tableCard': 'Carta',
        'create.tableUnit': 'Unidade',
        'create.tableArtwork': 'Arte',
        'create.ruleShort': '↓ menor vence',
        'create.emptyCell': '—',

        'create.errorsTitle': 'Este baralho ainda não pode ser salvo:',
        'create.saved': '“{theme}” salvo. Escolha-o na página do jogo.',
        'create.fixProblems': 'Corrija os problemas acima e salve de novo.',
        'create.saveFailed': 'Não foi possível salvar: {message}',
        'create.prepareImage': 'Preparando “{name}”…',
        'create.imageAdded': 'Imagem adicionada ({width}×{height}, {size}). Salve o baralho para mantê-la.',
        'create.imageRemoved': 'Imagem removida. Salve o baralho para manter a mudança.',
        'create.imageUnavailable': 'O suporte a imagens não está disponível nesta página.',
        'create.imported_one': '{count} baralho importado.',
        'create.imported_other': '{count} baralhos importados.',
        'create.importPartial': '{saved} importados, {failed} com falha: {errors}',
        'create.importFailed': 'A importação falhou: {message}',
        'create.nothingToDownload': 'Ainda não há nada para baixar.',
        'create.downloaded': 'trunfo-deck.json foi baixado.',
        'create.downloadBlocked': 'O navegador bloqueou o download. Copie o JSON.',
        'create.nothingToCopy': 'Ainda não há nada para copiar.',
        'create.copied': 'JSON copiado para a área de transferência.',
        'create.copyFailed': 'A cópia falhou. Selecione o texto e copie manualmente.',
        'create.copyManual': 'Aperte Ctrl/Cmd+C para copiar o JSON selecionado.',
        'create.formCleared': 'Formulário limpo.',
        'create.loadedDeck': '“{theme}” carregado no formulário.',
        'create.deleted': '“{theme}” excluído.',
        'create.exported': '“{theme}” está na caixa abaixo, com a arte — copie ou baixe.',
        'create.fileUnreadable': 'Não foi possível ler esse arquivo.',
        'create.noCustomDecks':
            'Nenhum baralho personalizado ainda. Os baralhos embutidos podem ser carregados como ponto de partida.',
        'create.customDecks_one': '{count} baralho personalizado salvo.',
        'create.customDecks_other': '{count} baralhos personalizados salvos.',
        'create.storage': ' Armazenamento: {backend}',
        'create.storageIndexedDb': 'IndexedDB',
        'create.storageMemory': 'na memória (só nesta sessão)',
        'create.images_one': ' · {count} imagem ({size})',
        'create.images_other': ' · {count} imagens ({size})',
        'create.dbError': 'Não foi possível abrir o banco de dados local, então nada será salvo: {error}',
        'create.noIndexedDb':
            'Este navegador não tem IndexedDB, então os baralhos duram apenas nesta sessão.',
        'create.migrated_one':
            'Movido {count} baralho do armazenamento antigo do navegador para o banco de dados.',
        'create.migrated_other':
            'Movidos {count} baralhos do armazenamento antigo do navegador para o banco de dados.',
        'create.builtInSuffix': ' (embutido)',
        'create.templateLoaded':
            'Baralho embutido carregado como ponto de partida. Dê a ele um novo nome e salve.',
        'create.copySuffix': ' (cópia)',

        'error.deckObject': 'O baralho precisa ser um objeto JSON.',
        'error.deckName': 'Dê um nome ao baralho.',
        'error.minStats': 'Adicione pelo menos uma estatística.',
        'error.maxStats': 'Uma carta pode ter no máximo {max} estatísticas.',
        'error.minCards': 'Adicione pelo menos {min} cartas.',
        'error.maxCards': 'Um baralho pode ter no máximo {max} cartas.',
        'error.cardWhere': 'Carta {n}',
        'error.cardWhereNamed': 'Carta {n} ({name})',
        'error.cardName': 'Carta {n}: dê um nome à carta.',
        'error.cardValue': '{where}: "{stat}" precisa de um número.',
        'error.deckLabel': 'Baralho {n}: ',
        'error.maxDecks': 'Você pode manter no máximo {max} baralhos personalizados.',
        'error.builtInDelete': 'O baralho embutido não pode ser excluído.',
        'error.deckMissing': 'Baralho não encontrado.',
        'error.saveFailed': 'Não foi possível salvar no banco de dados local: {message}',
        'error.deleteFailed': 'Não foi possível excluir: {message}',
        'error.notAnImage': 'Esse arquivo não é uma imagem.',
        'error.imageTooLarge': 'Essa imagem é grande demais (limite de {limit} KB).',
        'error.imageSaveFailed': 'Não foi possível salvar a imagem: {message}',
        'error.badJson': 'Isso não é JSON válido.',
        'error.dbOpen': 'Não foi possível abrir o banco de dados local.',
        'error.dbBlocked': 'O banco de dados local está bloqueado por outra aba.',
        'error.dbAborted': 'A gravação no banco de dados foi abortada.',
        'error.imageRead': 'Não foi possível ler essa imagem.',
        'error.chooseImage': 'Escolha um arquivo de imagem primeiro.',
        'error.notAnImageFile': 'Esse arquivo não é uma imagem.',
        'error.imageTooBig': 'Essa imagem tem mais de 25 MB.',
        'error.imageBrowserOnly': 'Imagens só podem ser preparadas no navegador.',
        'error.imageNoPixels': 'Essa imagem não tem pixels.',
        'error.imageNoCanvas': 'Este navegador não consegue preparar imagens.'
    };

    const CATALOGS = { en: EN, 'pt-BR': PT_BR };
    const LOCALE_IDS = LOCALES.map(function (entry) {
        return entry.id;
    });

    let current = null;
    const formatters = {};

    /* ------------------------------------------------------------- selection */

    /** The shipped locale a tag asks for, or null. `pt-PT` resolves to `pt-BR`. */
    function supported(tag) {
        const wanted = String(tag == null ? '' : tag)
            .trim()
            .toLowerCase()
            .replace(/_/g, '-');
        if (!wanted) return null;
        for (let i = 0; i < LOCALE_IDS.length; i++) {
            if (LOCALE_IDS[i].toLowerCase() === wanted) return LOCALE_IDS[i];
        }
        const base = wanted.split('-')[0];
        for (let i = 0; i < LOCALE_IDS.length; i++) {
            if (LOCALE_IDS[i].toLowerCase().split('-')[0] === base) return LOCALE_IDS[i];
        }
        return null;
    }

    function readStored() {
        try {
            return global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : null;
        } catch {
            // Some browsers throw on storage access from a file:// origin.
            return null;
        }
    }

    function readQuery() {
        try {
            const search = global.location && global.location.search;
            if (!search) return null;
            return new URLSearchParams(search).get('lang');
        } catch {
            return null;
        }
    }

    function detect() {
        const candidates = [readQuery(), readStored()];
        // Only a browser has a preference worth following. Under Node (the
        // tests, tooling) the default stays English unless a caller asks for
        // another language, so a machine's LANG cannot change the output.
        const navigator_ = global.document ? global.navigator : null;
        if (navigator_) {
            if (Array.isArray(navigator_.languages)) {
                candidates.push.apply(candidates, navigator_.languages);
            }
            candidates.push(navigator_.language);
        }
        for (let i = 0; i < candidates.length; i++) {
            const hit = supported(candidates[i]);
            if (hit) return hit;
        }
        return DEFAULT_LOCALE;
    }

    function locale() {
        if (!current) current = detect();
        return current;
    }

    function persist(tag) {
        try {
            if (global.localStorage) global.localStorage.setItem(STORAGE_KEY, tag);
        } catch {
            // Private mode or a file:// origin: the choice just does not survive.
        }
    }

    /* ------------------------------------------------------------ translation */

    function lookup(catalog, key) {
        return catalog && Object.prototype.hasOwnProperty.call(catalog, key) ? catalog[key] : undefined;
    }

    /**
     * The text for a key in the active locale, falling back to English. With a
     * numeric `count`, the `_one` / `_other` variant is preferred — Portuguese
     * and English both take the singular only at exactly one.
     */
    function phrase(key, count) {
        const active = CATALOGS[locale()] || {};
        const fallback = CATALOGS[DEFAULT_LOCALE] || {};
        const suffix = typeof count === 'number' ? (count === 1 ? '_one' : '_other') : '';
        const variants = suffix ? [key + suffix, key] : [key];
        for (let i = 0; i < variants.length; i++) {
            const hit = lookup(active, variants[i]);
            if (hit !== undefined) return hit;
            const alt = lookup(fallback, variants[i]);
            if (alt !== undefined) return alt;
        }
        return key;
    }

    function interpolate(text, params) {
        return String(text).replace(/\{(\w+)\}/g, function (match, name) {
            if (!params || !Object.prototype.hasOwnProperty.call(params, name)) return match;
            const value = params[name];
            return typeof value === 'number' ? number(value) : String(value);
        });
    }

    /** Translate a key. `{name}` placeholders are filled from `params`. */
    function t(key, params) {
        const vars = params || {};
        return interpolate(phrase(key, vars.count), vars);
    }

    /** Format a number the way the active locale writes it (1.020 / 1,020). */
    function number(value, options) {
        if (typeof value !== 'number' || !isFinite(value)) return String(value);
        const tag = locale();
        const opts = options || {};
        const cacheKey = tag + '|' + JSON.stringify(opts);
        if (!formatters[cacheKey]) {
            try {
                formatters[cacheKey] = new Intl.NumberFormat(tag, opts);
            } catch {
                formatters[cacheKey] = new Intl.NumberFormat(DEFAULT_LOCALE, opts);
            }
        }
        try {
            return formatters[cacheKey].format(value);
        } catch {
            return String(value);
        }
    }

    /* ------------------------------------------------------------------- DOM */

    const TEXT_ATTRIBUTE = 'data-i18n';
    const TRANSLATED_ATTRIBUTES = ['title', 'aria-label', 'placeholder', 'content'];

    function each(list, fn) {
        for (let i = 0; i < list.length; i++) fn(list[i]);
    }

    /**
     * Replace every marked-up string under `root`. Elements keep their English
     * copy in the source, which is what a browser without this script shows.
     */
    function apply(root) {
        const scope = root || global.document;
        if (!scope || !scope.querySelectorAll) return;
        each(scope.querySelectorAll('[' + TEXT_ATTRIBUTE + ']'), function (node) {
            node.textContent = t(node.getAttribute(TEXT_ATTRIBUTE));
        });
        TRANSLATED_ATTRIBUTES.forEach(function (attribute) {
            const key = 'data-i18n-' + attribute;
            each(scope.querySelectorAll('[' + key + ']'), function (node) {
                node.setAttribute(attribute, t(node.getAttribute(key)));
            });
        });
    }

    function setDocumentLang() {
        if (global.document && global.document.documentElement) {
            global.document.documentElement.setAttribute('lang', locale());
        }
    }

    /** The entry for a shipped locale id, or null. */
    function entry(id) {
        for (let i = 0; i < LOCALES.length; i++) {
            if (LOCALES[i].id === id) return LOCALES[i];
        }
        return null;
    }

    /**
     * The language a click on the switch button lands on: the next one in
     * `LOCALES`, wrapping at the end. With the two shipped languages that is a
     * plain toggle; a third language turns it into a cycle, and the button keeps
     * working without a menu.
     */
    function nextLocale() {
        const at = LOCALE_IDS.indexOf(locale());
        return LOCALE_IDS[(at + 1) % LOCALE_IDS.length];
    }

    /** Point a switch button at the active language and the switch it performs. */
    function paintToggle(button) {
        const here = entry(locale());
        const there = entry(nextLocale());
        const label = t('app.switchLanguage', { language: there ? there.label : nextLocale() });

        button.textContent = '';
        if (global.document) {
            const flag = global.document.createElement('span');
            flag.className = 'flag';
            flag.setAttribute('aria-hidden', 'true');
            flag.textContent = here ? here.flag : '';
            button.appendChild(flag);
        }
        // The visible flag is the *current* language, so the name has to say
        // what a click does — and it is also the tooltip.
        button.setAttribute('aria-label', label);
        button.title = label;
    }

    function fillToggles(root) {
        const scope = root || global.document;
        if (!scope || !scope.querySelectorAll) return;
        each(scope.querySelectorAll('[data-locale-toggle]'), function (button) {
            if (button.getAttribute('data-locale-ready') !== '1') {
                button.setAttribute('data-locale-ready', '1');
                button.addEventListener('click', function () {
                    setLocale(nextLocale());
                });
            }
            paintToggle(button);
        });
    }

    /** Translate the page: markup, `<html lang>` and the language buttons. */
    function mount(root) {
        const scope = root || global.document;
        if (!scope) return false;
        apply(scope);
        setDocumentLang();
        fillToggles(scope);
        return true;
    }

    function announce() {
        const doc = global.document;
        if (!doc || !doc.dispatchEvent) return;
        let event = null;
        try {
            event = new global.CustomEvent(EVENT_NAME, { detail: { locale: locale() } });
        } catch {
            event = null;
        }
        if (!event) return;
        doc.dispatchEvent(event);
    }

    /**
     * Switch language: translate the page, remember the choice and tell the
     * controllers (whose status lines and cards are rendered, not marked up).
     * An unknown tag is ignored rather than silently resetting to English.
     */
    function setLocale(tag) {
        const next = supported(tag);
        if (!next) return null;
        const changed = next !== locale();
        current = next;
        persist(next);
        if (global.document) {
            apply(global.document);
            setDocumentLang();
            fillToggles(global.document);
        }
        if (changed) announce();
        return next;
    }

    /** Every catalog, for the parity test and for tooling. */
    function catalogs() {
        return CATALOGS;
    }

    function boot() {
        mount(global.document);
    }

    if (global.document) {
        if (global.document.readyState === 'loading') {
            global.document.addEventListener('DOMContentLoaded', boot);
        } else {
            boot();
        }
    }

    return {
        DEFAULT_LOCALE: DEFAULT_LOCALE,
        STORAGE_KEY: STORAGE_KEY,
        EVENT_NAME: EVENT_NAME,
        LOCALES: LOCALES,
        locale: locale,
        nextLocale: nextLocale,
        supported: supported,
        setLocale: setLocale,
        t: t,
        number: number,
        apply: apply,
        mount: mount,
        catalogs: catalogs
    };
});
