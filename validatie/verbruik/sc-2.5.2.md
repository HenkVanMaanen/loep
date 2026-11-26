# Aanwijzerannulering (2.5.2)

De eerdere geïsoleerde meting op de startpagina van Lindewaard duurde 22 min 24 s, waarvan 9 min 44 s voor de controle. De uitkomst was `cantTell` zonder bevindingen. Het dossier bevatte 37 indrukproeven. De beoordelaars zochten in meerdere toestanden opnieuw naar handlers en probeerden teksteffecten uit het dossier te herhalen. Het bezoekersgerichte ingesloten venster bleef buiten de vaste afbakening geblokkeerd.

Op dezelfde lokale testpagina is de veegronde opnieuw uitgevoerd. Het dossier vermeldde nul HTML-attributen voor indrukken op de startpagina en in alle acht vastgelegde toestanden. Twee toestanden bleven bij `notChecked`. De indrukproef voerde opnieuw 37 proeven uit. Een gemelde reactie had nu een selector bij de meetrij.

Een script draaide beide werkwijzen twee keer op dezelfde lokale testpagina. Het vergeleek de zoektocht naar HTML-attributen in de begin-, menu- en chattoestand en een eigen indrukproef op twee doelen uit de eerdere meting. De proef met de oude werkwijze deed per gecontroleerde weergave `open` en `find`, en per doel `open`, `find` en `press --hold`. Alleen bij een effect bij het indrukken was er nog een tweede opening met `press --abort` nodig. De nieuwe werkwijze las `pointer.downEventAttributes` en gebruikte per doel `open` en `press --abort` met de selector. De tabel telt de looptijden van die opdrachten op. De sessiestart en afsluiting zijn buiten de tijdmeting gelaten.

| Werkwijze | Opdrachten per keer | Eerste meting | Tweede meting | Gemiddeld |
|---|---:|---:|---:|---:|
| Eerder | 12 | 25,095 s | 25,178 s | 25,137 s |
| Met dossier en selector | 5 | 12,021 s | 12,346 s | 12,184 s |

De gemeten reeks kostte gemiddeld 52% minder tijd. De pagina wisselt zelf van nieuwsbericht. In de kortere reeks viel die wisseling in de menutoestand beide keren tijdens het indrukken, terwijl ze in de eerdere reeks buiten dat meetmoment viel. Het moment van zo'n wisseling alleen onderbouwt geen bevinding. De procedure vraagt daarom bij twijfel om een waarneming zonder druk en laat een onverklaard verschil open. De proef geeft geen antwoord over de inhoud van het geblokkeerde venster.

Deze vergelijking meet de opdrachten voor dit deel van de beoordeling. De regressietests dekken onder meer een functie die bij indrukken wordt uitgevoerd en na loslaten zichtbaar blijft, een tijdelijke weergave die bij loslaten verdwijnt, activering bij loslaten, handlers in open schaduw-DOM en het verschil tussen nul treffers en ontbrekend bewijs.

## Meting met beoordelaars

Op commit `375fbc0` is hetzelfde criterium op dezelfde afgebakende startpagina opnieuw beoordeeld met Luna, na een nieuwe veegronde. Die beoordeling duurde 7 min 41 s, tegenover 22 min 24 s eerder. De eerste ronde duurde 3 min 32 s tegenover 5 min 43 s, en de onafhankelijke controle 3 min 57 s tegenover 9 min 44 s. De eerdere meting had ook een afmaakronde. Die was bij de nieuwe meting niet nodig voor de gekozen open punten. Elke uitvoering is één meting. De inhoud van de verse indrukproeven en de rondes die volgden, verschilden.

De eerste beoordelaar hield een tekstwisseling uit de indrukproef voor een functie van de link. De controleur maakte de aanwijzerhandeling drie keer na in dezelfde toestand en vond die reactie niet. Hij zette de bevinding op niet gereproduceerd. De uitkomst bleef `cantTell` zonder bevindingen, onder meer omdat het bezoekersgerichte ingesloten venster buiten de afbakening geblokkeerd bleef. Een aparte waarneming zonder druk liet het nieuwsblok vanzelf wisselen. Regel R1 vraagt daarom nu bij een losse verandering in tekst, een statusmelding of scrollpositie om een eigen indrukproef op de vermelde plek en een vergelijking zonder druk.
