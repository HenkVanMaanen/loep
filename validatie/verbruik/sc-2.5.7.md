# Dossier voor sleepbewegingen

## Opzet

Dezelfde steekproef met één startpagina van Lindewaard en dezelfde recepten als in de eerdere meting. De uitgangsmeting voor 2.5.7 duurde 13 minuten en 46 seconden en eindigde met `cantTell`. De beoordelaar, verifieerder en twee afmaakpogingen deden samen 138 opdrachten. Daaronder waren 24 geslaagde `find`-opdrachten die zochten naar sleepbare elementen, bewegingshandlers, rollen of canvas en geen treffer gaven.

De veegronde is opnieuw uitgevoerd met `collect --fresh --at-once 2`. Uit één set bewijs zijn twee dossiers gemaakt, met de oorspronkelijke procedure op `598b7bb` en met de aangepaste procedure. Geteld is de compacte weergave die een beoordelaar moet lezen.

| Verplichte dossierdelen | Oorspronkelijk | Aangepast |
| --- | ---: | ---: |
| Bewijs voor 2.5.7, tekens | 20.388 | 6.135 |
| Bewijs voor 2.5.7 en `siteStates`, tekens | 46.376 | 32.123 |
| Te lezen delen inclusief de delen van `siteStates` | 5 | 3 |

De afname is 70% voor het eigen criteriumbewijs en 31% over alle verplichte delen. De browserlezing op de startpagina nam bij negen metingen mediaan 25 ms in beslag. Bij de twee productpagina's was dat 13 tot 16 ms. De looptijd van de nieuwe beoordelingsrondes is nog niet gemeten.

## Positieve en negatieve controles

- Op de startpagina toonde de scan geen sleepbare bediening in het standaardvenster, het smalle venster en de acht vastgelegde toestanden. Twee onderdelen uit het sitemodel staan als niet bereikt vermeld. De menscontrole was in de begintoestand leesbaar tijdens `collect` en is in de herhaalde toestanden door de scopebewaking geweigerd. Het dossier vermeldt het adres en het verschil per toestand. De verborgen lege iframe staat er apart bij.
- Op de productpagina van Lindewaard wees `pointermove` samen met `touch-action=none` de aangepaste hendel aan. Klikken op de baan hield de grens op 150 euro. Slepen zette de grens op 50 euro en liet twee producten over.
- Op de productpagina van Berkenveen wees `input[range]` de standaard schuifregelaar aan. Een klik op de baan zette de waarde van 150 op 30 en liet twee producten over. Er zijn geen schrijfverzoeken naar de eigen lokale controle op Berkenveen gegaan.
- De regressietest opent een aanvankelijk verborgen bediening, vindt een dan geregistreerde listener en een toegewezen `ondragover`, en controleert dat slepen en de gevonden knop dezelfde waarde bereiken. Dezelfde test onderscheidt geladen, geweigerde en mislukte vensters.

De scan levert plekken en aanwijzingen voor de proef. Het effect van slepen en van een alternatief vraagt nog een handeling. Gesloten schaduwbomen, onderdelen die pas een handler krijgen tijdens het indrukken en niet-bereikte toestanden blijven mogelijke gaten in de dekking.
